import type { RawComponent } from "./constants";
import { getChildren, isSection } from "./guards";
import { matchesSelector, type ComponentSelector } from "./selector";

/**
 * A reference to a component inside a tree. Holds everything needed to read,
 * mutate, replace or remove the component without keeping any external cache:
 * the tree itself (the raw JSON) is the only source of truth.
 */
export interface ComponentRef {
  /** The raw component node. Mutate it in place to change the message. */
  component: RawComponent;
  /**
   * The array that holds this component (siblings). `null` for section
   * accessories, which are stored as a single object, not an array item.
   */
  siblings: RawComponent[] | null;
  /** Parent component, or null for roots. */
  parent: RawComponent | null;
  /** Index within `siblings` (-1 for accessories). */
  index: number;
  /** Index path from the root array down to this component. */
  path: number[];
  /** How the component is attached to its parent. */
  kind: "root" | "child" | "accessory";
}

/**
 * Depth-first pre-order traversal of a components tree.
 * Visits action rows, containers and sections children as well as
 * section accessories (buttons/thumbnails), so utilities like
 * "disable all buttons" catch every interactive element.
 */
export function walkComponents(
  roots: RawComponent[],
  visit: (ref: ComponentRef) => void,
): void {
  const visitList = (
    list: RawComponent[],
    parent: RawComponent | null,
    basePath: number[],
    kind: ComponentRef["kind"],
  ): void => {
    list.forEach((component, index) => {
      visit({ component, siblings: list, parent, index, path: [...basePath, index], kind });

      const children = getChildren(component);
      if (children) {
        visitList(children, component, [...basePath, index], "child");
      }
      if (isSection(component) && component.accessory) {
        const accessory = component.accessory as RawComponent;
        visit({
          component: accessory,
          siblings: null,
          parent: component,
          index: -1,
          path: [...basePath, index],
          kind: "accessory",
        });
      }
    });
  };

  visitList(roots, null, [], "root");
}

/** Finds every component matching the selector, with full parent context. */
export function findComponents(roots: RawComponent[], selector: ComponentSelector): ComponentRef[] {
  const refs: ComponentRef[] = [];
  walkComponents(roots, (ref) => {
    if (matchesSelector(ref.component, selector)) refs.push(ref);
  });
  return refs;
}

/** Finds the first component matching the selector. */
export function findComponent(
  roots: RawComponent[],
  selector: ComponentSelector,
): ComponentRef | null {
  return findComponents(roots, selector)[0] ?? null;
}

/** Total number of nodes in the tree (roots + nested + accessories). */
export function countComponents(roots: RawComponent[]): number {
  let total = 0;
  walkComponents(roots, () => {
    total += 1;
  });
  return total;
}
