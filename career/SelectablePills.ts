import * as d3 from "d3";

interface SelectablePillsConfig {
  container: HTMLElement;
  pills: Array<string>;
  onChange(selected: Array<string>): void;
}

export default class SelectablePills {
  config: SelectablePillsConfig;
  selected: Array<string> = [];
  pills: d3.Selection<HTMLDivElement, string, HTMLElement, unknown>;

  constructor(config: SelectablePillsConfig) {
    this.config = config;

    this.pills = d3
      .select(this.config.container)
      .selectAll(".pill")
      .data(this.config.pills)
      .enter()
      .append("div")
      .on("click", (pill) => {
        this.pills.each(function (otherPill) {
          if (otherPill !== pill) {
            this.classList.toggle("selected", false);
          }
        });

        d3.event.target.classList.toggle("selected");
        this.toggle(pill);
      })
      .attr("class", "pill")
      .text((d) => d);
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
