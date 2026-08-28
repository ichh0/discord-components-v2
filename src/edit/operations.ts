import type { RawComponent } from "../core/constants";
import {
  getChildren,
  hasCustomId,
  isActionRow,
  isButton,
  isContainer as isContainerNode,
  isInteractive,
  isMediaGallery,
  isSection,
  isSeparator,
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

// ---------------------------------------------------------------------------
// Indexed container-child management
// (Sections, Separators, TextDisplays, MediaGalleries, ActionRows)
// ---------------------------------------------------------------------------

/**
 * Position of one container child among the siblings of the same kind.
 * Each component kind (sections, separators, text blocks, ...) gets its own
 * zero-based `index`, plus the raw slot (`containerIndex`) inside the
 * container's `components` array.
 */
export interface IndexedChildRef {
  /** Index among children of the same kind only (0-based). */
  index: number;
  /** The raw component. */
  component: RawComponent;
  /** Index within the container's components array. */
  containerIndex: number;
}

export interface SectionRef extends IndexedChildRef {}
export interface SeparatorRef extends IndexedChildRef {}
export interface TextDisplayRef extends IndexedChildRef {}
export interface MediaGalleryRef extends IndexedChildRef {}
export interface ActionRowRef extends IndexedChildRef {}

type ChildPredicate = (c: RawComponent) => boolean;

/**
 * Resolves the children array to operate on.
 * If the first element is a Container, returns its `components` children.
 * Otherwise returns the array itself (it is already a children list).
 */
function resolveChildren(roots: RawComponent[]): RawComponent[] {
  if (roots.length === 1 && isContainerNode(roots[0])) {
    return getChildren(roots[0]) ?? [];
  }
  return roots;
}

function collectChildren(
  roots: RawComponent[],
  isTarget: ChildPredicate,
): { children: RawComponent[]; matches: IndexedChildRef[] } {
  const children = resolveChildren(roots);
  const matches: IndexedChildRef[] = [];
  let kindIndex = 0;
  for (let i = 0; i < children.length; i++) {
    if (isTarget(children[i])) {
      matches.push({
        index: kindIndex++,
        component: children[i],
        containerIndex: i,
      });
    }
  }
  return { children, matches };
}

function getChildRef(
  roots: RawComponent[],
  isTarget: ChildPredicate,
  index: number,
): IndexedChildRef | null {
  const { matches } = collectChildren(roots, isTarget);
  return matches[index] ?? null;
}

function removeChildAt(
  roots: RawComponent[],
  isTarget: ChildPredicate,
  index: number,
): boolean {
  const { children, matches } = collectChildren(roots, isTarget);
  const target = matches[index];
  if (!target) return false;
  children.splice(target.containerIndex, 1);
  return true;
}

function replaceChildAt(
  roots: RawComponent[],
  isTarget: ChildPredicate,
  index: number,
  replacement: RawComponent,
): boolean {
  const { children, matches } = collectChildren(roots, isTarget);
  const target = matches[index];
  if (!target) return false;
  children[target.containerIndex] = replacement;
  return true;
}

function moveChildAt(
  roots: RawComponent[],
  isTarget: ChildPredicate,
  from: number,
  to: number,
): boolean {
  const { children, matches } = collectChildren(roots, isTarget);
  const fromMatch = matches[from];
  if (!fromMatch) return false;

  const [removed] = children.splice(fromMatch.containerIndex, 1);

  if (to >= matches.length - 1) {
    // Moving past the end — insert at the end of the array
    children.push(removed);
  } else {
    // Find the new target position after the splice
    let insertIndex = 0;
    let kindCount = 0;
    for (let i = 0; i < children.length; i++) {
      if (isTarget(children[i])) {
        if (kindCount === to) {
          insertIndex = i;
          break;
        }
        kindCount++;
      }
    }
    children.splice(insertIndex, 0, removed);
  }

  return true;
}

// --- Sections ---------------------------------------------------------------

const isSectionChild: ChildPredicate = (c) => isSection(c);

/** Returns all top-level Section components with their indices. */
export function getSections(roots: RawComponent[]): SectionRef[] {
  return collectChildren(roots, isSectionChild).matches as SectionRef[];
}

/** Returns a single Section by its section-index, or null if not found. */
export function getSection(roots: RawComponent[], index: number): SectionRef | null {
  return getChildRef(roots, isSectionChild, index) as SectionRef | null;
}

/** Removes a Section by its section-index. Returns true if removed. */
export function removeSection(roots: RawComponent[], index: number): boolean {
  return removeChildAt(roots, isSectionChild, index);
}

/**
 * Replaces a Section in-place by its section-index.
 * Returns true if replaced.
 */
export function replaceSection(
  roots: RawComponent[],
  index: number,
  replacement: RawComponent,
): boolean {
  return replaceChildAt(roots, isSectionChild, index, replacement);
}

/** Moves a Section from one section-index to another. Returns true if moved. */
export function moveSection(roots: RawComponent[], from: number, to: number): boolean {
  return moveChildAt(roots, isSectionChild, from, to);
}

// --- Separators -------------------------------------------------------------

const isSeparatorChild: ChildPredicate = (c) => isSeparator(c);

/** Returns all top-level Separator components with their indices. */
export function getSeparators(roots: RawComponent[]): SeparatorRef[] {
  return collectChildren(roots, isSeparatorChild).matches as SeparatorRef[];
}

/** Returns a single Separator by its separator-index, or null if not found. */
export function getSeparator(roots: RawComponent[], index: number): SeparatorRef | null {
  return getChildRef(roots, isSeparatorChild, index) as SeparatorRef | null;
}

/** Removes a Separator by its separator-index. Returns true if removed. */
export function removeSeparator(roots: RawComponent[], index: number): boolean {
  return removeChildAt(roots, isSeparatorChild, index);
}

/** Replaces a Separator in-place by its separator-index. Returns true if replaced. */
export function replaceSeparator(
  roots: RawComponent[],
  index: number,
  replacement: RawComponent,
): boolean {
  return replaceChildAt(roots, isSeparatorChild, index, replacement);
}

/** Moves a Separator from one separator-index to another. Returns true if moved. */
export function moveSeparator(roots: RawComponent[], from: number, to: number): boolean {
  return moveChildAt(roots, isSeparatorChild, from, to);
}

// --- TextDisplays -----------------------------------------------------------

const isTextDisplayChild: ChildPredicate = (c) => isTextDisplay(c);

/** Returns all top-level TextDisplay components with their indices. */
export function getTextDisplays(roots: RawComponent[]): TextDisplayRef[] {
  return collectChildren(roots, isTextDisplayChild).matches as TextDisplayRef[];
}

/** Returns a single TextDisplay by its index, or null if not found. */
export function getTextDisplay(roots: RawComponent[], index: number): TextDisplayRef | null {
  return getChildRef(roots, isTextDisplayChild, index) as TextDisplayRef | null;
}

/** Removes a TextDisplay by its index. Returns true if removed. */
export function removeTextDisplay(roots: RawComponent[], index: number): boolean {
  return removeChildAt(roots, isTextDisplayChild, index);
}

/** Replaces a TextDisplay in-place by its index. Returns true if replaced. */
export function replaceTextDisplay(
  roots: RawComponent[],
  index: number,
  replacement: RawComponent,
): boolean {
  return replaceChildAt(roots, isTextDisplayChild, index, replacement);
}

/** Moves a TextDisplay from one index to another. Returns true if moved. */
export function moveTextDisplay(roots: RawComponent[], from: number, to: number): boolean {
  return moveChildAt(roots, isTextDisplayChild, from, to);
}

// --- MediaGalleries ---------------------------------------------------------

const isMediaGalleryChild: ChildPredicate = (c) => isMediaGallery(c);

/** Returns all top-level MediaGallery components with their indices. */
export function getMediaGalleries(roots: RawComponent[]): MediaGalleryRef[] {
  return collectChildren(roots, isMediaGalleryChild).matches as MediaGalleryRef[];
}

/** Returns a single MediaGallery by its index, or null if not found. */
export function getMediaGallery(roots: RawComponent[], index: number): MediaGalleryRef | null {
  return getChildRef(roots, isMediaGalleryChild, index) as MediaGalleryRef | null;
}

/** Removes a MediaGallery by its index. Returns true if removed. */
export function removeMediaGallery(roots: RawComponent[], index: number): boolean {
  return removeChildAt(roots, isMediaGalleryChild, index);
}

/** Replaces a MediaGallery in-place by its index. Returns true if replaced. */
export function replaceMediaGallery(
  roots: RawComponent[],
  index: number,
  replacement: RawComponent,
): boolean {
  return replaceChildAt(roots, isMediaGalleryChild, index, replacement);
}

/** Moves a MediaGallery from one index to another. Returns true if moved. */
export function moveMediaGallery(roots: RawComponent[], from: number, to: number): boolean {
  return moveChildAt(roots, isMediaGalleryChild, from, to);
}

// --- ActionRows -------------------------------------------------------------

const isActionRowChild: ChildPredicate = (c) => isActionRow(c);

/** Returns all top-level ActionRow components with their indices. */
export function getActionRows(roots: RawComponent[]): ActionRowRef[] {
  return collectChildren(roots, isActionRowChild).matches as ActionRowRef[];
}

/** Returns a single ActionRow by its index, or null if not found. */
export function getActionRow(roots: RawComponent[], index: number): ActionRowRef | null {
  return getChildRef(roots, isActionRowChild, index) as ActionRowRef | null;
}

/** Removes an ActionRow by its index. Returns true if removed. */
export function removeActionRow(roots: RawComponent[], index: number): boolean {
  return removeChildAt(roots, isActionRowChild, index);
}

/** Replaces an ActionRow in-place by its index. Returns true if replaced. */
export function replaceActionRow(
  roots: RawComponent[],
  index: number,
  replacement: RawComponent,
): boolean {
  return replaceChildAt(roots, isActionRowChild, index, replacement);
}

/** Moves an ActionRow from one index to another. Returns true if moved. */
export function moveActionRow(roots: RawComponent[], from: number, to: number): boolean {
  return moveChildAt(roots, isActionRowChild, from, to);
}
