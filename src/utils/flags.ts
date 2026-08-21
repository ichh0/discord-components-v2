import { COMPONENTS_V2_FLAG } from "../core/Component";

/**
 * Проверяет, установлен ли флаг Components V2.
 */
export function hasV2Flag(flags: number): boolean {
  return (flags & COMPONENTS_V2_FLAG) === COMPONENTS_V2_FLAG;
}

/**
 * Гарантирует, что флаг V2 установлен.
 */
export function ensureV2Flag(flags: number = 0): number {
  return flags | COMPONENTS_V2_FLAG;
}
