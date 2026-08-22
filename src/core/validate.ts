import {
  APIButtonComponent,
  ButtonStyle,
} from "discord-api-types/v10";
import { LIMITS } from "./constants";
import type { RawComponent } from "./constants";
import {
  componentName,
  getChildren,
  hasCustomId,
  isActionRow,
  isButton,
  isContainer,
  isMediaGallery,
  isSection,
  isStringSelect,
  isTextDisplay,
} from "./guards";
import { walkComponents } from "./walk";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function describeButton(button: APIButtonComponent): string {
  const where = hasCustomId(button) ? `"${button.custom_id}"` : componentName(button);
  return `Button ${where}`;
}

/**
 * Structural validation of a full payload against documented Discord limits.
 * Returns the list of problems instead of throwing, so callers can decide.
 */
export function validateComponents(roots: RawComponent[]): ValidationResult {
  const errors: string[] = [];

  let total = 0;
  walkComponents(roots, ({ component }) => {
    total += 1;

    if (isActionRow(component)) {
      const children = getChildren(component) ?? [];
      if (children.length === 0) {
        errors.push("ActionRow must contain at least one component");
      }
      if (children.length > LIMITS.MAX_ACTION_ROW_CHILDREN) {
        errors.push(
          `ActionRow has ${children.length} components, max ${LIMITS.MAX_ACTION_ROW_CHILDREN}`,
        );
      }
    }

    if (isContainer(component)) {
      const children = component.components ?? [];
      if (children.length > LIMITS.MAX_CONTAINER_CHILDREN) {
        errors.push(
          `Container has ${children.length} children, max ${LIMITS.MAX_CONTAINER_CHILDREN}`,
        );
      }
    }

    if (isSection(component)) {
      const texts = (getChildren(component) ?? []).filter(isTextDisplay);
      if (texts.length < LIMITS.MIN_SECTION_TEXTS) {
        errors.push("Section must have at least one TextDisplay");
      }
      if (texts.length > LIMITS.MAX_SECTION_TEXTS) {
        errors.push(`Section has ${texts.length} TextDisplays, max ${LIMITS.MAX_SECTION_TEXTS}`);
      }
      const accessory = (component as { accessory?: { type?: number } }).accessory;
      if (!accessory || typeof accessory.type !== "number") {
        errors.push("Section must have an accessory (thumbnail or button)");
      }
    }

    if (isButton(component)) {
      const hasCustomIdField = hasCustomId(component) && component.custom_id.length > 0;
      const hasUrl = "url" in component && Boolean(component.url);
      const hasSku = "sku_id" in component && Boolean(component.sku_id);
      const idCount = [hasCustomIdField, hasUrl, hasSku].filter(Boolean).length;

      if (idCount === 0) errors.push(`${describeButton(component)}: missing custom_id/url/sku_id`);
      if (idCount > 1) errors.push(`${describeButton(component)}: only one of custom_id/url/sku_id allowed`);

      const hasLabel =
        typeof (component as { label?: unknown }).label === "string" &&
        (component as { label: string }).label.length > 0;
      const hasEmoji = Boolean((component as { emoji?: unknown }).emoji);
      if (!hasLabel && !hasEmoji && !hasSku) {
        errors.push(`${describeButton(component)}: needs a label or emoji`);
      }

      if (
        component.style === ButtonStyle.Link &&
        !hasUrl
      ) {
        errors.push(`${describeButton(component)}: Link style requires url`);
      }
    }

    if (isStringSelect(component)) {
      const options = component.options ?? [];
      if (options.length === 0) errors.push('StringSelect "' + String(component.custom_id) + '": needs at least one option');
      if (options.length > 25) errors.push(`StringSelect "${component.custom_id}": more than 25 options`);
    }

    if (isTextDisplay(component)) {
      if (typeof component.content !== "string") {
        errors.push("TextDisplay content must be a string");
      }
    }

    if (isMediaGallery(component)) {
      const items = component.items ?? [];
      if (items.length < LIMITS.MIN_GALLERY_ITEMS) {
        errors.push("MediaGallery needs at least one item");
      }
      if (items.length > LIMITS.MAX_GALLERY_ITEMS) {
        errors.push(`MediaGallery has ${items.length} items, max ${LIMITS.MAX_GALLERY_ITEMS}`);
      }
    }
  });

  if (total > LIMITS.MAX_TOTAL_COMPONENTS) {
    errors.push(`Too many components: ${total}, max ${LIMITS.MAX_TOTAL_COMPONENTS}`);
  }

  return { valid: errors.length === 0, errors };
}
