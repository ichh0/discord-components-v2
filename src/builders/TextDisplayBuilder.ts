import { APITextDisplayComponent, ComponentType } from "discord-api-types/v10";

import { createEmptyComponent } from "../core/Component";

export type TextDisplayOptions = {
  content?: string;
  spoiler?: boolean;
};

export class TextDisplayBuilder {
  private data: APITextDisplayComponent;

  constructor(options?: TextDisplayOptions) {
    this.data = createEmptyComponent(ComponentType.TextDisplay) as APITextDisplayComponent;
    if (options?.content !== undefined) {
      this.data.content = options.content;
    }
  }

  setContent(content: string): this {
    this.data.content = content;
    return this;
  }

  build(): APITextDisplayComponent {
    return this.data;
  }
}
