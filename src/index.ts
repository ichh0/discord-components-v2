// Core
export {
  EPHEMERAL,
  IS_COMPONENTS_V2,
  LIMITS,
  ComponentType,
  MessageFlags,
} from "./core/constants";
export type { RawComponent } from "./core/constants";
export {
  componentName,
  getChildren,
  hasCustomId,
  isActionRow,
  isAnySelect,
  isButton,
  isChannelSelect,
  isContainer,
  isInteractive,
  isMediaGallery,
  isMentionableSelect,
  isRoleSelect,
  isSection,
  isSeparator,
  isStringSelect,
  isTextDisplay,
  isUserSelect,
} from "./core/guards";
export { cloneDeep, normalizeComponents, toRaw } from "./core/normalize";
export { matchesSelector } from "./core/selector";
export type { ComponentSelector } from "./core/selector";
export {
  countComponents,
  findComponent,
  findComponents,
  walkComponents,
} from "./core/walk";
export type { ComponentRef } from "./core/walk";
export { validateComponents } from "./core/validate";
export type { ValidationResult } from "./core/validate";

// Builder
export { parseComponents, parseEmoji, V2Builder } from "./builder/V2Builder";
export type { V2Payload } from "./builder/V2Builder";
export { V2ModalBuilder, parseModalSubmit } from "./builder/V2ModalBuilder";
export { CustomIdBuilder, CustomIdError, CUSTOM_ID_MAX_LENGTH } from "./builder/CustomIdBuilder";
export type {
  CustomIdName,
  CustomIdParts,
  ParsedCustomId,
} from "./builder/CustomIdBuilder";
export type {
  ChannelSelectMenuData,
  MentionableDefaultValue,
  MentionableSelectMenuData,
  ModalComponentBuilder,
  ModalFieldKind,
  ModalFieldSchema,
  ModalFieldValues,
  ModalSubmitFieldsLike,
  ModalTarget,
  RadioGroupData,
  RadioGroupOptionData,
  RoleSelectMenuData,
  SelectMenuBaseData,
  StringSelectMenuData,
  StringSelectOptionData,
  TextInputData,
  UserSelectMenuData,
  V2ModalBuilderOptions,
} from "./builder/V2ModalBuilder";
export type {
  ButtonOptions,
  ButtonStyleName,
  ChannelSelectOptions,
  FieldOptions,
  FilePayload,
  MediaItemOptions,
  SectionOptions,
  SelectBaseOptions,
  SendOptions,
  SendTarget,
  StringSelectOptions,
} from "./builder/types";

// Editing
export { ComponentsEditor, editComponents } from "./edit/editor";
export {
  clearSelectValues,
  disableButtons,
  enableButtons,
  findSelectMenu,
  getSelectMenus,
  getTextContents,
  matchesSelectMenu,
  removeComponents,
  removeSelectMenus,
  renameCustomId,
  replaceSelectMenu,
  replaceText,
  setButtonEmoji,
  setButtonLabel,
  setButtonStyle,
  setButtonUrl,
  setDisabled,
  setSelectDisabled,
  setSelectMinMaxValues,
  setSelectOptions,
  setSelectPlaceholder,
} from "./edit/operations";
export type {
  DisableOptions,
  RemoveOptions,
  SelectMenuMatchOptions,
  SelectMenuType,
  SelectOptionInput,
} from "./edit/operations";

// Kind-indexed container-child management
export {
  getAllByKind,
  getByKind,
  isComponentKind,
  kindOfType,
  removeByKind,
  replaceByKind,
  type KindGroup,
} from "./edit/kinds";
export type { ComponentKind, IndexedChildRef, KindTarget } from "./edit/kinds";

// Rare whole-tree manipulations live in "discordjs-components-v2/lib/advanced"
// ({ keepOnly, moveByKind }); V2Template and V2Paginator live in
// "discordjs-components-v2/lib/template" and "discordjs-components-v2/lib/pagination".

// Convenience re-exports of raw API types consumers commonly need
export type {
  APIContainerComponent,
  APIMessageComponent,
  SeparatorSpacingSize as SeparatorSpacingSizeType,
} from "discord-api-types/v10";
export { SeparatorSpacingSize } from "discord-api-types/v10";