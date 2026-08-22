import type { RawComponent } from "./constants";
import { hasCustomId, isTextDisplay, isButton } from "./guards";

/**
 * Unified selector used by every search/removal utility:
 * - `"my_id"`        — exact `custom_id` match
 * - `ComponentType`  — exact component type match
 * - `/regex/`        — tested against custom_id, label and text content
 * - function         — full custom predicate
 */
export type ComponentSelector =
  | string
  | number
  | RegExp
  | ((component: RawComponent) => boolean);

export function matchesSelector(component: RawComponent, selector: ComponentSelector): boolean {
  if (typeof selector === "function") return selector(component);

  if (typeof selector === "string") {
    return hasCustomId(component) && component.custom_id === selector;
  }

  if (typeof selector === "number") {
    return component.type === selector;
  }

  // RegExp — test against the most meaningful textual fields.
  const haystack = [
    hasCustomId(component) ? component.custom_id : null,
    isButton(component) && typeof (component as { label?: unknown }).label === "string"
      ? (component as { label: string }).label
      : null,
    isTextDisplay(component) ? component.content : null,
  ]
    .filter((v): v is string => v !== null)
    .join("\n");

  return haystack.length > 0 && selector.test(haystack);
}
