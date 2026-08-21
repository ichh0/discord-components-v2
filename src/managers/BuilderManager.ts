import { AnyComponent, hasContent, hasCustomId, isButton } from "../core/Component";
import { cloneDeep } from "../utils/cloneDeep";
import { ComponentSearcher } from "./ComponentSearcher";

export class BuilderManager {
  private components: AnyComponent[];

  constructor(components: AnyComponent[]) {
    this.components = cloneDeep(components);
  }

  search(): ComponentSearcher {
    return new ComponentSearcher(this.components);
  }

  // Найти компонент по custom_id (первый)
  findByCustomId(customId: string): { component: AnyComponent; path: string[] } | null {
    return this.search().findByCustomId(customId);
  }

  // Найти все компоненты по типу
  findAllByType(type: number): { component: AnyComponent; path: string[] }[] {
    return this.search().findAllByType(type);
  }

  // Найти все компоненты по содержанию
  findByContent(search: string | RegExp): { component: AnyComponent; path: string[] }[] {
    return this.search().findByContent(search);
  }

  // Установить label для кнопки
  setButtonLabel(customId: string, label: string): this {
    const result = this.findByCustomId(customId);
    if (result && isButton(result.component) && "label" in result.component) {
      result.component.label = label;
    }
    return this;
  }

  // Установить стиль для кнопки
  setButtonStyle(customId: string, style: number): this {
    const result = this.findByCustomId(customId);
    if (result && isButton(result.component) && "style" in result.component) {
      result.component.style = style;
    }
    return this;
  }

  // Отключить кнопки
  disableButtons(customId?: string): this {
    const buttons = customId
      ? [this.findByCustomId(customId)].filter(Boolean)
      : this.findAllByType(2); // type 2 = Button

    for (const entry of buttons) {
      if (entry && isButton(entry.component)) {
        entry.component.disabled = true;
      }
    }
    return this;
  }

  // Замена текста во всех компонентах с content
  replaceText(search: string | RegExp, replacement: string): this {
    const results = this.findByContent(search);
    for (const result of results) {
      if (hasContent(result.component)) {
        result.component.content = result.component.content.replace(search, replacement);
      }
    }
    return this;
  }

  // Удалить строки, содержащие поисковую фразу
  removeLinesContaining(search: string | RegExp): this {
    const results = this.findByContent(search);
    const predicate =
      typeof search === "string"
        ? (line: string) => line.includes(search)
        : (line: string) => search.test(line);

    for (const result of results) {
      if (hasContent(result.component)) {
        const lines = result.component.content.split("\n");
        const filtered = lines.filter((line) => !predicate(line));
        result.component.content = filtered.join("\n");
      }
    }
    return this;
  }

  // Удалить конкретные строки по индексу
  removeLines(startIndex: number, count: number = 1): this {
    const results = this.findAllByType(10); // TextDisplay
    for (const result of results) {
      if (hasContent(result.component)) {
        const lines = result.component.content.split("\n");
        lines.splice(startIndex, count);
        result.component.content = lines.join("\n");
      }
    }
    return this;
  }

  // Вернуть массив компонентов
  toJSON(): AnyComponent[] {
    return this.components;
  }
}
