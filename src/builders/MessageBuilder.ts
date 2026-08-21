import { AnyComponent, COMPONENTS_V2_FLAG, ensureComponentsV2Flag } from "../core/Component";
import { validateComponents } from "../core/Validator";
import { ActionRowBuilder } from "./ActionRowBuilder";
import { ButtonBuilder } from "./ButtonBuilder";
import { ChannelSelectBuilder } from "./ChannelSelectBuilder";
import { ContainerBuilder } from "./ContainerBuilder";
import { MentionableSelectBuilder } from "./MentionableSelectBuilder";
import { RoleSelectBuilder } from "./RoleSelectBuilder";
import { SelectMenuBuilder } from "./SelectMenuBuilder";
import { SeparatorBuilder } from "./SeparatorBuilder";
import { TextDisplayBuilder } from "./TextDisplayBuilder";
import { UserSelectBuilder } from "./UserSelectBuilder";

export type MessageBuildResult = {
  components: AnyComponent[];
  flags: number;
};

export class MessageBuilder {
  private components: AnyComponent[] = [];
  private flags: number = COMPONENTS_V2_FLAG;

  addComponent(
    component:
      | AnyComponent
      | ButtonBuilder
      | ActionRowBuilder
      | ContainerBuilder
      | SelectMenuBuilder
      | ChannelSelectBuilder
      | RoleSelectBuilder
      | MentionableSelectBuilder
      | UserSelectBuilder
      | TextDisplayBuilder
      | SeparatorBuilder,
  ): this {
    const built = this.buildChild(component);
    this.components.push(built);
    return this;
  }

  addComponents(
    ...components: (
      | AnyComponent
      | ButtonBuilder
      | ActionRowBuilder
      | ContainerBuilder
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
      | ContainerBuilder
      | SelectMenuBuilder
      | ChannelSelectBuilder
      | RoleSelectBuilder
      | MentionableSelectBuilder
      | UserSelectBuilder
      | TextDisplayBuilder
      | SeparatorBuilder
    )[],
  ): this {
    this.components = [];
    return this.addComponents(...components);
  }

  addRow(
    ...items: (
      | AnyComponent
      | ButtonBuilder
      | SelectMenuBuilder
      | ChannelSelectBuilder
      | RoleSelectBuilder
      | MentionableSelectBuilder
      | UserSelectBuilder
    )[]
  ): this {
    const row = new ActionRowBuilder();
    for (const item of items) {
      row.addComponent(item as any);
    }
    return this.addComponent(row);
  }

  addText(content: string, spoiler?: boolean): this {
    const display = new TextDisplayBuilder({ content, spoiler });
    return this.addComponent(display);
  }

  addContainer(container: ContainerBuilder): this {
    return this.addComponent(container);
  }

  addSeparator(): this {
    return this.addComponent(new SeparatorBuilder());
  }

  setFlags(flags: number): this {
    this.flags = flags;
    return this;
  }

  ensureV2Flag(): this {
    this.flags = ensureComponentsV2Flag(this.flags);
    return this;
  }

  build(): MessageBuildResult {
    const validation = validateComponents(this.components);
    if (!validation.valid) {
      throw new Error(`Invalid components: ${validation.errors.join(", ")}`);
    }
    return {
      components: this.components,
      flags: ensureComponentsV2Flag(this.flags),
    };
  }

  private buildChild(
    child:
      | AnyComponent
      | ButtonBuilder
      | ActionRowBuilder
      | ContainerBuilder
      | SelectMenuBuilder
      | ChannelSelectBuilder
      | RoleSelectBuilder
      | MentionableSelectBuilder
      | UserSelectBuilder
      | TextDisplayBuilder
      | SeparatorBuilder,
  ): AnyComponent {
    if (child instanceof ButtonBuilder) return child.build();
    if (child instanceof ActionRowBuilder) return child.build();
    if (child instanceof ContainerBuilder) return child.build();
    if (child instanceof SelectMenuBuilder) return child.build();
    if (child instanceof ChannelSelectBuilder) return child.build();
    if (child instanceof RoleSelectBuilder) return child.build();
    if (child instanceof MentionableSelectBuilder) return child.build();
    if (child instanceof UserSelectBuilder) return child.build();
    if (child instanceof TextDisplayBuilder) return child.build();
    if (child instanceof SeparatorBuilder) return child.build();
    return child as AnyComponent;
  }
}
