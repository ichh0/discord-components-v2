import { ActionRowBuilder } from "./ActionRowBuilder";
import { ButtonBuilder, ButtonBuilderOptions } from "./ButtonBuilder";
import { ChannelSelectBuilder, ChannelSelectOptions } from "./ChannelSelectBuilder";
import { ContainerBuilder, ContainerOptions } from "./ContainerBuilder";
import { MentionableSelectBuilder, MentionableSelectOptions } from "./MentionableSelectBuilder";
import { MessageBuilder } from "./MessageBuilder";
import { RoleSelectBuilder, RoleSelectOptions } from "./RoleSelectBuilder";
import { SelectMenuBuilder, SelectMenuOptions } from "./SelectMenuBuilder";
import { SeparatorBuilder } from "./SeparatorBuilder";
import { TextDisplayBuilder, TextDisplayOptions } from "./TextDisplayBuilder";
import { UserSelectBuilder, UserSelectOptions } from "./UserSelectBuilder";

export class ComponentBuilder {
  static button(options?: ButtonBuilderOptions): ButtonBuilder {
    return new ButtonBuilder(options);
  }

  static actionRow(): ActionRowBuilder {
    return new ActionRowBuilder();
  }

  static container(options?: ContainerOptions): ContainerBuilder {
    return new ContainerBuilder(options);
  }

  static selectMenu(options?: SelectMenuOptions): SelectMenuBuilder {
    return new SelectMenuBuilder(options);
  }

  static channelSelect(options?: ChannelSelectOptions): ChannelSelectBuilder {
    return new ChannelSelectBuilder(options);
  }

  static roleSelect(options?: RoleSelectOptions): RoleSelectBuilder {
    return new RoleSelectBuilder(options);
  }

  static mentionableSelect(options?: MentionableSelectOptions): MentionableSelectBuilder {
    return new MentionableSelectBuilder(options);
  }

  static userSelect(options?: UserSelectOptions): UserSelectBuilder {
    return new UserSelectBuilder(options);
  }

  static textDisplay(options?: TextDisplayOptions): TextDisplayBuilder {
    return new TextDisplayBuilder(options);
  }

  static separator(): SeparatorBuilder {
    return new SeparatorBuilder();
  }

  static message(): MessageBuilder {
    return new MessageBuilder();
  }
}
