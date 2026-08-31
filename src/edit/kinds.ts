/**
 * Kind-indexed container-child management.
 *
 * "Kinds" are the five indexable component types that live directly inside a
 * Container: TextDisplay, Section, Separator, ActionRow and MediaGallery.
 * Every concrete helper (builder methods, editor methods, standalone
 * functions) is a thin wrapper over the handful of kind-dispatched operations
 * defined here — one core, no per-kind copies.
 *
 * "Owned" means the caller must be free to mutate the array and its nodes
 * (e.g. data produced by `normalizeComponents`, a `V2Builder` or a
 * `ComponentsEditor`). These functions never clone — cloning is the
 * responsibility of the wrapper APIs (`editComponents`, `V2Builder.parse`).
 */

import type { RawComponent } from "../core/constants";
import { ComponentType } from "../core/constants";
import {
  getChildren,
  isActionRow,
  isContainer,
  isMediaGallery,
  isSection,
  isSeparator,
  isTextDisplay,
} from "../core/guards";

/** Indexable container-child kinds. */
export type ComponentKind =
  | "textDisplay"
  | "section"
  | "separator"
  | "actionRow"
  | "mediaGallery";

/** Discriminated target for kind-indexed operations: `{ kind: "section", index: 1 }`. */
export interface KindTarget {
  kind: ComponentKind;
  index: number;
}

/**
 * Position of one container child among the siblings of the same kind.
 * Each component kind (sections, separators, text blocks, ...) gets its own
 * zero-based `index`, plus the raw slot (`containerIndex`) inside the
 * container's `components` array.
 */
export interface IndexedChildRef {
  /** Index among children of the same kind only (0-based). */
  index: number;
  /** The raw component. */
  component: RawComponent;
  /** Index within the container's components array. */
  containerIndex: number;
}

const KIND_GUARDS: Record<ComponentKind, (c: RawComponent) => boolean> = {
  textDisplay: isTextDisplay,
  section: isSection,
  separator: isSeparator,
  actionRow: isActionRow,
  mediaGallery: isMediaGallery,
};

/** True when `value` is a known {@link ComponentKind} string. */
export function isComponentKind(value: unknown): value is ComponentKind {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(KIND_GUARDS, value)
  );
}

/** Maps a container-child component type to its kind, or null if not indexable. */
export function kindOfType(type: ComponentType | number): ComponentKind | null {
  switch (type) {
    case ComponentType.TextDisplay:
      return "textDisplay";
    case ComponentType.Section:
      return "section";
    case ComponentType.Separator:
      return "separator";
    case ComponentType.ActionRow:
      return "actionRow";
    case ComponentType.MediaGallery:
      return "mediaGallery";
    default:
      return null;
  }
}

/**
 * Resolves the children array to operate on.
 * If the first element is a Container, returns its `components` children.
 * Otherwise returns the array itself (it is already a children list).
 */
function resolveChildren(roots: RawComponent[]): RawComponent[] {
  if (roots.length === 1 && isContainer(roots[0])) {
    return getChildren(roots[0]) ?? [];
  }
  return roots;
}

function collect(
  roots: RawComponent[],
  kind: ComponentKind,
): { children: RawComponent[]; matches: IndexedChildRef[] } {
  const children = resolveChildren(roots);
  const matches: IndexedChildRef[] = [];
  const guard = KIND_GUARDS[kind];
  let kindIndex = 0;
  for (let i = 0; i < children.length; i++) {
    if (guard(children[i])) {
      matches.push({
        index: kindIndex++,
        component: children[i],
        containerIndex: i,
      });
    }
  }
  return { children, matches };
}

/** Returns every container child of the given kind (with their indices). */
export function getAllByKind(
  roots: RawComponent[],
  kind: ComponentKind,
): IndexedChildRef[] {
  return collect(roots, kind).matches;
}

/** Returns a single container child of the given kind, or null if not found. */
export function getByKind(
  roots: RawComponent[],
  kind: ComponentKind,
  index: number,
): IndexedChildRef | null {
  return collect(roots, kind).matches[index] ?? null;
}

/** Removes the container child at `kind`-index. Returns true if removed. */
export function removeByKind(
  roots: RawComponent[],
  kind: ComponentKind,
  index: number,
): boolean {
  const { children, matches } = collect(roots, kind);
  const target = matches[index];
  if (!target) return false;
  children.splice(target.containerIndex, 1);
  return true;
}

/** Replaces the container child at `kind`-index in place. Returns true if replaced. */
export function replaceByKind(
  roots: RawComponent[],
  kind: ComponentKind,
  index: number,
  replacement: RawComponent,
): boolean {
  const { children, matches } = collect(roots, kind);
  const target = matches[index];
  if (!target) return false;
  children[target.containerIndex] = replacement;
  return true;
}

/** Moves the container child at `from` to the `to`-th slot of its kind. Returns true if moved. */
export function moveByKind(
  roots: RawComponent[],
  kind: ComponentKind,
  from: number,
  to: number,
): boolean {
  const { children, matches } = collect(roots, kind);
  const fromMatch = matches[from];
  if (!fromMatch) return false;

  const [removed] = children.splice(fromMatch.containerIndex, 1);

  if (to >= matches.length - 1) {
    // Moving past the end — insert at the end of the array
    children.push(removed);
  } else {
    // Find the new target position after the splice
    let insertIndex = 0;
    let kindCount = 0;
    const guard = KIND_GUARDS[kind];
    for (let i = 0; i < children.length; i++) {
      if (guard(children[i])) {
        if (kindCount === to) {
          insertIndex = i;
          break;
        }
        kindCount++;
      }
    }
    children.splice(insertIndex, 0, removed);
  }

  return true;
}

/**
 * Turns a friendly value into a raw component for `set`/`replace`.
 * Plain strings are allowed for `textDisplay` (shorthand for the content of a
 * TextDisplay node); every other kind requires a full raw component.
 */
export function coerceKindValue(
  kind: ComponentKind,
  value: RawComponent | string,
): RawComponent {
  if (typeof value === "string") {
    if (kind !== "textDisplay") {
      throw new Error(
        `"${kind}": plain strings are only accepted for "textDisplay", pass a raw component instead`,
      );
    }
    return {
      type: ComponentType.TextDisplay,
      content: value,
    } as RawComponent;
  }
  return value;
}

/**
 * Namespaced, chainable accessor (e.g. `builder.sections.remove(1)`,
 * `editor.textDisplays.set(2, "hello")`). Mutating methods return the host so
 * fluent chains keep working.
 */
export class KindGroup<THost> {
  constructor(
    private readonly host: THost,
    private readonly resolve: () => RawComponent[],
    private readonly kind: ComponentKind,
  ) {}

  /** Returns the child at this kind's `index`, or null. */
  get(index: number): IndexedChildRef | null {
    return getByKind(this.resolve(), this.kind, index);
  }

  /** Returns every child of this kind with their indices. */
  all(): IndexedChildRef[] {
    return getAllByKind(this.resolve(), this.kind);
  }

  /** Replaces the child at `index` (a raw component, or string content for `textDisplay`). */
  set(index: number, value: RawComponent | string): THost {
    if (!replaceByKind(this.resolve(), this.kind, index, coerceKindValue(this.kind, value))) {
      throw new Error(`set: no ${this.kind} at index ${index}`);
    }
    return this.host;
  }

  /** Removes the child at `index`. No-op when out of bounds. */
  remove(index: number): THost {
    removeByKind(this.resolve(), this.kind, index);
    return this.host;
  }

  /** Moves the child from `from` to the `to`-th slot of this kind. No-op when out of bounds. */
  move(from: number, to: number): THost {
    moveByKind(this.resolve(), this.kind, from, to);
    return this.host;
  }
}

/** Factory for {@link KindGroup} bound to a host and a kind. */
export function kindGroup<THost>(
  host: THost,
  resolve: () => RawComponent[],
  kind: ComponentKind,
): KindGroup<THost> {
  return new KindGroup(host, resolve, kind);
}