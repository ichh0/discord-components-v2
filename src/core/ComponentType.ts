import { ComponentType } from "discord-api-types/v10";

// Реэкспорт оригинального enum для удобства импорта
export { ComponentType };

/**
 * Массив типов, которые считаются интерактивными (кнопки и все виды селект-меню).
 */
export const INTERACTIVE_COMPONENT_TYPES: ComponentType[] = [
  ComponentType.Button,
  ComponentType.SelectMenu,
  ComponentType.ChannelSelect,
  ComponentType.RoleSelect,
  ComponentType.MentionableSelect,
  ComponentType.UserSelect,
];

/**
 * Массив типов, которые могут содержать дочерние компоненты (контейнеры).
 */
export const CONTAINER_COMPONENT_TYPES: ComponentType[] = [
  ComponentType.Container,
  ComponentType.ActionRow,
];

/**
 * Проверяет, является ли тип интерактивным.
 */
export function isInteractiveType(type: ComponentType): boolean {
  return INTERACTIVE_COMPONENT_TYPES.includes(type);
}

/**
 * Проверяет, является ли тип контейнером.
 */
export function isContainerType(type: ComponentType): boolean {
  return CONTAINER_COMPONENT_TYPES.includes(type);
}

/**
 * Проверяет, является ли тип допустимым для использования в Action Row.
 */
export function isActionRowCompatible(type: ComponentType): boolean {
  return INTERACTIVE_COMPONENT_TYPES.includes(type);
}
