import type { RawComponent } from "../core/constants";
import { ComponentType } from "../core/constants";
import { normalizeComponents } from "../core/normalize";
import type { ComponentSelector } from "../core/selector";
import { findComponent, findComponents, walkComponents, type ComponentRef } from "../core/walk";
import {
  disableButtons,
  enableButtons,
  getActionRow,
  getActionRows,
  getMediaGallery,
  getMediaGalleries,
  getSection as opGetSection,
  getSections as opGetSections,
  getSeparator,
  getSeparators,
  getTextContents,
  getTextDisplay,
  getTextDisplays,
  keepOnly,
  matchesButtonIds,
  moveActionRow,
  moveMediaGallery,
  moveSection as opMoveSection,
  moveSeparator,
  moveTextDisplay,
  removeActionRow,
  removeComponents,
  removeMediaGallery,
  removeSection as opRemoveSection,
  removeSeparator,
  removeTextDisplay,
  replaceActionRow,
  replaceMediaGallery,
  replaceSection as opReplaceSection,
  replaceSeparator,
  replaceText,
  replaceTextDisplay,
  setButtonLabel,
  setDisabled,
  type ActionRowRef,
  type MediaGalleryRef,
  type SectionRef,
  type SeparatorRef,
  type TextDisplayRef,
} from "./operations";

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
   * Removes every matching component. Removing a section accessory removes the
   * whole Section; empty action rows are pruned automatically.
   */
  remove(selector: ComponentSelector): this {
    removeComponents(this.roots, selector);
    return this;
  }

  /** Removes everything that does not match (matching subtrees are kept). */
  keepOnly(selector: ComponentSelector): this {
    keepOnly(this.roots, selector);
    return this;
  }

  /** Completely removes all buttons (optionally restricted by custom_id list). */
  removeButtons(customIds?: string | string[]): this {
    removeComponents(this.roots, (c) => matchesButtonIds(c, customIds));
    return this;
  }

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

  // ------------------------------------------------------------------
  // Section management
  // ------------------------------------------------------------------

  /** Returns all top-level Section components with their indices. */
  getSections(): SectionRef[] {
    return opGetSections(this.roots);
  }

  /** Returns a single Section by its section-index, or null if not found. */
  getSection(index: number): SectionRef | null {
    return opGetSection(this.roots, index);
  }

  /** Removes a Section by its section-index. Returns true if removed. */
  removeSection(index: number): this {
    opRemoveSection(this.roots, index);
    return this;
  }

  /** Replaces a Section in-place by its section-index. Returns true if replaced. */
  replaceSection(index: number, replacement: RawComponent): this {
    opReplaceSection(this.roots, index, replacement);
    return this;
  }

  /** Moves a Section from one section-index to another. Returns true if moved. */
  moveSection(from: number, to: number): this {
    opMoveSection(this.roots, from, to);
    return this;
  }

  // ------------------------------------------------------------------
  // Separator management
  // ------------------------------------------------------------------

  /** Returns all top-level Separator components with their indices. */
  getSeparators(): SeparatorRef[] {
    return getSeparators(this.roots);
  }

  /** Returns a single Separator by its separator-index, or null if not found. */
  getSeparator(index: number): SeparatorRef | null {
    return getSeparator(this.roots, index);
  }

  /** Removes a Separator by its separator-index. Returns `this` for chaining. */
  removeSeparator(index: number): this {
    removeSeparator(this.roots, index);
    return this;
  }

  /** Replaces a Separator in-place by its separator-index. Returns `this` for chaining. */
  replaceSeparator(index: number, replacement: RawComponent): this {
    replaceSeparator(this.roots, index, replacement);
    return this;
  }

  /** Moves a Separator from one separator-index to another. Returns `this` for chaining. */
  moveSeparator(from: number, to: number): this {
    moveSeparator(this.roots, from, to);
    return this;
  }

  // ------------------------------------------------------------------
  // TextDisplay management
  // ------------------------------------------------------------------

  /** Returns all top-level TextDisplay components with their indices. */
  getTextDisplays(): TextDisplayRef[] {
    return getTextDisplays(this.roots);
  }

  /** Returns a single TextDisplay by its index, or null if not found. */
  getTextDisplay(index: number): TextDisplayRef | null {
    return getTextDisplay(this.roots, index);
  }

  /** Removes a TextDisplay by its index. Returns `this` for chaining. */
  removeTextDisplay(index: number): this {
    removeTextDisplay(this.roots, index);
    return this;
  }

  /** Replaces a TextDisplay in-place by its index. Returns `this` for chaining. */
  replaceTextDisplay(index: number, replacement: RawComponent): this {
    replaceTextDisplay(this.roots, index, replacement);
    return this;
  }

  /** Moves a TextDisplay from one index to another. Returns `this` for chaining. */
  moveTextDisplay(from: number, to: number): this {
    moveTextDisplay(this.roots, from, to);
    return this;
  }

  // ------------------------------------------------------------------
  // MediaGallery management
  // ------------------------------------------------------------------

  /** Returns all top-level MediaGallery components with their indices. */
  getMediaGalleries(): MediaGalleryRef[] {
    return getMediaGalleries(this.roots);
  }

  /** Returns a single MediaGallery by its index, or null if not found. */
  getMediaGallery(index: number): MediaGalleryRef | null {
    return getMediaGallery(this.roots, index);
  }

  /** Removes a MediaGallery by its index. Returns `this` for chaining. */
  removeMediaGallery(index: number): this {
    removeMediaGallery(this.roots, index);
    return this;
  }

  /** Replaces a MediaGallery in-place by its index. Returns `this` for chaining. */
  replaceMediaGallery(index: number, replacement: RawComponent): this {
    replaceMediaGallery(this.roots, index, replacement);
    return this;
  }

  /** Moves a MediaGallery from one index to another. Returns `this` for chaining. */
  moveMediaGallery(from: number, to: number): this {
    moveMediaGallery(this.roots, from, to);
    return this;
  }

  // ------------------------------------------------------------------
  // ActionRow management
  // ------------------------------------------------------------------

  /** Returns all top-level ActionRow components with their indices. */
  getActionRows(): ActionRowRef[] {
    return getActionRows(this.roots);
  }

  /** Returns a single ActionRow by its index, or null if not found. */
  getActionRow(index: number): ActionRowRef | null {
    return getActionRow(this.roots, index);
  }

  /** Removes an ActionRow by its index. Returns `this` for chaining. */
  removeActionRow(index: number): this {
    removeActionRow(this.roots, index);
    return this;
  }

  /** Replaces an ActionRow in-place by its index. Returns `this` for chaining. */
  replaceActionRow(index: number, replacement: RawComponent): this {
    replaceActionRow(this.roots, index, replacement);
    return this;
  }

  /** Moves an ActionRow from one index to another. Returns `this` for chaining. */
  moveActionRow(from: number, to: number): this {
    moveActionRow(this.roots, from, to);
    return this;
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
