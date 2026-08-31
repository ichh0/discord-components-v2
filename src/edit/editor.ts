import type { RawComponent } from "../core/constants";
import { normalizeComponents } from "../core/normalize";
import type { ComponentSelector } from "../core/selector";
import { findComponent, findComponents, walkComponents, type ComponentRef } from "../core/walk";
import {
  clearSelectValues,
  disableButtons,
  enableButtons,
  findSelectMenu,
  getSelectMenus,
  getTextContents,
  matchesButtonIds,
  removeComponents,
  removeSelectMenus,
  renameCustomId,
  replaceSelectMenu,
  replaceText,
  setButtonEmoji,
  setButtonLabel,
  setButtonStyle,
  setButtonUrl,
  setDisabled,
  setSelectDisabled,
  setSelectMinMaxValues,
  setSelectOptions,
  setSelectPlaceholder,
  type SelectMenuMatchOptions,
  type SelectOptionInput,
} from "./operations";
import {
  coerceKindValue,
  getAllByKind,
  getByKind,
  isComponentKind,
  kindGroup as kindGroupFactory,
  moveByKind,
  removeByKind,
  replaceByKind,
  type ComponentKind,
  type IndexedChildRef,
  type KindTarget,
} from "./kinds";

function kindTarget(kindOrTarget: ComponentKind | KindTarget, index?: number): KindTarget {
  if (typeof kindOrTarget === "string") return { kind: kindOrTarget, index: index as number };
  return kindOrTarget;
}

/**
 * Chainable editor over an array of raw components.
 *
 * This is the "no-cache" tool: take the components straight from
 * `interaction.fetchReply()` / `message.components`, edit them and send back.
 *
 * ```ts
 * const payload = editComponents(await interaction.fetchReply())
 *   .disableButtons()
 *   .setButtonLabel("join", "Голосовать")
 *   .replaceText("Приз", "Награда")
 *   .toJSON();
 *
 * await interaction.editReply({ components: payload, flags });
 * ```
 *
 * Indexed access to container children is kind-based: either the generic
 * methods (`remove({ kind: "section", index: 1 })`) or the per-kind
 * namespaces (`editor.sections.remove(1)`, `editor.textDisplays.set(2, "hi")`).
 */
export class ComponentsEditor {
  private roots: RawComponent[];

  private constructor(roots: RawComponent[]) {
    this.roots = roots;
  }

  /**
   * Accepts raw component arrays, single components, message-like objects
   * (`{ components }`) or anything with `toJSON()` (discord.js builders /
   * fetched message components). The input is normalized AND deep-cloned —
   * the original data is never mutated.
   */
  static from(input: unknown): ComponentsEditor {
    return new ComponentsEditor(normalizeComponents(input));
  }

  /** Enables/disables all buttons (optionally restricted by custom_id list). */
  disableButtons(customIds?: string | string[]): this {
    disableButtons(this.roots, { customIds, disabled: true });
    return this;
  }

  enableButtons(customIds?: string | string[]): this {
    enableButtons(this.roots, customIds);
    return this;
  }

  /** Enables/disables every interactive component matching the selector. */
  setDisabled(selector: ComponentSelector, disabled = true): this {
    setDisabled(this.roots, selector, disabled);
    return this;
  }

  /** Updates a button label found by custom_id. */
  setButtonLabel(customId: string, label: string): this {
    setButtonLabel(this.roots, customId, label);
    return this;
  }

  /** Replaces text inside all TextDisplay components. */
  replaceText(
    search: string | RegExp,
    replacement: string | ((substring: string, ...args: unknown[]) => string),
  ): this {
    replaceText(this.roots, search, replacement);
    return this;
  }

  /**
   * Removes matching components. Accepts:
   * - a selector (`"pick"`, `ComponentType`, regex, predicate),
   * - a kind target (`remove({ kind: "section", index: 1 })`),
   * - a kind + index pair (`remove("section", 1)`).
   *
   * Removing a section accessory removes the whole Section; empty action rows
   * are pruned automatically.
   */
  remove(target: KindTarget): this;
  remove(kind: ComponentKind, index: number): this;
  remove(selector: ComponentSelector): this;
  remove(
    kindOrTargetOrSelector: ComponentKind | KindTarget | ComponentSelector,
    maybeIndex?: number,
  ): this {
    const arg = kindOrTargetOrSelector;
    if (typeof arg === "string" && isComponentKind(arg) && typeof maybeIndex === "number") {
      removeByKind(this.roots, arg, maybeIndex);
      return this;
    }
    if (
      arg !== null &&
      typeof arg === "object" &&
      "kind" in arg &&
      "index" in arg &&
      isComponentKind((arg as KindTarget).kind)
    ) {
      removeByKind(this.roots, (arg as KindTarget).kind, (arg as KindTarget).index);
      return this;
    }
    removeComponents(this.roots, arg as ComponentSelector);
    return this;
  }

  /** Completely removes all buttons (optionally restricted by custom_id list). */
  removeButtons(customIds?: string | string[]): this {
    removeComponents(this.roots, (c) => matchesButtonIds(c, customIds));
    return this;
  }

  /** Removes every select menu matching `type` and/or `custom_ids`. */
  removeSelectMenus(options?: SelectMenuMatchOptions): this {
    removeSelectMenus(this.roots, options);
    return this;
  }

  /**
   * Clears the chosen values of matching select menus (`default_values` /
   * string-select option `default`), so the same menu can fire again.
   */
  clearSelectValues(options?: SelectMenuMatchOptions): this {
    clearSelectValues(this.roots, options);
    return this;
  }

  /** Sets (or removes, when `undefined`) the placeholder of a select by custom_id. */
  setSelectPlaceholder(customId: string, placeholder?: string): this {
    setSelectPlaceholder(this.roots, customId, placeholder);
    return this;
  }

  /** Replaces the options of a string select found by custom_id (`emoji` as a string). */
  setSelectOptions(customId: string, options: SelectOptionInput[]): this {
    setSelectOptions(this.roots, customId, options);
    return this;
  }

  /** Sets (or removes, when `undefined`) min/max values of a select by custom_id. */
  setSelectMinMaxValues(customId: string, min?: number, max?: number): this {
    setSelectMinMaxValues(this.roots, customId, min, max);
    return this;
  }

  /** Enables/disables the matching select menus (default: disabled). */
  setSelectDisabled(options?: SelectMenuMatchOptions, disabled = true): this {
    setSelectDisabled(this.roots, options, disabled);
    return this;
  }

  /** Returns every select menu matching `type` and/or `custom_ids`. */
  getSelectMenus(options?: SelectMenuMatchOptions): RawComponent[] {
    return getSelectMenus(this.roots, options);
  }

  /** Returns the first select menu matching `type` and/or `custom_ids`, or null. */
  findSelectMenu(options?: SelectMenuMatchOptions): RawComponent | null {
    return findSelectMenu(this.roots, options);
  }

  /** Replaces the first select menu matching `options` with `replacement`. */
  replaceSelectMenu(options: SelectMenuMatchOptions, replacement: RawComponent): this {
    replaceSelectMenu(this.roots, options, replacement);
    return this;
  }

  /** Changes a button style by custom_id (keeps the payload valid). */
  setButtonStyle(customId: string, style: number): this {
    setButtonStyle(this.roots, customId, style);
    return this;
  }

  /** Sets (or removes, when `undefined`) a button emoji by custom_id. */
  setButtonEmoji(customId: string, emoji?: string): this {
    setButtonEmoji(this.roots, customId, emoji);
    return this;
  }

  /** Sets a button URL by custom_id (converts to a Link button); `undefined` removes it. */
  setButtonUrl(customId: string, url?: string): this {
    setButtonUrl(this.roots, customId, url);
    return this;
  }

  /** Renames the custom_id on every matching component; throws if nothing matched. */
  renameCustomId(from: string, to: string): this {
    renameCustomId(this.roots, from, to);
    return this;
  }

  // ------------------------------------------------------------------
  // Kind-indexed management
  // ------------------------------------------------------------------

  /** Returns every container child of the given kind (with their indices). */
  all(kind: ComponentKind): IndexedChildRef[] {
    return getAllByKind(this.roots, kind);
  }

  /** Returns one container child of the given kind, or null if not found. */
  get(target: KindTarget): IndexedChildRef | null;
  get(kind: ComponentKind, index: number): IndexedChildRef | null;
  get(kindOrTarget: ComponentKind | KindTarget, index?: number): IndexedChildRef | null {
    const t = kindTarget(kindOrTarget, index);
    return getByKind(this.roots, t.kind, t.index);
  }

  /**
   * Replaces a container child in place. Accepts a kind target + value
   * (`replace({ kind: "section", index: 1 }, node)`) or a kind + index + value
   * (`replace("textDisplay", 0, "hello")`). For `textDisplay` the value may
   * be a plain content string.
   */
  set(target: KindTarget, value: RawComponent | string): this;
  set(kind: ComponentKind, index: number, value: RawComponent | string): this;
  set(
    kindOrTarget: ComponentKind | KindTarget,
    indexOrValue: number | RawComponent | string,
    maybeValue?: RawComponent | string,
  ): this {
    if (typeof kindOrTarget === "string") {
      replaceByKind(this.roots, kindOrTarget, indexOrValue as number, coerceKindValue(kindOrTarget, maybeValue as RawComponent | string));
    } else {
      const { kind, index } = kindOrTarget;
      replaceByKind(this.roots, kind, index, coerceKindValue(kind, indexOrValue as RawComponent | string));
    }
    return this;
  }

  /** Alias for {@link set}: replaces a container child in place with a raw component. */
  replace(target: KindTarget, node: RawComponent): this;
  replace(kind: ComponentKind, index: number, node: RawComponent): this;
  replace(
    kindOrTarget: ComponentKind | KindTarget,
    indexOrNode: number | RawComponent,
    maybeNode?: RawComponent,
  ): this {
    if (typeof kindOrTarget === "string") {
      replaceByKind(this.roots, kindOrTarget, indexOrNode as number, maybeNode as RawComponent);
    } else {
      const { kind, index } = kindOrTarget;
      replaceByKind(this.roots, kind, index, indexOrNode as RawComponent);
    }
    return this;
  }

  /** Moves a container child from one kind-index to another (rare — see `lib/advanced`). */
  move(target: KindTarget, to: number): this;
  move(kind: ComponentKind, from: number, to: number): this;
  move(
    kindOrTarget: ComponentKind | KindTarget,
    fromOrTo: number,
    maybeTo?: number,
  ): this {
    if (typeof kindOrTarget === "string") {
      moveByKind(this.roots, kindOrTarget, fromOrTo, maybeTo as number);
    } else {
      const { kind, index } = kindOrTarget;
      moveByKind(this.roots, kind, index, fromOrTo);
    }
    return this;
  }

  /** Namespaced section access (`editor.sections.remove(1)`). */
  sections = kindGroupFactory<this>(this, () => this.roots, "section");
  /** Namespaced separator access (`editor.separators.all()`). */
  separators = kindGroupFactory<this>(this, () => this.roots, "separator");
  /** Namespaced text access (`editor.textDisplays.set(2, "hello")`). */
  textDisplays = kindGroupFactory<this>(this, () => this.roots, "textDisplay");
  /** Namespaced action-row access. */
  actionRows = kindGroupFactory<this>(this, () => this.roots, "actionRow");
  /** Namespaced media-gallery access. */
  mediaGalleries = kindGroupFactory<this>(this, () => this.roots, "mediaGallery");

  // ------------------------------------------------------------------

  /** First component matching the selector. */
  find(selector: ComponentSelector): ComponentRef | null {
    return findComponent(this.roots, selector);
  }

  /** All components matching the selector. */
  findAll(selector: ComponentSelector): ComponentRef[] {
    return findComponents(this.roots, selector);
  }

  /** All TextDisplay contents. */
  getTexts(): string[] {
    return getTextContents(this.roots);
  }

  /** Iterates every node in the tree. */
  each(visit: (ref: ComponentRef) => void): this {
    walkComponents(this.roots, visit);
    return this;
  }

  get length(): number {
    return this.roots.length;
  }

  /** Raw top-level components, ready for `components:` in any discord.js call. */
  toJSON(): RawComponent[] {
    return this.roots;
  }
}

/** Shorthand for `ComponentsEditor.from(...)`. */
export function editComponents(input: unknown): ComponentsEditor {
  return ComponentsEditor.from(input);
}