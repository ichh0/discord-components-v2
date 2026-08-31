import { ButtonStyle } from "discord-api-types/v10";
import type { RawComponent } from "../core/constants";
import { parseEmoji } from "../core/emoji";
import {
  getChildren,
  hasCustomId,
  isActionRow,
  isAnySelect,
  isButton,
  isChannelSelect,
  isContainer as isContainerNode,
  isInteractive,
  isMentionableSelect,
  isRoleSelect,
  isSection,
  isStringSelect,
  isTextDisplay,
  isUserSelect,
} from "../core/guards";
import { findComponents, walkComponents, type ComponentRef } from "../core/walk";
import { matchesSelector, type ComponentSelector } from "../core/selector";

/**
 * In-place editing operations over an owned array of raw components.
 *
 * "Owned" means: the caller must be free to mutate the array and its nodes
 * (e.g. data produced by `normalizeComponents`, a `V2Builder` or a
 * `ComponentsEditor`). These functions never clone — cloning is the
 * responsibility of the wrapper APIs (`editComponents`, `V2Builder.parse`).
 *
 * Indexed container-child management (get/remove/replace/move by kind) lives
 * in `./kinds`; everything here is selector-driven or whole-tree as opposed
 * to kind-indexed.
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

/** Select-menu kinds, readable names matched by {@link SelectMenuMatchOptions.type}. */
export type SelectMenuType = "string" | "user" | "role" | "channel" | "mentionable";

export interface SelectMenuMatchOptions {
  /** Restrict to these select kinds. Omit to match every select menu. */
  type?: SelectMenuType | SelectMenuType[];
  /** Restrict to these custom_ids. Omit to match every select of the given kinds. */
  customIds?: string | string[];
}

const SELECT_GUARDS: Record<SelectMenuType, (c: RawComponent) => boolean> = {
  string: isStringSelect,
  user: isUserSelect,
  role: isRoleSelect,
  channel: isChannelSelect,
  mentionable: isMentionableSelect,
};

/** True when the component is a select menu matching `type` and/or `custom_ids`. */
export function matchesSelectMenu(
  component: RawComponent,
  options?: SelectMenuMatchOptions,
): boolean {
  if (!isAnySelect(component)) return false;

  const types = options?.type
    ? Array.isArray(options.type)
      ? options.type
      : [options.type]
    : null;
  if (types && !types.some((t) => SELECT_GUARDS[t](component))) return false;

  const ids = options?.customIds
    ? Array.isArray(options.customIds)
      ? options.customIds
      : [options.customIds]
    : null;
  if (ids) {
    const cid = (component as { custom_id?: unknown }).custom_id;
    if (typeof cid !== "string" || !ids.includes(cid)) return false;
  }

  return true;
}

/**
 * Removes every select menu matching `type` and/or `custom_ids`.
 * Selection menus live in action rows; rows left empty are pruned automatically.
 */
export function removeSelectMenus(
  roots: RawComponent[],
  options?: SelectMenuMatchOptions,
): RawComponent[] {
  return removeComponents(roots, (c) => matchesSelectMenu(c, options));
}

/**
 * Clears the previously chosen values of matching select menus so the same
 * menu can be triggered again: `default_values` is dropped from
 * user/role/channel/mentionable selects and every string-select option is
 * un-checked (`default` removed). Disabled state is left untouched.
 */
export function clearSelectValues(
  roots: RawComponent[],
  options?: SelectMenuMatchOptions,
): RawComponent[] {
  walkComponents(roots, ({ component }) => {
    if (!matchesSelectMenu(component, options)) return;
    const menu = component as { default_values?: unknown; options?: unknown[] };
    if ("default_values" in menu) delete menu.default_values;
    if (Array.isArray(menu.options)) {
      for (const opt of menu.options) {
        if (opt && typeof opt === "object" && "default" in opt) {
          delete (opt as { default?: boolean }).default;
        }
      }
    }
  });
  return roots;
}

/** Returns every select menu matching `type` and/or `custom_ids` (walking nested rows). */
export function getSelectMenus(
  roots: RawComponent[],
  options?: SelectMenuMatchOptions,
): RawComponent[] {
  const out: RawComponent[] = [];
  walkComponents(roots, ({ component }) => {
    if (matchesSelectMenu(component, options)) out.push(component);
  });
  return out;
}

/** Returns the first select menu matching `type` and/or `custom_ids`, or null. */
export function findSelectMenu(
  roots: RawComponent[],
  options?: SelectMenuMatchOptions,
): RawComponent | null {
  return getSelectMenus(roots, options)[0] ?? null;
}

/** Replaces the first select menu matching `options` with `replacement` in place. */
export function replaceSelectMenu(
  roots: RawComponent[],
  options: SelectMenuMatchOptions,
  replacement: RawComponent,
): RawComponent[] {
  const ref = findComponents(roots, (c) => matchesSelectMenu(c, options))[0];
  if (!ref) throw new Error(`replaceSelectMenu: no select menu matched the options`);
  if (ref.kind === "root") {
    const i = roots.indexOf(ref.component);
    if (i !== -1) roots[i] = replacement;
  } else if (ref.siblings) {
    const i = ref.siblings.indexOf(ref.component);
    if (i !== -1) ref.siblings[i] = replacement;
  }
  return roots;
}

/** Enables/disables matching select menus. */
export function setSelectDisabled(
  roots: RawComponent[],
  options?: SelectMenuMatchOptions,
  disabled = true,
): RawComponent[] {
  walkComponents(roots, ({ component }) => {
    if (matchesSelectMenu(component, options)) {
      (component as { disabled?: boolean }).disabled = disabled;
    }
  });
  return roots;
}

/** Friendly option shape accepted by {@link setSelectOptions}. */
export interface SelectOptionInput {
  label: string;
  value: string;
  description?: string;
  /** Accepts "👍", ":name:", "<:name:id>", "<a:name:id>". */
  emoji?: string;
  default?: boolean;
}

/** Replaces the options of a string select found by custom_id. */
export function setSelectOptions(
  roots: RawComponent[],
  customId: string,
  options: SelectOptionInput[],
): RawComponent[] {
  const select = findSelectMenu(roots, { customIds: customId });
  if (!select || !isStringSelect(select)) {
    throw new Error(`setSelectOptions: string select with custom_id "${customId}" not found`);
  }
  select.options = options.map((opt) => ({
    label: opt.label,
    value: opt.value,
    default: opt.default ?? false,
    ...(opt.description ? { description: opt.description } : {}),
    ...(opt.emoji ? { emoji: parseEmoji(opt.emoji) } : {}),
  }));
  return roots;
}

/** Sets (or removes, when `undefined`) the placeholder of a select by custom_id. */
export function setSelectPlaceholder(
  roots: RawComponent[],
  customId: string,
  placeholder?: string,
): RawComponent[] {
  const select = mustSelect(roots, customId, "setSelectPlaceholder");
  if (placeholder !== undefined) {
    (select as { placeholder?: string }).placeholder = placeholder;
  } else {
    delete (select as { placeholder?: string }).placeholder;
  }
  return roots;
}

/** Sets (or removes, when `undefined`) the min/max values of a select by custom_id. */
export function setSelectMinMaxValues(
  roots: RawComponent[],
  customId: string,
  min?: number,
  max?: number,
): RawComponent[] {
  const select = mustSelect(roots, customId, "setSelectMinMaxValues");
  if (min === undefined) {
    delete (select as { min_values?: number }).min_values;
  } else {
    (select as { min_values?: number }).min_values = min;
  }
  if (max === undefined) {
    delete (select as { max_values?: number }).max_values;
  } else {
    (select as { max_values?: number }).max_values = max;
  }
  return roots;
}

function mustSelect(
  roots: RawComponent[],
  customId: string,
  caller: string,
): RawComponent {
  const select = findSelectMenu(roots, { customIds: customId });
  if (!select) throw new Error(`${caller}: select with custom_id "${customId}" not found`);
  return select;
}

// --- Buttons ---------------------------------------------------------------

/** Changes the style of a button found by custom_id, keeping the payload valid. */
export function setButtonStyle(
  roots: RawComponent[],
  customId: string,
  style: number,
): RawComponent[] {
  const ref = findFirstButton(roots, customId);
  if (!ref) throw new Error(`setButtonStyle: button with custom_id "${customId}" not found`);
  const btn = ref.component as { style: number; custom_id?: string; url?: string };
  btn.style = style;
  if (style === ButtonStyle.Link) {
    delete btn.custom_id; // link buttons must not have a custom_id
  } else {
    delete btn.url; // non-link buttons must not carry a url
  }
  return roots;
}

/** Sets (or removes, when `undefined`) the emoji of a button by custom_id. */
export function setButtonEmoji(
  roots: RawComponent[],
  customId: string,
  emoji?: string,
): RawComponent[] {
  const ref = findFirstButton(roots, customId);
  if (!ref) throw new Error(`setButtonEmoji: button with custom_id "${customId}" not found`);
  const btn = ref.component as { emoji?: unknown; custom_id?: string; url?: string; style?: number };
  if (emoji === undefined) {
    delete btn.emoji;
  } else {
    btn.emoji = parseEmoji(emoji) as unknown;
  }
  return roots;
}

/**
 * Sets the target URL of a button by custom_id. Setting a URL converts the
 * button into a Link button (custom_id removed); `undefined` removes the URL.
 */
export function setButtonUrl(
  roots: RawComponent[],
  customId: string,
  url?: string,
): RawComponent[] {
  const ref = findFirstButton(roots, customId);
  if (!ref) throw new Error(`setButtonUrl: button with custom_id "${customId}" not found`);
  const btn = ref.component as {
    style?: number;
    url?: string;
    custom_id?: string;
  };
  if (url === undefined) {
    delete btn.url;
  } else {
    btn.url = url;
    btn.style = ButtonStyle.Link;
    delete btn.custom_id;
  }
  return roots;
}

/** Renames the custom_id on every matching component; throws if nothing matched. */
export function renameCustomId(
  roots: RawComponent[],
  from: string,
  to: string,
): RawComponent[] {
  let renamed = 0;
  walkComponents(roots, ({ component }) => {
    const cid = (component as { custom_id?: unknown }).custom_id;
    if (typeof cid === "string" && cid === from) {
      (component as { custom_id: string }).custom_id = to;
      renamed += 1;
    }
  });
  if (renamed === 0) {
    throw new Error(`renameCustomId: no component with custom_id "${from}"`);
  }
  return roots;
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