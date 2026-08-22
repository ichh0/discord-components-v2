import type { RawComponent } from "../core/constants";
import {
  getChildren,
  hasCustomId,
  isActionRow,
  isButton,
  isContainer as isContainerNode,
  isInteractive,
  isSection,
  isTextDisplay,
} from "../core/guards";
import { findComponents, walkComponents, type ComponentRef } from "../core/walk";
import { matchesSelector, type ComponentSelector } from "../core/selector";

/**
 * In-place editing operations over an owned array of raw components.
 *
 * "Owned" means: the caller must be free to mutate the array and its nodes
 * (e.g. data produced by `normalizeComponents`, a `V2Builder` or a
 * `ComponentsEditor`). These functions never clone — cloning is the
 * responsibility of the wrapper APIs (`editComponents`, `V2Builder.from`).
 */

export interface DisableOptions {
  /** Restrict to these custom_ids. Omit to affect every button. */
  customIds?: string | string[];
  /** Target state (default `true`). */
  disabled?: boolean;
}

/** True when the component is a button whose custom_id is in the list (or when no list given). */
export function matchesButtonIds(component: RawComponent, ids?: string | string[]): boolean {
  if (!isButton(component)) return false;
  const list = typeof ids === "string" ? [ids] : ids;
  if (!list || list.length === 0) return true;
  return hasCustomId(component) && list.includes(component.custom_id);
}

/** Enables/disables buttons everywhere in the tree, including section accessory buttons. */
export function disableButtons(roots: RawComponent[], options: DisableOptions = {}): RawComponent[] {
  const ids = options.customIds
    ? new Set(
        Array.isArray(options.customIds) ? options.customIds : [options.customIds],
      )
    : null;
  const disabled = options.disabled ?? true;

  walkComponents(roots, ({ component }) => {
    if (!isButton(component)) return;
    if (ids && !(hasCustomId(component) && ids.has(component.custom_id))) return;
    component.disabled = disabled;
  });
  return roots;
}

export function enableButtons(roots: RawComponent[], customIds?: string | string[]): RawComponent[] {
  return disableButtons(roots, { customIds, disabled: false });
}

/** Enables/disables every interactive component (buttons + selects) matching the selector. */
export function setDisabled(
  roots: RawComponent[],
  selector: ComponentSelector,
  disabled = true,
): RawComponent[] {
  for (const ref of findComponents(roots, selector)) {
    if (isInteractive(ref.component)) {
      (ref.component as { disabled?: boolean }).disabled = disabled;
    }
  }
  return roots;
}

/** Updates the label of a button found by custom_id. */
export function setButtonLabel(
  roots: RawComponent[],
  customId: string,
  label: string,
): RawComponent[] {
  const ref = findFirstButton(roots, customId);
  if (!ref) throw new Error(`setButtonLabel: button with custom_id "${customId}" not found`);
  (ref.component as { label?: string }).label = label;
  return roots;
}

function findFirstButton(roots: RawComponent[], customId: string): ComponentRef | null {
  let found: ComponentRef | null = null;
  walkComponents(roots, (ref) => {
    if (
      !found &&
      isButton(ref.component) &&
      hasCustomId(ref.component) &&
      ref.component.custom_id === customId
    ) {
      found = ref;
    }
  });
  return found;
}

/**
 * Replaces text inside all TextDisplay components.
 * `replacement` may be a string (with `$1` groups support via String.replace
 * semantics) or a replacer function.
 */
export function replaceText(
  roots: RawComponent[],
  search: string | RegExp,
  replacement: string | ((substring: string, ...args: unknown[]) => string),
): RawComponent[] {
  walkComponents(roots, ({ component }) => {
    if (!isTextDisplay(component)) return;
    component.content = component.content.replace(
      search as RegExp,
      replacement as string,
    );
  });
  return roots;
}

/** Returns contents of every TextDisplay in the tree. */
export function getTextContents(roots: RawComponent[]): string[] {
  const texts: string[] = [];
  walkComponents(roots, ({ component }) => {
    if (isTextDisplay(component)) texts.push(component.content);
  });
  return texts;
}

export interface RemoveOptions {
  /**
   * After removals, drop containers that ended up with no children.
   * Empty action rows and invalid sections are always pruned.
   */
  dropEmptyContainers?: boolean;
}

/**
 * Removes every component matching the selector.
 *
 * Notes:
 * - Removing a section accessory (thumbnail/button) removes the whole Section,
 *   because Discord requires sections to have an accessory.
 * - Action rows left empty are pruned automatically (Discord rejects them).
 */
export function removeComponents(
  roots: RawComponent[],
  selector: ComponentSelector,
  options: RemoveOptions = {},
): RawComponent[] {
  // Collect matches once; substitute accessories with their parent section refs.
  const allRefs = collectRefs(roots);
  const targets = new Set<RawComponent>();

  for (const ref of allRefs) {
    if (!matchesSelector(ref.component, selector)) continue;
    if (ref.kind === "accessory" && ref.parent) {
      targets.add(ref.parent); // remove the whole section instead
    } else {
      targets.add(ref.component);
    }
  }

  if (targets.size > 0) {
    // Deep-first order so nested nodes disappear before their parents shrink.
    const ordered = [...allRefs]
      .filter((r) => targets.has(r.component))
      .sort(comparePathsDesc);

    for (const ref of ordered) {
      if (ref.kind === "root") {
        const i = roots.indexOf(ref.component);
        if (i !== -1) roots.splice(i, 1);
      } else if (ref.siblings) {
        const i = ref.siblings.indexOf(ref.component);
        if (i !== -1) ref.siblings.splice(i, 1);
      }
    }
    pruneStructural(roots, options.dropEmptyContainers ?? false);
  }
  return roots;
}

/**
 * Removes everything that does NOT match the selector.
 *
 * Semantics:
 * - a matched node is kept together with its entire subtree;
 * - unmatched containers/action rows are rebuilt from their kept children;
 * - an unmatched section survives only if its text or accessory matches;
 * - empty leftovers are pruned.
 */
export function keepOnly(
  roots: RawComponent[],
  selector: ComponentSelector,
): RawComponent[] {
  const filtered = filterKept(roots, selector);
  roots.splice(0, roots.length, ...filtered);
  return roots;
}

function filterKept(list: RawComponent[], selector: ComponentSelector): RawComponent[] {
  const out: RawComponent[] = [];

  for (const item of list) {
    if (matchesSelector(item, selector)) {
      out.push(item); // whole subtree stays
      continue;
    }

    const children = getChildren(item);

    if (isContainerNode(item)) {
      const kept = filterKept(children ?? [], selector);
      if (kept.length > 0) out.push({ ...item, components: kept } as unknown as RawComponent);
      continue;
    }

    if (isActionRow(item)) {
      const kept = (children ?? []).filter((child) => matchesSelector(child, selector));
      if (kept.length > 0) out.push({ ...item, components: kept } as unknown as RawComponent);
      continue;
    }

    if (isSection(item)) {
      const accessoryMatches =
        Boolean((item as { accessory?: unknown }).accessory) &&
        matchesSelector((item as { accessory: RawComponent }).accessory, selector);
      const textMatches = (children ?? []).some((t) => matchesSelector(t, selector));
      if (accessoryMatches || textMatches) out.push(item); // sections stay whole
      continue;
    }

    // leaf without a match — dropped
  }

  return out;
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

interface InternalRef extends ComponentRef {
  parentRef: InternalRef | null;
}

function collectRefs(roots: RawComponent[]): InternalRef[] {
  const refs: InternalRef[] = [];
  const visitList = (
    list: RawComponent[],
    parent: RawComponent | null,
    parentRef: InternalRef | null,
  ): void => {
    list.forEach((component, index) => {
      const ref: InternalRef = {
        component,
        siblings: list,
        parent,
        index,
        path: [...(parentRef?.path ?? []), index],
        kind: parent === null ? "root" : "child",
        parentRef,
      };
      refs.push(ref);

      const children = getChildren(component);
      if (children) visitList(children, component, ref);

      if (isSection(component) && component.accessory) {
        refs.push({
          component: component.accessory as RawComponent,
          siblings: null,
          parent: component,
          index: -1,
          path: ref.path,
          kind: "accessory",
          parentRef: ref,
        });
      }
    });
  };
  visitList(roots, null, null);
  return refs;
}

function comparePathsDesc(a: ComponentRef, b: ComponentRef): number {
  const len = Math.max(a.path.length, b.path.length);
  for (let i = 0; i < len; i += 1) {
    const av = a.path[i] ?? -1;
    const bv = b.path[i] ?? -1;
    if (av !== bv) return bv - av;
  }
  return 0;
}

/**
 * Drops structurally-invalid leftovers:
 * - empty action rows (Discord rejects rows with zero components)
 * - sections without text displays or without an accessory
 * - optionally empty containers
 * Repeats until the tree is stable.
 */
function pruneStructural(roots: RawComponent[], dropEmptyContainers: boolean): void {
  let changed = true;
  while (changed) {
    changed = false;
    const refs = collectRefs(roots);
    for (const ref of refs) {
      const c = ref.component;
      if (isActionRow(c) && (getChildren(c)?.length ?? 0) === 0) {
        removeFromParent(ref, roots);
        changed = true;
        break; // restart — tree mutated
      }
      if (isSection(c)) {
        const texts = (getChildren(c) ?? []).filter(isTextDisplay);
        const hasAccessory = Boolean((c as { accessory?: unknown }).accessory);
        if (texts.length === 0 || !hasAccessory) {
          removeFromParent(ref, roots);
          changed = true;
          break;
        }
      }
      if (dropEmptyContainers && isContainerNode(c) && (getChildren(c)?.length ?? 0) === 0) {
        removeFromParent(ref, roots);
        changed = true;
        break;
      }
    }
  }
}

function removeFromParent(ref: InternalRef, roots: RawComponent[]): void {
  if (ref.parentRef === null) {
    const i = roots.indexOf(ref.component);
    if (i !== -1) roots.splice(i, 1);
    return;
  }
  const siblings = getChildren(ref.parentRef.component);
  if (siblings) {
    const i = siblings.indexOf(ref.component);
    if (i !== -1) siblings.splice(i, 1);
  }
}
