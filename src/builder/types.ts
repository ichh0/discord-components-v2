import type {
  APISelectMenuOption,
  ChannelType,
} from "discord-api-types/v10";

export type { APISelectMenuOption };

/** Button styles as friendly string keys. */
export type ButtonStyleName = "Primary" | "Secondary" | "Success" | "Danger" | "Link" | "Premium";

export interface ButtonOptions {
  /** custom_id for interactive buttons (required unless `url`/`skuId` set). */
  id?: string;
  label?: string;
  style?: ButtonStyleName;
  emoji?: string;
  /** Link buttons don't need an id. */
  url?: string;
  /** Premium (SKU) buttons don't need an id or label. */
  skuId?: string;
  disabled?: boolean;
}

export interface FieldOptions {
  name: string;
  value: string;
}

export interface SectionOptions {
  title: string;
  content?: string;
  /** Thumbnail accessory: URL or attachment:// reference. */
  thumbnailUrl?: string;
  thumbnailDescription?: string;
  /** Alternative accessory: a single button. */
  button?: ButtonOptions;
  /** Mark the section thumbnail as spoiler. */
  spoiler?: boolean;
}

export interface MediaItemOptions {
  url: string;
  description?: string;
  spoiler?: boolean;
}

export interface SelectBaseOptions {
  customId: string;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export interface StringSelectOptions extends SelectBaseOptions {
  options: Array<{
    label: string;
    value: string;
    description?: string;
    emoji?: string;
    default?: boolean;
  }>;
}

export interface ChannelSelectOptions extends SelectBaseOptions {
  channelTypes?: ChannelType[];
}

export interface FilePayload {
  attachment: Buffer | string;
  name: string;
  description?: string;
}

/** Minimal structural type for interactions/messages this library can send to. */
export interface SendTarget {
  replied?: boolean;
  deferred?: boolean;
  reply?(payload: unknown): Promise<unknown> | unknown;
  editReply?(payload: unknown): Promise<unknown> | unknown;
  followUp?(payload: unknown): Promise<unknown> | unknown;
  edit?(payload: unknown): Promise<unknown> | unknown;
}

export interface SendOptions {
  ephemeral?: boolean;
  extraFlags?: number;
  [key: string]: unknown;
}
