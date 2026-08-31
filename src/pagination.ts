/**
 * V2Paginator — multi-page CV2 messages with zero per-instance cache.
 *
 * Built on top of {@link V2Template}. Each page is a template (or a slot map
 * applied to a shared template); the paginator appends one action row of
 * page buttons (`pageButton: "pag"` → `pag:0`, `pag:1`, ...) and re-renders
 * on click. The current page is read straight from the message being edited,
 * so the handler needs no state:
 *
 * ```ts
 * import { V2Template, V2Builder } from "discordjs-components-v2/lib/template";
 * import { V2Paginator } from "discordjs-components-v2/lib/pagination";
 *
 * const tpl = new V2Template(new V2Builder().text("{{content}}")); // .slot("content")
 * const pages = new V2Paginator({
 *   template: tpl,
 *   pages: [{ content: "Страница 1" }, { content: "Страница 2" }],
 *   pageButton: "pag",
 * });
 *
 * // interaction handler:
 * if (await pages.jump(ctx)) return; // handles update()/editReply() itself
 * ```
 */

import {
  ButtonStyle,
  ComponentType,
  type APIComponentInMessageActionRow,
} from "discord-api-types/v10";
import type { RawComponent } from "./core/constants";
import { walkComponents } from "./core/walk";
import { V2Template, type TemplateValue } from "./template";
import type { V2Builder } from "./builder/V2Builder";
import type { V2Payload } from "./builder/V2Builder";

/** A single page: a ready template, or slot values for the shared template. */
export type V2PageInput = V2Template | Record<string, TemplateValue>;

export interface V2PaginatorOptions {
  /** Shared layout — required when `pages` entries are slot-value maps. */
  template?: V2Template;
  /** One entry per page, in order. */
  pages: V2PageInput[];
  /** custom_id prefix for the page buttons, e.g. `"pag"` → `pag:0`, `pag:1`. */
  pageButton: string;
  /** Page-button labels (default: "1", "2", ...). */
  pageLabel?: (index: number, total: number) => string;
}

/** Anything that looks like a discord.js / discordx interaction with `customId`. */
export interface PaginatorInteraction {
  customId?: unknown;
  deferred?: boolean;
  message?: unknown;
  update?(payload: unknown): unknown | Promise<unknown>;
  editReply?(payload: unknown): unknown | Promise<unknown>;
  reply?(payload: unknown): unknown | Promise<unknown>;
}

const MAX_PAGE_BUTTONS = 5; // one action row

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class V2Paginator {
  readonly size: number;

  constructor(private readonly options: V2PaginatorOptions) {
    this.size = options.pages.length;
    if (this.size === 0) throw new Error("V2Paginator: at least one page is required");
    if (this.size > MAX_PAGE_BUTTONS) {
      throw new Error(
        `V2Paginator: at most ${MAX_PAGE_BUTTONS} pages fit in one action row, got ${this.size}`,
      );
    }
  }

  /** The button custom_id prefix (`pageButton:0`, `pageButton:1`, ...). */
  get pageButton(): string {
    return this.options.pageButton;
  }

  private renderEntry(page: number): V2Builder {
    const entry = this.options.pages[page];
    if (entry instanceof V2Template) return entry.render({});
    if (this.options.template) {
      return this.options.template.render(entry as Record<string, TemplateValue>);
    }
    throw new Error(
      "V2Paginator: pages are slot maps but no shared `template` was provided",
    );
  }

  /**
   * Renders page `page` as a full send payload: the page content plus the
   * pagination action row (current page highlighted and disabled).
   */
  render(page: number): V2Payload {
    if (!Number.isInteger(page) || page < 0 || page >= this.size) {
      throw new Error(`V2Paginator: page ${page} is out of range (0..${this.size - 1})`);
    }

    const builder = this.renderEntry(page);
    const label = this.options.pageLabel ?? ((i: number) => String(i + 1));
    const buttons: APIComponentInMessageActionRow[] = [];
    for (let i = 0; i < this.size; i++) {
      buttons.push({
        type: ComponentType.Button,
        style: i === page ? ButtonStyle.Primary : ButtonStyle.Secondary,
        custom_id: `${this.pageButton}:${i}`,
        label: label(i, this.size),
        disabled: i === page,
      });
    }
    builder.toJSON().components.push({
      type: ComponentType.ActionRow,
      components: buttons,
    });
    return builder.build();
  }

  /**
   * Handles a page-button interaction: reads the custom_id, works out the
   * requested page (numbered buttons, plus `pag:prev`/`pag:next`), renders it
   * and replies with `update()` / `editReply()` / `reply()`.
   *
   * @param ctx A discordx `CommandContext` (`ctx.interaction`) or any
   *   interaction-like object with `customId`.
   * @returns `true` when the custom_id belonged to this paginator and was
   *   handled; `false` when it should be ignored by the caller.
   */
  async jump(ctx: PaginatorInteraction | { interaction?: PaginatorInteraction }): Promise<boolean> {
    const interaction: PaginatorInteraction =
      "interaction" in ctx && ctx.interaction ? ctx.interaction : (ctx as PaginatorInteraction);

    const customId = interaction.customId;
    if (typeof customId !== "string") return false;

    const prefix = `${this.pageButton}:`;
    if (!customId.startsWith(prefix)) return false;
    const part = customId.slice(prefix.length);

    const current = this.currentFromMessage(interaction.message) ?? 0;

    let target: number;
    if (part === "prev") target = current - 1;
    else if (part === "next") target = current + 1;
    else {
      const parsed = Number.parseInt(part, 10);
      if (Number.isNaN(parsed)) return false;
      target = parsed;
    }

    if (target < 0 || target >= this.size || target === current) return false;

    const payload = this.render(target);

    if (typeof interaction.update === "function" && !interaction.deferred) {
      await interaction.update(payload);
      return true;
    }
    if (typeof interaction.editReply === "function") {
      await interaction.editReply(payload);
      return true;
    }
    if (typeof interaction.reply === "function") {
      await interaction.reply(payload);
      return true;
    }
    throw new Error("V2Paginator.jump(): unsupported interaction target");
  }

  /**
   * Finds the currently disabled (= shown) page button inside a message, or
   * null when there is none. This is what keeps the paginator cache-less —
   * the payload itself is the source of truth.
   */
  currentFromMessage(message: unknown): number | null {
    if (!message || typeof message !== "object") return null;
    const components = (message as { components?: unknown }).components;
    if (!Array.isArray(components)) return null;

    const regex = new RegExp(`^${escapeRegExp(this.pageButton)}:(\\d+)$`);
    let seen: number | null = null;
    walkComponents(components as RawComponent[], ({ component }) => {
      if (component.type !== ComponentType.Button) return;
      const cid = (component as { custom_id?: unknown }).custom_id;
      if (typeof cid !== "string") return;
      const match = regex.exec(cid);
      if (!match) return;
      const index = Number.parseInt(match[1], 10);
      if ((component as { disabled?: boolean }).disabled) {
        seen = index;
      } else if (seen === null) {
        seen = index;
      }
    });
    return seen;
  }
}