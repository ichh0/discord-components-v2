/**
 * Представление эмодзи в Discord API.
 */
export interface EmojiObject {
  name?: string;
  id?: string;
  animated?: boolean;
}

/**
 * Парсит строку с эмодзи в объект для Discord API.
 * Поддерживает:
 * - Unicode эмодзи (например, "😊") → { name: "😊" }
 * - Кастомный эмодзи вида :name: (без ID) → { name: "name" }
 * - Кастомный эмодзи с ID вида <:name:123456789> → { name: "name", id: "123456789", animated: false }
 * - Анимированный кастомный эмодзи <a:name:123456789> → { name: "name", id: "123456789", animated: true }
 */
export function parseEmoji(input: string): EmojiObject | null {
  if (!input) return null;

  // Удаляем лишние пробелы
  input = input.trim();

  // Проверяем на кастомный эмодзи в формате <:name:id> или <a:name:id>
  const customMatch = input.match(/^<(?<animated>a)?:(?<name>\w+):(?<id>\d+)>$/);
  if (customMatch) {
    const groups = customMatch.groups!;
    return {
      name: groups.name,
      id: groups.id,
      animated: groups.animated === "a",
    };
  }

  // Проверяем на :name: (без ID) – часто используется для сокращения
  const nameMatch = input.match(/^:(?<name>\w+):$/);
  if (nameMatch) {
    return { name: nameMatch.groups!.name };
  }

  // В противном случае считаем, что это Unicode эмодзи или обычный текст
  // (Discord принимает любой текст как name)
  return { name: input };
}
