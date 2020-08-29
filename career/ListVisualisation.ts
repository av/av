import * as d3 from "d3";
import { formatDateRange, updateGeneratedContent, qs } from "../utils";
import TimelineEvent from "./TimelineEvent";

interface ListVisualisationConfig {
  container: HTMLElement;
  events: Array<TimelineEvent>;
}

export default class ListVisualisation {
  config: ListVisualisationConfig;
  ready = false;

  constructor(config: ListVisualisationConfig) {
    this.config = config;
  }

  init() {
    const { container, events } = this.config;
    const ids = events.map((e) => e.config.id);
    const content = new Map<string, any>();

    for (const id of ids) {
      const template = document.querySelector<HTMLTemplateElement>(
        `#modal-${id}-template`
      ).content;

      content.set(id, {
        header: template.querySelector(".modal-title").cloneNode(true),
        content: template.querySelector(".modal-content").cloneNode(true),
      });
    }

    const list = d3
      .select(container)
      .selectAll(".timeline-event")
      .data(
        events.sort(
          (a, b) => a.config.start.valueOf() - b.config.start.valueOf()
        )
      )
      .enter()
      .append("div")
      .attr("class", "timeline-event collapsed")
      .style("border-left", (d) => {
        return `.25rem solid ${d.config.color}`;
      });

    const header = list
      .append((d) => content.get(d.config.id).header)
      .on("click", (d) => {
        const node = list
          .filter((item) => item.config.id === d.config.id)
          .node();

        const currentHeight = node.getBoundingClientRect().height;
        node.style.height = "auto";
        node.classList.add("no-transition");
        node.classList.toggle("collapsed");
        const newHeight = node.getBoundingClientRect().height;
        node.style.height = `${currentHeight}px`;
        node.classList.remove("no-transition");
        requestAnimationFrame(() => {
          node.style.height = `${newHeight}px`;
        });
      });

    header
      .append("span")
      .attr("class", "event-dates")
      .text((d) => `(${formatDateRange(d.config.start, d.config.end)})`);

    header.append("div").attr("class", "chevron").text("👈");

    list.append((d) => content.get(d.config.id).content);
    updateGeneratedContent();
    this.ready = true;
  }
}
