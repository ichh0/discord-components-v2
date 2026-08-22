import {
  APIMessageComponent,
  ComponentType,
  MessageFlags,
} from "discord-api-types/v10";

export { ComponentType, MessageFlags };

/** Any raw (JSON-serializable) message component, as returned by the Discord API. */
export type RawComponent = APIMessageComponent;

/** Flags value that enables Components V2 for a message. */
export const IS_COMPONENTS_V2 = 1 << 15; // 32768

/** Ephemeral flag, can be combined with IS_COMPONENTS_V2. */
export const EPHEMERAL = 1 << 6; // 64

export const LIMITS = {
  /** Max total components per message (counted recursively). */
  MAX_TOTAL_COMPONENTS: 40,
  /** Max direct children of a container. */
  MAX_CONTAINER_CHILDREN: 10,
  /** Min/max text displays inside a section. */
  MIN_SECTION_TEXTS: 1,
  MAX_SECTION_TEXTS: 3,
  /** Min/max items inside a media gallery. */
  MIN_GALLERY_ITEMS: 1,
  MAX_GALLERY_ITEMS: 10,
  /** Min/max interactive components inside an action row. */
  MIN_ACTION_ROW_CHILDREN: 1,
  MAX_ACTION_ROW_CHILDREN: 5,
} as const;
