/**
 * Rare, whole-tree manipulations that are deliberately kept off the main
 * surface. Import from `discordjs-components-v2/lib/advanced`.
 *
 * ```ts
 * import { keepOnly, moveByKind } from "discordjs-components-v2/lib/advanced";
 * ```
 *
 * These operate in place on an owned array of raw components ("owned" = the
 * caller is free to mutate it, e.g. data produced by `normalizeComponents` or
 * `editComponents(...).toJSON()`).
 */

import type { RawComponent } from "./core/constants";
import { getChildren, isActionRow, isContainer, isSection } from "./core/guards";
import type { ComponentSelector } from "./core/selector";
import { matchesSelector } from "./core/selector";

export { moveByKind } from "./edit/kinds";
export type { ComponentKind, IndexedChildRef, KindTarget } from "./edit/kinds";

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

    if (isContainer(item)) {
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