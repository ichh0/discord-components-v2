import { APIMessageComponent, ComponentType } from "discord-api-types/v10";
import { hasChildren, isContainer } from "./Component"; // используем готовые guard'ы

/**
 * Человекочитаемые названия типов компонентов.
 */
export const COMPONENT_TYPE_NAMES: Partial<Record<ComponentType, string>> = {
  [ComponentType.ActionRow]: "Action Row",
  [ComponentType.Button]: "Button",
  [ComponentType.SelectMenu]: "Select Menu",
  [ComponentType.TextInput]: "Text Input",
  [ComponentType.TextDisplay]: "Text Display",
  [ComponentType.Container]: "Container",
  [ComponentType.Separator]: "Separator",
  [ComponentType.ChannelSelect]: "Channel Select",
  [ComponentType.RoleSelect]: "Role Select",
  [ComponentType.MentionableSelect]: "Mentionable Select",
  [ComponentType.UserSelect]: "User Select",
};

/**
 * Получить имя типа компонента по числовому значению.
 */
export function getComponentTypeName(type: ComponentType): string {
  return COMPONENT_TYPE_NAMES[type] || `Unknown (${type})`;
}

/**
 * Проверяет, может ли компонент данного типа содержать дочерние элементы.
 */
export function isContainerType(type: ComponentType): boolean {
  return type === ComponentType.Container || type === ComponentType.ActionRow;
}

/**
 * Проверяет, является ли компонент контейнером (имеет поле components).
 * Это обёртка над hasChildren, но использует isContainerType для дополнительной проверки.
 */
export function isContainerComponent(component: APIMessageComponent): boolean {
  return isContainerType(component.type) && hasChildren(component);
}

/**
 * Возвращает допустимые типы дочерних компонентов для данного типа-контейнера.
 * Если тип не является контейнером, возвращает пустой массив.
 */
export function getAllowedChildTypes(parentType: ComponentType): ComponentType[] {
  switch (parentType) {
    case ComponentType.ActionRow:
      // Action Row может содержать только интерактивные компоненты (кнопки и селекты)
      return [
        ComponentType.Button,
        ComponentType.SelectMenu,
        ComponentType.ChannelSelect,
        ComponentType.RoleSelect,
        ComponentType.MentionableSelect,
        ComponentType.UserSelect,
      ];
    case ComponentType.Container:
      // Container может содержать практически любые компоненты (TextDisplay, Container, Separator, интерактивные, даже ActionRow)
      // Строгого ограничения нет, разрешим все, кроме, возможно, ActionRow (но его тоже можно)
      return [
        ComponentType.TextDisplay,
        ComponentType.Container,
        ComponentType.Separator,
        ComponentType.Button,
        ComponentType.SelectMenu,
        ComponentType.ChannelSelect,
        ComponentType.RoleSelect,
        ComponentType.MentionableSelect,
        ComponentType.UserSelect,
        ComponentType.ActionRow,
      ];
    default:
      return [];
  }
}

/**
 * Проверяет, является ли дочерний тип допустимым для родительского.
 */
export function isAllowedChild(parentType: ComponentType, childType: ComponentType): boolean {
  const allowed = getAllowedChildTypes(parentType);
  return allowed.includes(childType);
}

/**
 * Возвращает максимальное количество дочерних элементов для контейнера.
 * (используется для валидации лимитов)
 */
export function getMaxChildren(parentType: ComponentType): number {
  switch (parentType) {
    case ComponentType.ActionRow:
      return 5; // по документации Discord
    case ComponentType.Container:
      return 10; // условно, но обычно ограничено общим числом компонентов в сообщении (40)
    default:
      return 0;
  }
}
