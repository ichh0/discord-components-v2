import { AnyComponent } from "../core/Component";

/**
 * Объединяет два массива компонентов (простая конкатенация).
 * Если нужна более сложная логика (замена по custom_id), можно расширить.
 */
export function mergeComponents(base: AnyComponent[], ...others: AnyComponent[][]): AnyComponent[] {
  return base.concat(...others);
}
