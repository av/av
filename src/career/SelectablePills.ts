import * as d3 from 'd3';

interface SelectablePillsConfig {
  /**
   * A DOM node to host the component.
   */
  container: HTMLElement;

  /**
   * An array of strings to
   * be rendered as pills.
   */
  pills: Array<string>;

  /**
   * Will be called when pill
   * gets activated or deactivated
   *
   * @param selected - selected pill
   */
  onChange(selected: string): void;

  /**
   * If specified, will allow to tweak the contents
   * of rendered pills
   *
   * @param pills - D3 selection with pills nodes
   */
  content?(
    pills: d3.Selection<HTMLDivElement, string, HTMLElement, unknown>
  ): void;
}

/**
 * Implements a very simple set of pills which
 * could be toggled, one at a time
 */
export default class SelectablePills {
  config: SelectablePillsConfig;
  selected: string | null = null;
  pills: d3.Selection<HTMLDivElement, string, HTMLElement, unknown>;

  constructor(config: SelectablePillsConfig) {
    this.config = config;

    // Render given pills to the DOM and assign
    this.pills = d3
      .select(this.config.container)
      .selectAll('.pill.tag')
      .data(this.config.pills)
      .enter()
      .append('div')
      .on('click', (e, pill) => {
        const otherPills = this.pills.filter((otherPill) => otherPill !== pill);
        const targetPill = this.pills.filter((otherPill) => otherPill === pill);

        otherPills.classed('selected', false);
        targetPill.classed('selected', !targetPill.classed('selected'));

        this.toggle(pill);
      })
      .attr('class', 'pill tag');

    // Postprocess the pills, adding ability for
    // an outside
    if (config.content) {
      config.content(this.pills);
    } else {
      this.pills.text((d) => d);
    }
  }

  /**
   * Toggles given pill selection.
   *
   * @param pill - one of the ids passed in the {SelectablePillsConfig}
   */
  toggle(pill: string) {
    if (this.selected === pill) {
      this.selected = null;
    } else {
      this.selected = pill;
    }

    this.config.onChange(this.selected);
  }
}
