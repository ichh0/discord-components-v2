import { APIMessageComponent, ComponentType } from "discord-api-types/v10";
import { AnyComponent, COMPONENTS_V2_FLAG } from "../core/Component";

/**
 * Проверяет, является ли объект компонентом V2 (имеет флаг).
 */
export function isComponentsV2(flags?: number): boolean {
  return (flags ?? 0) & COMPONENTS_V2_FLAG ? true : false;
}

/**
 * Преобразует массив наших компонентов в формат, ожидаемый discord.js.
 * discord.js принимает объекты, совместимые с APIMessageComponent.
 */
export function toDiscordJsComponents(components: AnyComponent[]): APIMessageComponent[] {
  return components as APIMessageComponent[];
}

/**
 * Преобразует компоненты из discord.js в наш формат (AnyComponent[]).
 */
export function fromDiscordJsComponents(components: APIMessageComponent[]): AnyComponent[] {
  return components as AnyComponent[];
}

/**
 * Создаёт объект ответа для discord.js с компонентами и флагом V2.
 */
export function createDiscordJsReply(
  components: AnyComponent[],
  flags?: number,
): {
  components: APIMessageComponent[];
  flags?: number;
} {
  const result: {
    components: APIMessageComponent[];
    flags?: number;
  } = {
    components: toDiscordJsComponents(components),
  };
  if (flags !== undefined) {
    result.flags = flags | COMPONENTS_V2_FLAG;
  }
  return result;
}
