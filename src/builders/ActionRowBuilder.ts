import {
  APIActionRowComponent,
  APIButtonComponent,
  APIChannelSelectComponent,
  APIComponentInMessageActionRow,
  APIMentionableSelectComponent,
  APIRoleSelectComponent,
  APISelectMenuComponent,
  APIUserSelectComponent,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";

import { AnyComponent } from "../core/Component";
import { isInteractiveType } from "../core/ComponentType";
import { ButtonBuilder } from "./ButtonBuilder";
import { ChannelSelectBuilder } from "./ChannelSelectBuilder";
import { MentionableSelectBuilder } from "./MentionableSelectBuilder";
import { RoleSelectBuilder } from "./RoleSelectBuilder";
import { SelectMenuBuilder } from "./SelectMenuBuilder";
import { UserSelectBuilder } from "./UserSelectBuilder";

export class ActionRowBuilder {
  private components: APIComponentInMessageActionRow[] = [];

  /**
   * Добавляет готовый компонент (кнопку или селект) в Action Row.
   */
  addComponent(component: APIComponentInMessageActionRow): this {
    if (this.components.length >= 5) {
      throw new Error("ActionRow cannot have more than 5 components");
    }
    if (!isInteractiveType(component.type)) {
      throw new Error(
        `Component type ${component.type} is not allowed in ActionRow (must be interactive)`,
      );
    }
    this.components.push(component);
    return this;
  }

  /**
   * Добавляет несколько компонентов за раз.
   */
  addComponents(...components: APIComponentInMessageActionRow[]): this {
    for (const comp of components) {
      this.addComponent(comp);
    }
    return this;
  }

  /**
   * Создаёт и добавляет кнопку через билдер.
   */
  addButton(builder: ButtonBuilder): this {
    return this.addComponent(builder.build());
  }

  /**
   * Создаёт и добавляет обычный селект-меню.
   */
  addSelectMenu(builder: SelectMenuBuilder): this {
    return this.addComponent(builder.build());
  }

  /**
   * Создаёт и добавляет селект каналов.
   */
  addChannelSelect(builder: ChannelSelectBuilder): this {
    return this.addComponent(builder.build());
  }

  /**
   * Создаёт и добавляет селект ролей.
   */
  addRoleSelect(builder: RoleSelectBuilder): this {
    return this.addComponent(builder.build());
  }

  /**
   * Создаёт и добавляет селект упоминаемых (пользователи + роли).
   */
  addMentionableSelect(builder: MentionableSelectBuilder): this {
    return this.addComponent(builder.build());
  }

  /**
   * Создаёт и добавляет селект пользователей.
   */
  addUserSelect(builder: UserSelectBuilder): this {
    return this.addComponent(builder.build());
  }

  /**
   * Удаляет компонент по индексу.
   */
  removeComponent(index: number): this {
    if (index >= 0 && index < this.components.length) {
      this.components.splice(index, 1);
    }
    return this;
  }

  /**
   * Возвращает количество компонентов в Action Row.
   */
  get length(): number {
    return this.components.length;
  }

  /**
   * Строит итоговый объект ActionRow.
   */
  build(): APIActionRowComponent<APIComponentInMessageActionRow> {
    if (this.components.length === 0) {
      throw new Error("ActionRow must contain at least one component");
    }
    return {
      type: ComponentType.ActionRow,
      components: this.components,
    };
  }

  /**
   * Клонирует билдер.
   */
  clone(): ActionRowBuilder {
    const clone = new ActionRowBuilder();
    clone.components = this.components.map((c) => ({ ...c }));
    return clone;
  }
}
