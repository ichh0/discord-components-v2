import { APIButtonComponent, ButtonStyle, ComponentType } from "discord-api-types/v10";

import { createEmptyComponent } from "../core/Component";

export type ButtonEmoji = {
  id?: string;
  name?: string;
  animated?: boolean;
};

export type ButtonBuilderOptions = {
  style?: ButtonStyle;
  label?: string;
  customId?: string;
  url?: string;
  skuId?: string;
  emoji?: string | ButtonEmoji;
  disabled?: boolean;
};

export class ButtonBuilder {
  private data: Record<string, any>;

  constructor(options?: ButtonBuilderOptions) {
    this.data = createEmptyComponent(ComponentType.Button) as any;
    if (options) {
      if (options.style) this.data.style = options.style;
      if (options.label) this.data.label = options.label;
      if (options.customId) this.data.custom_id = options.customId;
      if (options.url) this.data.url = options.url;
      if (options.skuId) this.data.sku_id = options.skuId;
      if (options.emoji) {
        if (typeof options.emoji === "string") {
          this.data.emoji = { name: options.emoji };
        } else {
          this.data.emoji = options.emoji;
        }
      }
      if (options.disabled !== undefined) this.data.disabled = options.disabled;
    }
  }

  setStyle(style: ButtonStyle): this {
    this.data.style = style;
    return this;
  }

  setLabel(label: string): this {
    this.data.label = label;
    return this;
  }

  setCustomId(customId: string): this {
    delete this.data.url;
    delete this.data.sku_id;
    this.data.custom_id = customId;
    if (!this.data.style) this.data.style = ButtonStyle.Primary;
    return this;
  }

  setURL(url: string): this {
    delete this.data.custom_id;
    delete this.data.sku_id;
    this.data.url = url;
    this.data.style = ButtonStyle.Link;
    return this;
  }

  setSKUId(skuId: string): this {
    delete this.data.custom_id;
    delete this.data.url;
    this.data.sku_id = skuId;
    this.data.style = ButtonStyle.Premium;
    return this;
  }

  setEmoji(emoji: string | ButtonEmoji): this {
    if (typeof emoji === "string") {
      this.data.emoji = { name: emoji };
    } else {
      this.data.emoji = emoji;
    }
    return this;
  }

  setDisabled(disabled: boolean = true): this {
    this.data.disabled = disabled;
    return this;
  }

  build(): APIButtonComponent {
    // Валидация
    const hasCustom = "custom_id" in this.data && this.data.custom_id;
    const hasUrl = "url" in this.data && this.data.url;
    const hasSku = "sku_id" in this.data && this.data.sku_id;

    if (!hasCustom && !hasUrl && !hasSku) {
      throw new Error("Button must have either custom_id, url, or sku_id");
    }

    const hasLabel = "label" in this.data && this.data.label;
    const hasEmoji = "emoji" in this.data && this.data.emoji;

    if (!hasLabel && !hasEmoji) {
      throw new Error("Button must have either label or emoji");
    }

    // Проверка стиля для URL и SKU
    if (hasUrl && this.data.style !== ButtonStyle.Link) {
      throw new Error("URL button must have style = ButtonStyle.Link (5)");
    }
    if (hasSku && this.data.style !== ButtonStyle.Premium) {
      throw new Error("SKU button must have style = ButtonStyle.Premium (6)");
    }

    // Если есть custom_id, стиль не должен быть Link или Premium, если не указан явно
    if (hasCustom && this.data.style === ButtonStyle.Link) {
      throw new Error("Custom ID button cannot have style Link");
    }

    return this.data as APIButtonComponent;
  }
}
