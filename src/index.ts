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
  disableButtons,
  enableButtons,
  getSection,
  getSections,
  getTextContents,
  keepOnly,
  moveSection,
  removeComponents,
  removeSection,
  replaceSection,
  replaceText,
  setButtonLabel,
  setDisabled,
} from "./edit/operations";
export type { DisableOptions, RemoveOptions, SectionRef } from "./edit/operations";

// Convenience re-exports of raw API types consumers commonly need
export type {
  APIContainerComponent,
  APIMessageComponent,
  SeparatorSpacingSize as SeparatorSpacingSizeType,
} from "discord-api-types/v10";
export { SeparatorSpacingSize } from "discord-api-types/v10";
