
import { APIChannelSelectComponent, ComponentType } from "discord-api-types/v10";

import { createEmptyComponent } from "../core/Component";

export type ChannelSelectOptions = {
  customId?: string;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  channelTypes?: number[];
  disabled?: boolean;
  defaultValues?: any[]; // упрощаем тип
};

export class ChannelSelectBuilder {
  private data: any;

  constructor(options?: ChannelSelectOptions) {
    this.data = createEmptyComponent(ComponentType.ChannelSelect);
    if (options) {
      if (options.customId) this.data.custom_id = options.customId;
      if (options.placeholder) this.data.placeholder = options.placeholder;
      if (options.minValues !== undefined) this.data.min_values = options.minValues;
      if (options.maxValues !== undefined) this.data.max_values = options.maxValues;
      if (options.channelTypes) this.data.channel_types = options.channelTypes;
      if (options.disabled !== undefined) this.data.disabled = options.disabled;
      if (options.defaultValues) this.data.default_values = options.defaultValues;
    }
  }

  setCustomId(customId: string): this {
    this.data.custom_id = customId;
    return this;
  }

  setPlaceholder(placeholder: string): this {
    this.data.placeholder = placeholder;
    return this;
  }

  setMinValues(min: number): this {
    this.data.min_values = min;
    return this;
  }

  setMaxValues(max: number): this {
    this.data.max_values = max;
    return this;
  }

  setChannelTypes(types: number[]): this {
    this.data.channel_types = types;
    return this;
  }

  setDisabled(disabled: boolean = true): this {
    this.data.disabled = disabled;
    return this;
  }

  setDefaultValues(values: any[]): this {
    this.data.default_values = values;
    return this;
  }

  build(): APIChannelSelectComponent {
    return this.data as APIChannelSelectComponent;
  }
}
