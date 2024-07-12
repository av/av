import * as d3 from 'd3';

import skillList, { skillTypes, Skill } from './skillList';
import { PageSection } from '../lib/PageSection';
import SelectablePills from '../lib/SelectablePills';
import { toggleDisplay } from '../utils';

export default class SkillsSection extends PageSection<typeof SkillsSection.config> {
  static config = {
    container: 'section.skills',
    elements: {
      skillsMap: '.skills-container',
      pills: '.pills',
      mapPill: '.map-pill',
      listPill: '.list-pill',
    },
  }

  width: number;
  height: number;
  padding: number;

  color: d3.ScaleOrdinal<string, string, never>;

  x: d3.ScaleLinear<number, number, never>;
  y: d3.ScaleLinear<number, number, never>;
  z: d3.ScaleLinear<number, number, never>;

  zoom: d3.ZoomBehavior<Element, unknown>;

  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  mapContainer: d3.Selection<SVGGElement, unknown, null, undefined>;
  skills: d3.Selection<SVGGElement, Skill, SVGGElement, unknown>;

  pills: SelectablePills;

  constructor() {
    super(SkillsSection.config);
  }

  init() {
    this.updateViewport();
    this.color = d3.scaleOrdinal(
      skillTypes.map((_, i) => d3.interpolateCool(i / skillTypes.length))
    );

    this.x = d3.scaleLinear().domain([0, 1]).range([this.padding, this.width - this.padding]);
    this.y = d3.scaleLinear().domain([0, 1]).range([this.height - this.padding, this.padding]);
    this.z = d3.scaleLinear().domain([0, 1]).range([5, 10]);

    this.zoom = d3.zoom()
      .scaleExtent([1, 5])
      .translateExtent([
        [0, 0],
        [this.width, this.height],
      ])
      .on('zoom', (e) => {
        this.mapContainer.attr('transform', e.transform.toString());
        this.skills.attr('transform', `scale(${1 / e.transform.k})`);
      });

    this.svg = d3
      .select(this.elements.skillsMap)
      .append('svg')
      .attr('viewBox', [0, 0, this.width, this.height].join(', '))
      .attr('width', this.width)
      .attr('height', this.height)
      .call(this.zoom);

    this.mapContainer = this.svg.append('g');

    this.skills = this.mapContainer
      .append('g')
      .selectAll('.skill-node')
      .data(skillList)
      .enter()
      .append('g')
      .attr('class', 'skill-node')
      .attr(
        'transform',
        (d) => `translate(${this.x(d.interest)}, ${this.y(d.level) + this.z(d.importance) + 2})`
      )
      .append('g')
      .attr('class', 'skill-scaler');

    this.skills
      .append('g')
      .attr('transform', (d) => `translate(0, ${this.z(d.importance) + 4})`)
      .append('text')
      .attr('class', 'skill-name')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'hanging')
      .style('pointer-events', 'none')
      .text((d) => d.name);

    this.skills
      .append('circle')
      .on('mouseover', (e, d) => {
        this.skills.filter((skill) => skill.name !== d.name).style('opacity', 0.1);
        this.skills.filter((skill) => skill.name === d.name).raise();
      })
      .on('mouseout', (e, d) => {
        this.skills.style('opacity', 1);
      })
      .attr('data-type', (d) => d.type)
      .style('fill', (d) => this.color(d.type))
      .transition()
      .duration(600)
      .delay((_, i) => i * 10)
      .attr('r', (d) => this.z(d.importance));

    this.pills = new SelectablePills({
      container: this.elements.pills,
      pills: skillTypes,
      onChange: (type) => {
        if (type) {
          this.skills.style('opacity', (d) => (d.type === type ? 1 : 0.1));
        } else {
          this.skills.style('opacity', 1);
        }
      },
      content: (pills) => {
        pills
          .append('div')
          .attr('class', 'color')
          .attr('style', (d) => `background: ${this.color(d)};`);

        pills
          .append('span')
          .attr('class', 'name')
          .text((d) => d);
      },
    });

    this.showMap();
  }

  updateViewport() {
    this.width = this.elements.skillsMap.getBoundingClientRect().width;
    this.height = window.innerHeight * 0.5;
    this.padding = 50;
  }

  showMap() {
    toggleDisplay(this.elements.mapPill, false);
    toggleDisplay(this.elements.listPill, true);
  }

  showList() {
    toggleDisplay(this.elements.mapPill, true);
    toggleDisplay(this.elements.listPill, false);
  }
}
