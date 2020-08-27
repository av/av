import * as d3 from "d3";
import skillList from "./skillList";

const container = document.querySelector("section.skills > .skills-container");
const width = container.getBoundingClientRect().width;
const height = window.innerHeight * 0.6;
const padding = 50;
const types = [
  "lang",
  "runtime",
  "framework",
  "lib",
  "tool",
  "cloud",
  "database",
];
const colorScale = d3.scaleOrdinal(
  types.map((_, i) => d3.interpolateCool(i / types.length))
);

const x = d3
  .scaleLinear()
  .domain([0, 1])
  .range([padding, width - padding]);
const y = d3
  .scaleLinear()
  .domain([0, 1])
  .range([height - padding, padding]);
const z = d3.scaleLinear().domain([0, 1]).range([5, 10]);

const svg = d3
  .select(container)
  .append("svg")
  .attr("viewBox", [0, 0, width, height].join(", "))
  .attr("width", width)
  .attr("height", height);

const zoom = d3
  .zoom()
  .scaleExtent([1, 5])
  .translateExtent([
    [0, 0],
    [width, height],
  ])
  .on("zoom", () => {
    chartContainer.attr("transform", d3.event.transform.toString());
  });

const chartContainer = svg.append("g");
svg.call(zoom);

const skills = chartContainer
  .append("g")
  .attr("fill", "red")
  .selectAll("circle")
  .data(skillList)
  .enter()
  .append("g")
  .attr("class", "skill-node")
  .attr(
    "transform",
    (d) => `translate(${x(d.interest)}, ${y(d.level) + z(d.importance) + 2})`
  );

skills
  .append("g")
  .attr("transform", (d) => `translate(0, ${z(d.importance) + 4})`)
  .append("text")
  .attr("class", "skill-name")
  .attr("text-anchor", "middle")
  .attr("alignment-baseline", "hanging")
  .text((d) => d.name);

skills
  .append("circle")
  .on("mouseover", (d) => {
    skills.filter((skill) => skill.name !== d.name).style("opacity", 0.3);
    skills.filter((skill) => skill.name === d.name).raise();
  })
  .on("mouseout", (d) => {
    skills.style("opacity", 1);
  })
  .attr("data-type", (d) => d.type)
  .style("fill", (d) => colorScale(d.type))
  .transition()
  .duration(600)
  .delay((d, i) => i * 10)
  .attr("r", (d) => z(d.importance));

const legend = d3
  .select("section.skills .legend-container")
  .append("p")
  .attr("class", "legend")
  .selectAll(".skill-type")
  .data(types)
  .enter();

const skillType = legend.append("div").attr("class", "skill-type");

skillType
  .on("mouseenter touchstart", (d) => {
    skills.style("opacity", 0.1);
    skills
      .filter((skill) => skill.type === d)
      .raise()
      .style("opacity", 1);
  })
  .on("mouseleave", () => {
    skills.style("opacity", 1).style("z-index", 0);
  });

skillType
  .append("div")
  .attr("class", "color")
  .attr("style", (d) => `background: ${colorScale(d)};`);

skillType
  .append("span")
  .attr("class", "name")
  .text((d) => d);
