import { APIContainerComponent, ComponentType } from "discord-api-types/v10";

import { AnyComponent, createEmptyComponent } from "../core/Component";
import { ButtonBuilder } from "./ButtonBuilder";
import { ActionRowBuilder } from "./ActionRowBuilder";
import { SelectMenuBuilder } from "./SelectMenuBuilder";
import { ChannelSelectBuilder } from "./ChannelSelectBuilder";
import { RoleSelectBuilder } from "./RoleSelectBuilder";
import { MentionableSelectBuilder } from "./MentionableSelectBuilder";
import { UserSelectBuilder } from "./UserSelectBuilder";
import { TextDisplayBuilder } from "./TextDisplayBuilder";
import { SeparatorBuilder } from "./SeparatorBuilder";

export type ContainerOptions = {
  accentColor?: number;
};

export class ContainerBuilder {
  private data: any; // используем any для гибкости

  constructor(options?: ContainerOptions) {
    this.data = createEmptyComponent(ComponentType.Container);
    if (options?.accentColor !== undefined) {
      this.data.accent_color = options.accentColor;
    }
    // Убедимся, что components есть
    if (!this.data.components) this.data.components = [];
  }

  setAccentColor(color: number): this {
    this.data.accent_color = color;
    return this;
  }

  addComponent(
    component:
      | AnyComponent
      | ButtonBuilder
      | ActionRowBuilder
      | SelectMenuBuilder
      | ChannelSelectBuilder
      | RoleSelectBuilder
      | MentionableSelectBuilder
      | UserSelectBuilder
      | TextDisplayBuilder
      | SeparatorBuilder,
  ): this {
    const built = this.buildChild(component);
    this.data.components.push(built);
    return this;
  }

  addComponents(
    ...components: (
      | AnyComponent
      | ButtonBuilder
      | ActionRowBuilder
      | SelectMenuBuilder
      | ChannelSelectBuilder
      | RoleSelectBuilder
      | MentionableSelectBuilder
      | UserSelectBuilder
      | TextDisplayBuilder
      | SeparatorBuilder
    )[]
  ): this {
    for (const comp of components) {
      this.addComponent(comp);
    }
    return this;
  }

  setComponents(
    components: (
      | AnyComponent
      | ButtonBuilder
      | ActionRowBuilder
      | SelectMenuBuilder
      | ChannelSelectBuilder
      | RoleSelectBuilder
      | MentionableSelectBuilder
      | UserSelectBuilder
      | TextDisplayBuilder
      | SeparatorBuilder
    )[],
  ): this {
    this.data.components = [];
    return this.addComponents(...components);
  }

  private buildChild(
    child:
      | AnyComponent
      | ButtonBuilder
      | ActionRowBuilder
      | SelectMenuBuilder
      | ChannelSelectBuilder
      | RoleSelectBuilder
      | MentionableSelectBuilder
      | UserSelectBuilder
      | TextDisplayBuilder
      | SeparatorBuilder,
  ): any {
    if (child instanceof ButtonBuilder) return child.build();
    if (child instanceof ActionRowBuilder) return child.build();
    if (child instanceof SelectMenuBuilder) return child.build();
    if (child instanceof ChannelSelectBuilder) return child.build();
    if (child instanceof RoleSelectBuilder) return child.build();
    if (child instanceof MentionableSelectBuilder) return child.build();
    if (child instanceof UserSelectBuilder) return child.build();
    if (child instanceof TextDisplayBuilder) return child.build();
    if (child instanceof SeparatorBuilder) return child.build();
    return child as any;
  }

  build(): APIContainerComponent {
    return this.data as APIContainerComponent;
  }
}
