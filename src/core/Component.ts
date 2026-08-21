import {
  APIActionRowComponent,
  APIButtonComponent,
  APIChannelSelectComponent,
  APIComponentInActionRow,
  APIComponentInMessageActionRow,
  APIContainerComponent,
  APIMentionableSelectComponent,
  APIMessageComponent,
  APIModalInteractionResponseCallbackData,
  APIRoleSelectComponent,
  APISelectMenuComponent,
  APISelectMenuOption,
  APISeparatorComponent,
  APITextDisplayComponent,
  APIUserSelectComponent,
  ButtonStyle,
  ComponentType,
  TextInputStyle,
} from "discord-api-types/v10";

// -------------------------------------------------------------------
// 1. Реэкспорт всех типов из discord-api-types для удобства
// -------------------------------------------------------------------
export {
  APIActionRowComponent,
  APIButtonComponent,
  APIChannelSelectComponent,
  APIContainerComponent,
  APIMentionableSelectComponent,
  APIMessageComponent,
  APIModalInteractionResponseCallbackData,
  APIRoleSelectComponent,
  APISelectMenuComponent,
  APISelectMenuOption,
  APISeparatorComponent,
  APITextDisplayComponent,
  APIUserSelectComponent,
  ButtonStyle,
  ComponentType,
  TextInputStyle,
};

// -------------------------------------------------------------------
// 2. Объединённый тип для любого компонента (для удобства)
// -------------------------------------------------------------------
export type AnyComponent =
  | APIButtonComponent
  | APISelectMenuComponent
  | APITextDisplayComponent
  | APIContainerComponent
  | APISeparatorComponent
  | APIChannelSelectComponent
  | APIRoleSelectComponent
  | APIMentionableSelectComponent
  | APIUserSelectComponent
  | APIActionRowComponent<APIComponentInMessageActionRow>;

// -------------------------------------------------------------------
// 3. Константа флага Components V2
// -------------------------------------------------------------------
export const COMPONENTS_V2_FLAG = 1 << 15; // 32768

// -------------------------------------------------------------------
// 4. Type Guards для проверки типа в рантайме
// -------------------------------------------------------------------
export function isInteractive(component: APIMessageComponent): boolean {
  return (
    isButton(component) ||
    isSelectMenu(component) ||
    isChannelSelect(component) ||
    isRoleSelect(component) ||
    isMentionableSelect(component) ||
    isUserSelect(component)
  );
}

export function hasChildren(
  component: APIMessageComponent,
): component is APIContainerComponent | APIActionRowComponent<APIComponentInMessageActionRow> {
  return "components" in component && Array.isArray(component.components);
}

export function isActionRow(
  component: APIMessageComponent,
): component is APIActionRowComponent<APIComponentInMessageActionRow> {
  return component.type === ComponentType.ActionRow;
}

export function isButton(component: APIMessageComponent): component is APIButtonComponent {
  return component.type === ComponentType.Button;
}

export function isSelectMenu(component: APIMessageComponent): component is APISelectMenuComponent {
  return component.type === ComponentType.SelectMenu;
}

export function isTextDisplay(
  component: APIMessageComponent,
): component is APITextDisplayComponent {
  return component.type === ComponentType.TextDisplay;
}

export function isContainer(component: APIMessageComponent): component is APIContainerComponent {
  return component.type === ComponentType.Container;
}

export function isSeparator(component: APIMessageComponent): component is APISeparatorComponent {
  return component.type === ComponentType.Separator;
}

export function isChannelSelect(
  component: APIMessageComponent,
): component is APIChannelSelectComponent {
  return component.type === ComponentType.ChannelSelect;
}

export function isRoleSelect(component: APIMessageComponent): component is APIRoleSelectComponent {
  return component.type === ComponentType.RoleSelect;
}

export function isMentionableSelect(
  component: APIMessageComponent,
): component is APIMentionableSelectComponent {
  return component.type === ComponentType.MentionableSelect;
}

export function isUserSelect(component: APIMessageComponent): component is APIUserSelectComponent {
  return component.type === ComponentType.UserSelect;
}

// Проверка наличия custom_id (общего для кнопок и меню)
export function hasCustomId(
  component: AnyComponent,
): component is AnyComponent & { custom_id: string } {
  return "custom_id" in component && typeof component.custom_id === "string";
}

// Проверка наличия поля content (для текстовых компонентов)
export function hasContent(component: AnyComponent): component is APITextDisplayComponent {
  return (
    component.type === ComponentType.TextDisplay &&
    "content" in component &&
    typeof component.content === "string"
  );
}

// -------------------------------------------------------------------
// 5. Фабричная функция для создания пустого компонента по типу
//    (используется в билдерах для инициализации)
// -------------------------------------------------------------------
export function createEmptyComponent(type: ComponentType): AnyComponent {
  switch (type) {
    case ComponentType.ActionRow:
      return { type, components: [] } as APIActionRowComponent<APIComponentInMessageActionRow>;

    case ComponentType.Button:
      return {
        type,
        style: ButtonStyle.Primary,
        custom_id: "",
        label: "",
        disabled: false,
      } as APIButtonComponent;

    case ComponentType.SelectMenu:
      return {
        type,
        custom_id: "",
        options: [],
        placeholder: "",
        min_values: 1,
        max_values: 1,
        disabled: false,
      } as APISelectMenuComponent;

    case ComponentType.TextDisplay:
      return { type, content: "" } as APITextDisplayComponent;

    case ComponentType.Container:
      return { type, components: [] } as APIContainerComponent;

    case ComponentType.Separator:
      return { type } as APISeparatorComponent;

    case ComponentType.ChannelSelect:
      return {
        type,
        custom_id: "",
        channel_types: [],
        placeholder: "",
        min_values: 1,
        max_values: 1,
        disabled: false,
      } as APIChannelSelectComponent;

    case ComponentType.RoleSelect:
      return {
        type,
        custom_id: "",
        placeholder: "",
        min_values: 1,
        max_values: 1,
        disabled: false,
      } as APIRoleSelectComponent;

    case ComponentType.MentionableSelect:
      return {
        type,
        custom_id: "",
        placeholder: "",
        min_values: 1,
        max_values: 1,
        disabled: false,
      } as APIMentionableSelectComponent;

    case ComponentType.UserSelect:
      return {
        type,
        custom_id: "",
        placeholder: "",
        min_values: 1,
        max_values: 1,
        disabled: false,
      } as APIUserSelectComponent;

    default:
      throw new Error(`Unsupported component type: ${type}`);
  }
}

export function ensureComponentsV2Flag(flags: number = 0): number {
  return flags | COMPONENTS_V2_FLAG;
}
