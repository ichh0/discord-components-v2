/**
 * Выполняет глубокое клонирование объекта.
 * Использует structuredClone, если доступен (Node.js >= 17, современные браузеры),
 * иначе — JSON.parse(JSON.stringify()).
 */
export function cloneDeep<T>(obj: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}
