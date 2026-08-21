import {
  APIButtonComponent,
  APIChannelSelectComponent,
  APIContainerComponent,
  APIMentionableSelectComponent,
  APIMessageComponent,
  APIRoleSelectComponent,
  APISelectMenuComponent,
  APISeparatorComponent,
  APITextDisplayComponent,
  APIUserSelectComponent,
  ComponentType,
} from "discord-api-types/v10";

import {
  AnyComponent,
  isActionRow,
  isButton,
  isChannelSelect,
  isContainer,
  isMentionableSelect,
  isRoleSelect,
  isSelectMenu,
  isSeparator,
  isTextDisplay,
  isUserSelect,
} from "./Component";

import { getMaxChildren, isContainerType } from "./ComponentMap";
import { isInteractiveType } from "./ComponentType";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Валидирует массив корневых компонентов сообщения.
 */
export function validateComponents(components: AnyComponent[]): ValidationResult {
  const errors: string[] = [];

  if (components.length > 10) {
    errors.push(`Too many root components: ${components.length}, max 10`);
  }

  const total = countAllComponents(components);
  if (total > 40) {
    errors.push(`Too many total components: ${total}, max 40`);
  }

  for (const comp of components) {
    const result = validateComponent(comp);
    errors.push(...result.errors);
  }

  return { valid: errors.length === 0, errors };
}

function countAllComponents(components: AnyComponent[]): number {
  let count = components.length;
  for (const comp of components) {
    if (isContainerType(comp.type) && "components" in comp && Array.isArray(comp.components)) {
      count += countAllComponents(comp.components as AnyComponent[]);
    }
  }
  return count;
}

function validateComponent(component: AnyComponent): ValidationResult {
  const errors: string[] = [];

  if (component.type === undefined) {
    errors.push("Component is missing 'type'");
    return { valid: false, errors };
  }

  if (isButton(component)) {
    validateButton(component, errors);
  } else if (isSelectMenu(component)) {
    validateSelectMenu(component, errors);
  } else if (isChannelSelect(component)) {
    validateChannelSelect(component, errors);
  } else if (isRoleSelect(component)) {
    validateRoleSelect(component, errors);
  } else if (isMentionableSelect(component)) {
    validateMentionableSelect(component, errors);
  } else if (isUserSelect(component)) {
    validateUserSelect(component, errors);
  } else if (isTextDisplay(component)) {
    validateTextDisplay(component, errors);
  } else if (isContainer(component)) {
    validateContainer(component, errors);
  } else if (isSeparator(component)) {
    // Nothing to validate
  } else if (isActionRow(component)) {
    validateActionRow(component, errors);
  } else {
    // Unknown type (this block should never be executed)
    errors.push(`Unknown component type: ${(component as any).type}`);
  }

  return { valid: errors.length === 0, errors };
}

// -------------------------------------------------------------------
// Валидаторы
// -------------------------------------------------------------------

function validateButton(btn: APIButtonComponent, errors: string[]): void {
  const hasCustom = "custom_id" in btn && btn.custom_id !== undefined;
  const hasUrl = "url" in btn && btn.url !== undefined;
  const hasSku = "sku_id" in btn && btn.sku_id !== undefined;

  if (!hasCustom && !hasUrl && !hasSku) {
    errors.push("Button must have either custom_id, url, or sku_id");
  }

  if (hasCustom && btn.custom_id === "") {
    errors.push("Button custom_id cannot be empty");
  }

  const hasLabel = "label" in btn && btn.label !== undefined && btn.label !== "";
  const hasEmoji = "emoji" in btn && btn.emoji !== undefined;

  if (!hasLabel && !hasEmoji) {
    errors.push("Button must have either label or emoji");
  }

  if (hasUrl && "style" in btn && btn.style !== 5) {
    errors.push("URL button must have style = 5 (Link)");
  }

  if (hasSku && "style" in btn && btn.style !== 6) {
    errors.push("SKU button must have style = 6 (Premium)");
  }
}

function validateSelectMenu(menu: APISelectMenuComponent, errors: string[]): void {
  if ("options" in menu) {
    if (!menu.options || menu.options.length === 0) {
      errors.push("Select menu must have at least one option");
    }
  } else {
    errors.push("Invalid select menu type");
    return;
  }

  if (menu.min_values !== undefined && menu.min_values < 0) {
    errors.push("min_values must be >= 0");
  }
  if (menu.max_values !== undefined && menu.max_values < 1) {
    errors.push("max_values must be >= 1");
  }
  if (
    menu.min_values !== undefined &&
    menu.max_values !== undefined &&
    menu.min_values > menu.max_values
  ) {
    errors.push("min_values cannot be greater than max_values");
  }
  if (menu.placeholder !== undefined && typeof menu.placeholder !== "string") {
    errors.push("placeholder must be a string");
  }
}

function validateChannelSelect(menu: APIChannelSelectComponent, errors: string[]): void {
  if (menu.channel_types && !Array.isArray(menu.channel_types)) {
    errors.push("channel_types must be an array");
  }
  if (menu.min_values !== undefined && menu.min_values < 0) {
    errors.push("min_values must be >= 0");
  }
  if (menu.max_values !== undefined && menu.max_values < 1) {
    errors.push("max_values must be >= 1");
  }
  if (
    menu.min_values !== undefined &&
    menu.max_values !== undefined &&
    menu.min_values > menu.max_values
  ) {
    errors.push("min_values cannot be greater than max_values");
  }
  if (menu.placeholder !== undefined && typeof menu.placeholder !== "string") {
    errors.push("placeholder must be a string");
  }
}

function validateRoleSelect(menu: APIRoleSelectComponent, errors: string[]): void {
  if (menu.min_values !== undefined && menu.min_values < 0) {
    errors.push("min_values must be >= 0");
  }
  if (menu.max_values !== undefined && menu.max_values < 1) {
    errors.push("max_values must be >= 1");
  }
  if (
    menu.min_values !== undefined &&
    menu.max_values !== undefined &&
    menu.min_values > menu.max_values
  ) {
    errors.push("min_values cannot be greater than max_values");
  }
  if (menu.placeholder !== undefined && typeof menu.placeholder !== "string") {
    errors.push("placeholder must be a string");
  }
}

function validateMentionableSelect(menu: APIMentionableSelectComponent, errors: string[]): void {
  if (menu.min_values !== undefined && menu.min_values < 0) {
    errors.push("min_values must be >= 0");
  }
  if (menu.max_values !== undefined && menu.max_values < 1) {
    errors.push("max_values must be >= 1");
  }
  if (
    menu.min_values !== undefined &&
    menu.max_values !== undefined &&
    menu.min_values > menu.max_values
  ) {
    errors.push("min_values cannot be greater than max_values");
  }
  if (menu.placeholder !== undefined && typeof menu.placeholder !== "string") {
    errors.push("placeholder must be a string");
  }
}

function validateUserSelect(menu: APIUserSelectComponent, errors: string[]): void {
  if (menu.min_values !== undefined && menu.min_values < 0) {
    errors.push("min_values must be >= 0");
  }
  if (menu.max_values !== undefined && menu.max_values < 1) {
    errors.push("max_values must be >= 1");
  }
  if (
    menu.min_values !== undefined &&
    menu.max_values !== undefined &&
    menu.min_values > menu.max_values
  ) {
    errors.push("min_values cannot be greater than max_values");
  }
  if (menu.placeholder !== undefined && typeof menu.placeholder !== "string") {
    errors.push("placeholder must be a string");
  }
}

function validateTextDisplay(display: APITextDisplayComponent, errors: string[]): void {
  if (display.content === undefined) {
    errors.push("TextDisplay must have 'content' field");
  }
}

function validateContainer(container: APIContainerComponent, errors: string[]): void {
  if (!Array.isArray(container.components)) {
    errors.push("Container must have 'components' array");
    return;
  }

  const maxChildren = getMaxChildren(ComponentType.Container);
  if (container.components.length > maxChildren) {
    errors.push(`Container has ${container.components.length} children, max ${maxChildren}`);
  }

  for (const child of container.components) {
    const result = validateComponent(child as AnyComponent);
    errors.push(...result.errors);
  }
}

function validateActionRow(row: any, errors: string[]): void {
  if (!Array.isArray(row.components)) {
    errors.push("ActionRow must have 'components' array");
    return;
  }

  if (row.components.length > 5) {
    errors.push(`ActionRow has ${row.components.length} children, max 5`);
  }

  for (const child of row.components) {
    const childType = child.type;
    if (!isInteractiveType(childType)) {
      errors.push(`ActionRow contains non-interactive component type: ${childType}`);
    }
    const result = validateComponent(child as AnyComponent);
    errors.push(...result.errors);
  }
}
