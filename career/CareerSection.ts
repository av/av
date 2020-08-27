import events, { tags } from "./timelineEvents";
import SelectablePills from "./SelectablePills";
import TimelineVisualisation from "./TimelineVisualisation";

export default class CareerSection {
  static selectors = {
    container: "section.career",
    timeline: ".canvas-container",
    pills: ".pills",
    zoomCareer: ".zoom-pill.career",
    zoomLife: ".zoom-pill.life",
  };

  visualisation: TimelineVisualisation;
  pills: SelectablePills;
  container: HTMLElement;

  constructor() {
    this.container = document.querySelector(CareerSection.selectors.container);

    this.visualisation = new TimelineVisualisation({
      container: this.container.querySelector(CareerSection.selectors.timeline),
      events,
    });

    this.pills = new SelectablePills({
      container: this.container.querySelector(CareerSection.selectors.pills),
      pills: tags,
      onChange: (selected) => {
        this.visualisation.highlight(selected);
      },
    });
  }

  init() {
    this.visualisation.start();

    const careerEvent = events.find((e) => e.config.id === "career");
    const lifeEvent = events.find((e) => e.config.id === "life");

    this.container
      .querySelector(".zoom-pill.career")
      .addEventListener("click", () => {
        this.visualisation.zoomIn(careerEvent);
      });

    this.container
      .querySelector(".zoom-pill.life")
      .addEventListener("click", () => {
        this.visualisation.zoomIn(lifeEvent);
      });
  }
}
