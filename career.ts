import events, { tags } from "./career/timelineEvents";
import TimelineVisualisation from "./career/TimelineVisualisation";
import SelectablePills from "./career/SelectablePills";

const container: HTMLElement = document.querySelector("section.career");
const visualisation = new TimelineVisualisation({
  container: container.querySelector(".canvas-container"),
  events,
});

new SelectablePills({
  container: container.querySelector(".pills"),
  pills: tags,
  onChange: (selected) => {
    visualisation.highlight(selected);
  },
});

visualisation.start();

const careerEvent = events.find((e) => e.config.id === "career");
const lifeEvent = events.find((e) => e.config.id === "life");

container.querySelector('.zoom-pill.career').addEventListener('click', () => {
  visualisation.zoomIn(careerEvent);
});

container.querySelector('.zoom-pill.life').addEventListener('click', () => {
  visualisation.zoomIn(lifeEvent);
});