/**
 * V2Template — build a message skeleton once, render it many times.
 *
 * Declare "slots" with sentinel tokens, then `render()` substitutes the
 * current values — either from a freshly built skeleton or from any existing
 * message: `parse(ctx.message) → render(values) → build()`.
 *
 * ```ts
 * import { V2Template, V2Builder } from "discordjs-components-v2/lib/template";
 *
 * const tpl = new V2Template(new V2Builder()
 *   .text("{{__CONTENT}}")
 *   .buttons({ id: "next", label: "Дальше" }));
 * tpl.slot("content", "{{__CONTENT}}");
 *
 * const payload = tpl.render({ content: "Новая страница" }).build();
 * ```
 *
 * A slot registered without an explicit sentinel gets one automatically:
 * `slot("page")` → sentinel `{{page}}`. Sentinels may appear in any
 * TextDisplay content (and in the plain message content).
 */

import { walkComponents } from "./core/walk";
import { cloneDeep } from "./core/normalize";
import { isTextDisplay } from "./core/guards";
import type { RawComponent } from "./core/constants";
import { V2Builder, parseComponents } from "./builder/V2Builder";
import type { V2Payload } from "./builder/V2Builder";

/** A value a slot is rendered with. `undefined` leaves the sentinel untouched. */
export type TemplateValue = string | number | undefined;

/** Map of slot key → rendered value. Passed to {@link V2Template.render}. */
export type TemplateValues = Record<string, TemplateValue>;

export class V2Template {
  private base: V2Builder;
  private readonly slotsMap = new Map<string, string>();

  /**
   * @param input Optional base to build on: a `V2Builder`, raw components or
   *   any input accepted by {@link V2Builder.parse} (message-like objects
   *   work too).
   */
  constructor(input?: unknown) {
    this.base =
      input instanceof V2Builder ? input : input == null ? new V2Builder() : parseComponents(input);
  }

  /** Parses any components/message input into a template skeleton. */
  static parse(input: unknown): V2Template {
    return new V2Template(input);
  }

  /**
   * Registers a slot. Without an explicit sentinel one is generated
   * automatically: `slot("content")` → `{{content}}`.
   */
  slot(key: string, sentinel?: string): this {
    this.slotsMap.set(key, sentinel ?? `{{${key}}}`);
    return this;
  }

  /** Registers several slots at once (values are sentinels, not renders). */
  slots(entries: Record<string, string | undefined>): this {
    for (const [key, sentinel] of Object.entries(entries)) this.slot(key, sentinel);
    return this;
  }

  /** Sentinel token for a slot, or null when the slot is not registered. */
  sentinelOf(key: string): string | null {
    return this.slotsMap.get(key) ?? null;
  }

  /** The underlying builder skeleton. */
  get builder(): V2Builder {
    return this.base;
  }

  /** Returns every registered slot key. */
  slotKeys(): string[] {
    return [...this.slotsMap.keys()];
  }

  /**
   * Renders a fresh builder with the given slot values substituted into every
   * TextDisplay content (and the plain message content). The skeleton itself
   * is never mutated — call this as many times as you want.
   *
   * Chain the result straight into `build()` (or any builder method).
   */
  render(values: TemplateValues = {}): V2Builder {
    const payload = this.base.build();
    const roots = cloneDeep(payload.components) as RawComponent[];
    walkComponents(roots, ({ component }) => {
      if (isTextDisplay(component)) {
        component.content = this.substitute(component.content, values);
      }
    });

    const rebuilt = new V2Builder(roots);
    if (payload.content) rebuilt.content(this.substitute(payload.content, values));
    if (payload.files) {
      for (const file of payload.files) rebuilt.getAttachments().push(file);
    }
    return rebuilt;
  }

  /** Percent-agnostic sentinel replace: `{{x}}` → value wherever it appears. */
  private substitute(input: string, values: TemplateValues): string {
    let out = input;
    for (const [key, sentinel] of this.slotsMap) {
      const value = values[key];
      if (value === undefined) continue;
      out = out.split(sentinel).join(String(value));
    }
    return out;
  }

  /** Validates and returns the base skeleton's payload (no substitution). */
  build(): V2Payload {
    return this.base.build();
  }
}