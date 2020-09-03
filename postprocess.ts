import { map } from "./utils";

export function run() {
  window.addEventListener("DOMContentLoaded", () => {
    reduceSplitterContents();
    redrawSVGViewBoxes();
  });  
}

function reduceSplitterContents() {
  const splitters = Array.from(document.querySelectorAll("section.splitter"));

  for (const splitter of splitters) {
    const circles = Array.from(splitter.querySelectorAll(".circle"));
    const desiredCount = Math.floor(
      map(window.innerWidth, [400, 1000], [10, 30])
    );

    let difference = circles.length - desiredCount;

    while (difference > 0) {
      const circle = circles.pop();
      circle.parentNode.removeChild(circle);
      difference--;
    }
  }
}

function redrawSVGViewBoxes() {
  const icons = Array.from(
    document.querySelectorAll("section.contacts ul.links svg")
  );

  icons.map((svg) => svg.setAttribute("viewBox", "-6 -6 36 36"));
}
