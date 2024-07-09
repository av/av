import * as d3 from 'd3';

import { qs } from '../utils';
import skillList, { skillTypes } from './skillList';
import SelectablePills from '../career/SelectablePills';

export const selectors = {
  container: 'section.skills .skills-container',
  pills: 'section.skills .pills',
};

export function init(selectors) {
  const container = qs(selectors.container);
  const color = computeColorScale(skillTypes);
  const [width, height, padding] = getVisualisationParams(container);
  const [x, y, z] = buildScales(width, height, padding);

  const zoom = getZoom(width, height).on('zoom', (e) => {
    chartContainer.attr('transform', e.transform.toString());
    skills.attr('transform', `scale(${1 / e.transform.k})`);
  });

  const svg = getSvg(container, width, height).call(zoom);
  const chartContainer = svg.append('g');

  const skills = chartContainer
    .append('g')
    .selectAll('.skill-node')
    .data(skillList)
    .enter()
    .append('g')
    .attr('class', 'skill-node')
    .attr(
      'transform',
      (d) => `translate(${x(d.interest)}, ${y(d.level) + z(d.importance) + 2})`
    )
    .append('g')
    .attr('class', 'skill-scaler');

  skills
    .append('g')
    .attr('transform', (d) => `translate(0, ${z(d.importance) + 4})`)
    .append('text')
    .attr('class', 'skill-name')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'hanging')
    .style('pointer-events', 'none')
    .text((d) => d.name);

  skills
    .append('circle')
    .on('mouseover', (e, d) => {
      skills.filter((skill) => skill.name !== d.name).style('opacity', 0.1);
      skills.filter((skill) => skill.name === d.name).raise();
    })
    .on('mouseout', (e, d) => {
      skills.style('opacity', 1);
    })
    .attr('data-type', (d) => d.type)
    .style('fill', (d) => color(d.type))
    .transition()
    .duration(600)
    .delay((_, i) => i * 10)
    .attr('r', (d) => z(d.importance));

  new SelectablePills({
    container: qs(selectors.pills),
    pills: skillTypes,
    onChange: (type) => {
      if (type) {
        skills.style('opacity', (d) => (d.type === type ? 1 : 0.1));
      } else {
        skills.style('opacity', 1);
      }
    },
    content: (pills) => {
      pills
        .append('div')
        .attr('class', 'color')
        .attr('style', (d) => `background: ${color(d)};`);

      pills
        .append('span')
        .attr('class', 'name')
        .text((d) => d);
    },
  });
}

function getVisualisationParams(container: HTMLElement) {
  return [
    container.getBoundingClientRect().width,
    window.innerHeight * 0.5,
    50,
  ];
}

function computeColorScale(items: Array<any>) {
  return d3.scaleOrdinal(
    items.map((_, i) => d3.interpolateCool(i / items.length))
  );
}

function buildScales(width, height, padding) {
  return [
    d3
      .scaleLinear()
      .domain([0, 1])
      .range([padding, width - padding]),
    d3
      .scaleLinear()
      .domain([0, 1])
      .range([height - padding, padding]),
    d3.scaleLinear().domain([0, 1]).range([5, 10]),
  ];
}

function getSvg(container, width, height) {
  return d3
    .select(container)
    .append('svg')
    .attr('viewBox', [0, 0, width, height].join(', '))
    .attr('width', width)
    .attr('height', height);
}

function getZoom(width, height) {
  return d3
    .zoom()
    .scaleExtent([1, 5])
    .translateExtent([
      [0, 0],
      [width, height],
    ]);
}
