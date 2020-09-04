import * as d3 from "d3";
import { qs, qsa, scrollTo } from "../utils";
import InterpolatedValue from "../career/InterpolatedValue";

export const selectors = {
  container: "section.intro",
  decorations: "section.intro .decoration",
  pills: "section.intro .pill[data-target]",
};

export function init(selectors) {
  const container = qs(selectors.container);
  const decorations = qsa(selectors.decorations);
  const pills = qsa(selectors.pills);
  const mousePosition = new InterpolatedValue([0, 0]);

  d3.select(selectors.container).on("pointermove", () => {
    mousePosition.setValue([d3.event.pageX, d3.event.pageY]);
  });

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      scrollTo(pill.dataset.target);
    });
  });

  update();

  function update() {
    mousePosition.tick();
    const containerRect = container.getBoundingClientRect();
    const offset = [
      mousePosition.value[0] / (containerRect.right - containerRect.left),
      mousePosition.value[1] / (containerRect.bottom - containerRect.top),
    ];

    for (const decoration of decorations) {
      const force = parseInt(decoration.dataset.force);
      decoration.style.transform = `translate(${offset.map(
        (v) => `${(v * force).toFixed(3)}%`
      )})`;
    }

    window.requestAnimationFrame(update);
  }
}
