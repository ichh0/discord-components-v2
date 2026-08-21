import { AnyComponent, hasContent, hasCustomId } from "../core/Component";

export class ComponentSearcher {
  constructor(private components: AnyComponent[]) {}

  findByCustomId(customId: string): { component: AnyComponent; path: string[] } | null {
    return this.findByCustomIdRecursive(this.components, customId, []);
  }

  private findByCustomIdRecursive(
    components: AnyComponent[],
    customId: string,
    path: string[],
  ): { component: AnyComponent; path: string[] } | null {
    for (let i = 0; i < components.length; i++) {
      const node = components[i];
      const currentPath = [...path, i.toString()];

      if (hasCustomId(node) && node.custom_id === customId) {
        return { component: node, path: currentPath };
      }

      if ("components" in node && Array.isArray(node.components)) {
        const found = this.findByCustomIdRecursive(
          node.components as AnyComponent[],
          customId,
          currentPath,
        );
        if (found) return found;
      }
    }
    return null;
  }

  findAllByType(type: number): { component: AnyComponent; path: string[] }[] {
    const results: { component: AnyComponent; path: string[] }[] = [];
    this.findAllByTypeRecursive(this.components, type, [], results);
    return results;
  }

  private findAllByTypeRecursive(
    components: AnyComponent[],
    type: number,
    path: string[],
    results: { component: AnyComponent; path: string[] }[],
  ): void {
    for (let i = 0; i < components.length; i++) {
      const node = components[i];
      const currentPath = [...path, i.toString()];

      if (node.type === type) {
        results.push({ component: node, path: currentPath });
      }

      if ("components" in node && Array.isArray(node.components)) {
        this.findAllByTypeRecursive(node.components as AnyComponent[], type, currentPath, results);
      }
    }
  }

  findByContent(search: string | RegExp): { component: AnyComponent; path: string[] }[] {
    const results: { component: AnyComponent; path: string[] }[] = [];
    this.findByContentRecursive(this.components, search, [], results);
    return results;
  }

  private findByContentRecursive(
    components: AnyComponent[],
    search: string | RegExp,
    path: string[],
    results: { component: AnyComponent; path: string[] }[],
  ): void {
    for (let i = 0; i < components.length; i++) {
      const node = components[i];
      const currentPath = [...path, i.toString()];

      if (hasContent(node)) {
        const content = node.content;
        const matches =
          typeof search === "string" ? content.includes(search) : search.test(content);
        if (matches) {
          results.push({ component: node, path: currentPath });
        }
      }

      if ("components" in node && Array.isArray(node.components)) {
        this.findByContentRecursive(
          node.components as AnyComponent[],
          search,
          currentPath,
          results,
        );
      }
    }
  }
}
