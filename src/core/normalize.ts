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
 * - a message-like object: `{ components: [...] }` (e.g. a fetched Message)
 */
export function normalizeComponents(input: unknown): import("./constants").RawComponent[] {
  let list: unknown[];

  if (Array.isArray(input)) {
    list = input;
  } else if (isRecord(input) && Array.isArray(input.components)) {
    // Message-like object. If it is itself a component (e.g. a container),
    // treat it as a single root instead of unwrapping.
    if ("type" in input) {
      list = [input];
    } else {
      list = input.components;
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
    // Clone before normalizing so caller-owned data is never mutated.
    roots.push(deepNormalizeComponent(cloneDeep(raw)));
  }
  return roots as unknown as import("./constants").RawComponent[];
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
