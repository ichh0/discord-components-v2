import type { RawComponent } from "../core/constants";
import { ComponentType } from "../core/constants";
import { normalizeComponents } from "../core/normalize";
import type { ComponentSelector } from "../core/selector";
import { findComponent, findComponents, walkComponents, type ComponentRef } from "../core/walk";
import {
  disableButtons,
  enableButtons,
  getSection as opGetSection,
  getSections as opGetSections,
  getTextContents,
  keepOnly,
  matchesButtonIds,
  moveSection as opMoveSection,
  removeComponents,
  removeSection as opRemoveSection,
  replaceSection as opReplaceSection,
  replaceText,
  setButtonLabel,
  setDisabled,
  type SectionRef,
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
