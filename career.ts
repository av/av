import mediumZoom from "medium-zoom";
import events from "./career/timelineEvents";
import TimelineVisualisation from "./career/TimelineVisualisation";

const visualisation = new TimelineVisualisation({
  container: document.querySelector("section.career"),
  events,
});

visualisation.start();

mediumZoom("[data-zoomable]", {
  background: "rgba(0, 0, 0, .5)",
}).on("close", (e) => {
  console.log(e);
});
