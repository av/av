import { qs } from '../utils';

export type PageSectionConfig = {
  container: string;
  elements: Record<string, string>;
}

export type ActionsMap = Record<string, () => void>;

export class PageSection<Config extends PageSectionConfig> {
  config: Config;

  container: HTMLElement;

  elements = {} as {
    [key in keyof Config['elements']]: HTMLElement;
  };

  constructor(config: Config) {
    this.config = config;
    this.container = qs(config.container);

    for (const key in config.elements) {
      this.elements[key as keyof typeof this.elements] = this.qs(config.elements[key]);
    }
  }

  qs(selector: string): HTMLElement {
    return this.container.querySelector(selector);
  }

  actions(actions: ActionsMap) {
    for (const [selector, listener] of Object.entries(actions)) {
      this.qs(selector).addEventListener('click', listener);
    }
  }
}
