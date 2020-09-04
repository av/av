import * as d3 from "d3";

interface SelectablePillsConfig {
  container: HTMLElement;
  pills: Array<string>;
  onChange(selected: Array<string>): void;
  content?(
    pills: d3.Selection<HTMLDivElement, string, HTMLElement, unknown>
  ): void;
}

export default class SelectablePills {
  config: SelectablePillsConfig;
  selected: Array<string> = [];
  pills: d3.Selection<HTMLDivElement, string, HTMLElement, unknown>;

  constructor(config: SelectablePillsConfig) {
    this.config = config;

    this.pills = d3
      .select(this.config.container)
      .selectAll(".pill.tag")
      .data(this.config.pills)
      .enter()
      .append("div")
      .on("click", (pill) => {
        const otherPills = this.pills.filter((otherPill) => otherPill !== pill);
        const targetPill = this.pills.filter((otherPill) => otherPill === pill);
        
        otherPills.classed("selected", false);
        targetPill.classed("selected", !targetPill.classed("selected"));

        this.toggle(pill);
      })
      .attr("class", "pill tag");

    if (config.content) {
      config.content(this.pills);
    } else {
      this.pills.text((d) => d);
    }
  }

  toggle(pill: string) {
    if (this.selected.includes(pill)) {
      this.selected = [];
    } else {
      this.selected = [pill];
    }

    this.config.onChange(this.selected);
  }
}
