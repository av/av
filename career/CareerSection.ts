import * as d3 from "d3";
import events, { tags, tagColors } from "./timelineEvents";
import SelectablePills from "./SelectablePills";
import TimelineVisualisation from "./TimelineVisualisation";
import { formatDateRange, updateGeneratedContent, qs } from "../utils";
import ListVisualisation from "./ListVisualisation";

export default class CareerSection {
  static selectors = {
    container: "section.career",
    timeline: ".canvas-container",
    pills: ".pills",
    zoomCareer: ".zoom-pill.career",
    zoomLife: ".zoom-pill.life",
    listView: ".list-pill",
    timelineContainer: '.timeline-container',
    listContainer: '.list-container',
  };

  timeline: TimelineVisualisation;
  list: ListVisualisation;
  pills: SelectablePills;
  container: HTMLElement;
  timelineContainer: HTMLElement;
  listContainer: HTMLElement;

  constructor() {
    this.container = qs(CareerSection.selectors.container);
    this.timelineContainer = qs(CareerSection.selectors.timelineContainer);
    this.listContainer = qs(CareerSection.selectors.listContainer);

    this.timeline = new TimelineVisualisation({
      container: this.container.querySelector(CareerSection.selectors.timeline),
      events,
    });

    this.list = new ListVisualisation({
      container: this.listContainer,
      events,
    })

    this.pills = new SelectablePills({
      container: this.container.querySelector(CareerSection.selectors.pills),
      pills: tags,
      onChange: (selected) => {
        this.timeline.highlight(selected);
      },
    });
  }

  init() {
    this.timeline.start();

    const careerEvent = events.find((e) => e.config.id === "career");
    const lifeEvent = events.find((e) => e.config.id === "life");

    this.container
      .querySelector(".pill.career")
      .addEventListener("click", () => {
        this.timeline.zoomIn(careerEvent);
      });

    this.container
      .querySelector(".pill.life")
      .addEventListener("click", () => {
        this.timeline.zoomIn(lifeEvent);
      });

    this.container.querySelector(".list-pill").addEventListener("click", () => {
      this.showList();
    });

    this.container.querySelector(".timeline-pill").addEventListener("click", () => {
      this.showTimeline();
    });
  }

  showTimeline() {
    this.timelineContainer.style.display = "block";
    this.listContainer.style.display = "none";
  }

  showList() {
    if (!this.list.ready) {
      this.list.init();
    }

    this.timelineContainer.style.display = "none";
    this.listContainer.style.display = "block";
  }
}
