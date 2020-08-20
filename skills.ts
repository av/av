import * as d3 from "d3";
import skillList from "./skillList";
import { contourDensity } from "d3";

const container = document.querySelector("section.skills > .skills-container");
const width = container.getBoundingClientRect().width;
const height = window.innerHeight * .6;
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
  // d3.schemeRdYlBu[types.length]
);

const x = d3
  .scaleLinear()
  .domain([0, 1])
  .range([padding, width - padding]);
const y = d3
  .scaleLinear()
  .domain([0, 1])
  .range([height - padding, padding]);
const z = d3.scaleLinear().domain([0, 1]).range([5, 20]);

const svg = d3
  .select(container)
  .append("svg")
  .attr("viewBox", [0, 0, width, height].join(", "))
  .attr("width", width)
  .attr("height", height);

svg
  .append("g")
  .attr("class", "axis-x")
  .call(
    d3
      .axisBottom(x)
      .ticks(width / 100)
      .tickFormat(() => "")
  )
  .attr("transform", `translate(0, ${height - padding})`);

svg
  .append("g")
  .attr("transform", `translate(${width / 2}, ${height - 20})`)
  .append("text")
  .attr("text-anchor", "middle")
  .attr("class", "axis-label")
  .text("Interest 🡒");

svg
  .append("g")
  .attr("class", "axis-y")
  .call(d3.axisLeft(y).tickFormat(() => ""))
  .attr("transform", `translate(${padding}, 0)`);

svg
  .append("g")
  .attr("transform", `translate(30, ${height / 2}) rotate(-90)`)
  .append("text")
  .attr("text-anchor", "middle")
  .attr("class", "axis-label")
  .text("Experience 🡒");

const tooltip = d3
  .select("body")
  .append("div")
  .attr("class", "skill-tooltip")
  .style("opacity", "0");

const skills = svg
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
  .attr("transform", (d) => `translate(0, ${z(d.importance)})`)
  .append("text")
  .attr("class", "skill-name")
  .attr("text-anchor", "middle")
  .attr("alignment-baseline", "hanging")
  .text((d) => d.name);

skills
  .append("circle")
  .on("mouseover", (d) => {
    tooltip
      .style("left", `${d3.event.pageX}px`)
      .style("top", `${d3.event.pageY + 10}px`);

    tooltip.transition().duration(150).style("opacity", 1).text(d.name);
  })
  .on("mouseout", (d) => {
    tooltip.transition().duration(150).style("opacity", 0);
  })
  .attr("data-type", (d) => d.type)
  .attr("r", (d) => z(d.importance))
  .style("fill", (d) => colorScale(d.type));

const legend = d3
  .select("section.skills")
  .append("p")
  .attr("class", "legend")
  .selectAll(".skill-type")
  .data(types)
  .enter();

const skillType = legend.append("div").attr("class", "skill-type");

skillType
  .on("mouseenter", (d) => {
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
