import { map, any } from "./utils";
import AOS from "aos";
import "aos/dist/aos.css";

/**
 * Runs the postprocessing of the dom after DOMContentLoaded event.
 */
export function run() {
  window.addEventListener("DOMContentLoaded", () => {
    reduceSplitterContents();
    redrawSVGViewBoxes();
    AOS.init({
      duration: 400,
      easing: 'ease-out-sine'
    });
  });
}

/**
 * For smaller devices, reduces the amount of nodes
 * used in section splitters to reduce the rasterisation load.
 */
function reduceSplitterContents() {
  const splitters = Array.from(document.querySelectorAll("section.splitter"));

  for (const splitter of splitters) {
    const circles = Array.from(splitter.querySelectorAll(".circle"));
    const desiredCount = Math.floor(
      map(window.innerWidth, [400, 1000], [10, 30])
    );

    let difference = circles.length - desiredCount;

    while (difference > 0) {
      const circle = any(circles);
      circle.parentNode.removeChild(circle);
      circles.splice(circles.indexOf(circle), 1);
      difference--;
    }
  }
}

/**
 * Shrinks the viewboxes of contact icons replacing built-in values.
 */
function redrawSVGViewBoxes() {
  const icons = Array.from(
    document.querySelectorAll("section.contacts ul.links svg")
  );

  icons.map((svg) => svg.setAttribute("viewBox", "-6 -6 36 36"));
}
