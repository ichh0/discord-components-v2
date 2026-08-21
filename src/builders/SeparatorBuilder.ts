import { APISeparatorComponent, ComponentType } from "discord-api-types/v10";

import { createEmptyComponent } from "../core/Component";

export class SeparatorBuilder {
  private data: APISeparatorComponent;

  constructor() {
    this.data = createEmptyComponent(ComponentType.Separator) as APISeparatorComponent;
  }

  build(): APISeparatorComponent {
    return this.data;
  }
}
