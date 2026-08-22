import {
  APIActionRowComponent,
  APIButtonComponent,
  APIChannelSelectComponent,
  APIComponentInMessageActionRow,
  APIContainerComponent,
  APIMediaGalleryComponent,
  APIMentionableSelectComponent,
  APIRoleSelectComponent,
  APISectionComponent,
  APIStringSelectComponent,
  APITextDisplayComponent,
  APIUserSelectComponent,
  ComponentType,
} from "discord-api-types/v10";
import type { RawComponent } from "./constants";
import { isRecord } from "./normalize";

export type {
  APIActionRowComponent,
  APIButtonComponent,
  APIChannelSelectComponent,
  APIComponentInMessageActionRow,
  APIContainerComponent,
  APIMediaGalleryComponent,
  APIMentionableSelectComponent,
  APIRoleSelectComponent,
  APISectionComponent,
  APIStringSelectComponent,
  APITextDisplayComponent,
  APIUserSelectComponent,
};

export function isActionRow(c: RawComponent): c is APIActionRowComponent<APIComponentInMessageActionRow> {
  return c.type === ComponentType.ActionRow;
}

export function isButton(c: RawComponent): c is APIButtonComponent {
  return c.type === ComponentType.Button;
}

export function isStringSelect(c: RawComponent): c is APIStringSelectComponent {
  return c.type === ComponentType.StringSelect;
}

export function isUserSelect(c: RawComponent): c is APIUserSelectComponent {
  return c.type === ComponentType.UserSelect;
}

export function isRoleSelect(c: RawComponent): c is APIRoleSelectComponent {
  return c.type === ComponentType.RoleSelect;
}

export function isMentionableSelect(c: RawComponent): c is APIMentionableSelectComponent {
  return c.type === ComponentType.MentionableSelect;
}

export function isChannelSelect(c: RawComponent): c is APIChannelSelectComponent {
  return c.type === ComponentType.ChannelSelect;
}

export type AnySelectComponent = APIStringSelectComponent &
  APIUserSelectComponent &
  APIRoleSelectComponent &
  APIMentionableSelectComponent &
  APIChannelSelectComponent;

export function isAnySelect(c: RawComponent): c is AnySelectComponent {
  return (
    isStringSelect(c) ||
    isUserSelect(c) ||
    isRoleSelect(c) ||
    isMentionableSelect(c) ||
    isChannelSelect(c)
  );
}

/** Buttons and all kinds of select menus. */
export function isInteractive(c: RawComponent): boolean {
  return isButton(c) || isAnySelect(c);
}

export function isSection(c: RawComponent): c is APISectionComponent {
  return c.type === ComponentType.Section;
}

export function isTextDisplay(c: RawComponent): c is APITextDisplayComponent {
  return c.type === ComponentType.TextDisplay;
}

export function isMediaGallery(c: RawComponent): c is APIMediaGalleryComponent {
  return c.type === ComponentType.MediaGallery;
}

export function isSeparator(c: RawComponent): boolean {
  return c.type === ComponentType.Separator;
}

export function isContainer(c: RawComponent): c is APIContainerComponent {
  return c.type === ComponentType.Container;
}

export function hasCustomId(
  c: RawComponent,
): c is RawComponent & { custom_id: string } {
  return "custom_id" in c && typeof (c as { custom_id?: unknown }).custom_id === "string";
}

/**
 * Returns the mutable children array of a component, or null if it has none.
 * Section accessories are NOT part of this array (they are a single object).
 */
export function getChildren(component: RawComponent): RawComponent[] | null {
  const maybe = (component as { components?: unknown }).components;
  if (Array.isArray(maybe)) return maybe as RawComponent[];
  return null;
}

/** Human-readable component name, useful in error messages. */
export function componentName(component: RawComponent): string {
  const names: Record<number, string> = {
    [ComponentType.ActionRow]: "ActionRow",
    [ComponentType.Button]: "Button",
    [ComponentType.StringSelect]: "StringSelect",
    [ComponentType.UserSelect]: "UserSelect",
    [ComponentType.RoleSelect]: "RoleSelect",
    [ComponentType.MentionableSelect]: "MentionableSelect",
    [ComponentType.ChannelSelect]: "ChannelSelect",
    [ComponentType.Section]: "Section",
    [ComponentType.TextDisplay]: "TextDisplay",
    [ComponentType.Thumbnail]: "Thumbnail",
    [ComponentType.MediaGallery]: "MediaGallery",
    [ComponentType.File]: "File",
    [ComponentType.Separator]: "Separator",
    [ComponentType.Container]: "Container",
  };
  return names[component.type] ?? `Unknown(type=${component.type})`;
}

export { isRecord };
