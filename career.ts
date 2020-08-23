import events from "./career/timelineEvents";
import TimelineVisualisation from "./career/TimelineVisualisation";

const visualisation = new TimelineVisualisation({
  container: document.querySelector("section.career"),
  events,
});

visualisation.start();