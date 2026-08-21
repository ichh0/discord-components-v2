import { APISelectMenuComponent, APISelectMenuOption, ComponentType } from "discord-api-types/v10";

import { createEmptyComponent } from "../core/Component";

export type SelectMenuOptions = {
  customId?: string;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
};

export class SelectMenuBuilder {
  private data: any;

  constructor(options?: SelectMenuOptions) {
    this.data = createEmptyComponent(ComponentType.SelectMenu);
    if (options) {
      if (options.customId) this.data.custom_id = options.customId;
      if (options.placeholder) this.data.placeholder = options.placeholder;
      if (options.minValues !== undefined) this.data.min_values = options.minValues;
      if (options.maxValues !== undefined) this.data.max_values = options.maxValues;
      if (options.disabled !== undefined) this.data.disabled = options.disabled;
    }
    // Инициализируем options как пустой массив, если ещё нет
    if (!this.data.options) this.data.options = [];
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

  setDisabled(disabled: boolean = true): this {
    this.data.disabled = disabled;
    return this;
  }

  addOption(option: APISelectMenuOption): this {
    this.data.options.push(option);
    return this;
  }

  addOptions(...options: APISelectMenuOption[]): this {
    for (const opt of options) {
      this.addOption(opt);
    }
    return this;
  }

  setOptions(options: APISelectMenuOption[]): this {
    this.data.options = [];
    return this.addOptions(...options);
  }

  build(): APISelectMenuComponent {
    if (!this.data.options || this.data.options.length === 0) {
      throw new Error("SelectMenu must have at least one option");
    }
    return this.data as APISelectMenuComponent;
  }
}
