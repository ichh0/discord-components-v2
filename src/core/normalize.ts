/**
 * Normalization utilities.
 *
 * The whole library works on plain JSON structures ("raw" components) that are
 * byte-compatible with the Discord API. This is what makes lossless parsing
 * possible: we never convert data, we only wrap it.
 *
 * Anything that quacks like a discord.js builder or a discord.js component
 * instance (i.e. exposes `toJSON()`) is accepted and converted to raw JSON.
 */

import { COMPONENT_TYPES } from "./constants";

export type WithToJSON = { toJSON(): unknown };

function hasToJSON(value: unknown): value is WithToJSON {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toJSON?: unknown }).toJSON === "function"
  );
}

/** Converts any input (builder, discord.js instance, plain object) into raw JSON. */
export function toRaw<T = Record<string, unknown>>(item: unknown): T {
  if (hasToJSON(item)) return item.toJSON() as T;
  return item as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-clones JSON-safe data. Component payloads are pure JSON, so this is
 * always safe and cheap.
 */
export function cloneDeep<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      /* fall through to JSON clone */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Deeply normalizes an arbitrary "components-like" value into a fresh array of
 * raw components that this library fully owns (safe to mutate).
 *
 * Accepted shapes:
 * - an array of components / builders / discord.js instances
 * - a single component / builder
 * - a message-like object: `{ components: [...] }` (e.g. `await ctx.fetchReply()`,
 *   a discord.js Message instance, or its raw JSON — bare or wrapped in an array)
 */
export function normalizeComponents(input: unknown): import("./constants").RawComponent[] {
  let list: unknown[];

  if (Array.isArray(input)) {
    // An array may mix real components with whole message objects (e.g.
    // `[await ctx.fetchReply()]`). Unwrap any message-like element so the
    // message itself never leaks into the payload as a fake root component.
    list = [];
    for (const item of input) {
      const raw = toRaw<Record<string, unknown> | null | undefined>(item);
      if (isRecord(raw) && isMessageLike(raw)) {
        list.push(...(raw.components as unknown[]));
      } else {
        list.push(item);
      }
    }
  } else if (isRecord(toRaw(input))) {
    const raw = toRaw<Record<string, unknown>>(input);
    if (isMessageLike(raw)) {
      // Message-like object. A fetched Message has BOTH a numeric `type`
      // (a *message* type such as 20) and a `components` array, so we must
      // unwrap it instead of treating it as one giant component.
      list = raw.components as unknown[];
    } else {
      list = [input];
    }
  } else if (input === undefined || input === null) {
    list = [];
  } else {
    list = [input];
  }

  const roots: Record<string, unknown>[] = [];
  for (const item of list) {
    const raw = toRaw<Record<string, unknown> | null | undefined>(item);
    if (!isRecord(raw)) continue;
    // Drop junk entries (e.g. `{}`): every payload component must carry a
    // numeric type known to the Discord API.
    if (!hasComponentType(raw)) continue;
    // Clone before normalizing so caller-owned data is never mutated.
    roots.push(deepNormalizeComponent(cloneDeep(raw)));
  }
  return roots as unknown as import("./constants").RawComponent[];
}

/** True when `type` is a real component type (not e.g. a message type like 20). */
export function hasComponentType(value: Record<string, unknown>): boolean {
  return typeof value.type === "number" && COMPONENT_TYPES.has(value.type);
}

/**
 * Message-like object: carries a `components` array but is NOT itself a
 * component (no valid component `type`). Matches both camelCase discord.js
 * JSON and snake_case raw API payloads.
 */
function isMessageLike(raw: Record<string, unknown>): boolean {
  return Array.isArray(raw.components) && !hasComponentType(raw);
}

/** Recursively normalizes nested children/accessories of a raw component. */
function deepNormalizeComponent(component: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(component.components)) {
    component.components = component.components
      .map((child) => toRaw<Record<string, unknown> | null | undefined>(child))
      .filter(isRecord)
      .map(deepNormalizeComponent);
  }
  if (isRecord(component.accessory)) {
    component.accessory = deepNormalizeComponent(
      toRaw<Record<string, unknown>>(component.accessory),
    );
  }
  return component;
}
