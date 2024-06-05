import * as d3 from 'd3';
import { formatDateRange, initEmbeddables, qs } from '../utils';
import TimelineEvent from './TimelineEvent';

interface ListVisualisationConfig {
  container: HTMLElement;
  events: Array<TimelineEvent>;
}

type ContentMap = Map<string, { header: HTMLElement; content: HTMLElement }>;

/**
 * A list of accordions, representing the same
 * events as the timeline visualisation.
 */
export default class ListVisualisation {
  /**
   * Locators for the DOM nodes of the component
   */
  static selectors = {
    modalTitle: '.modal-title',
    modalContent: '.modal-content',
    timelineEvent: '.timeline-event',
  };

  /**
   * Holds the reference to the component config.
   */
  config: ListVisualisationConfig;

  /**
   * Flags that this component was initialised and
   * ready for use.
   */
  ready = false;

  list: d3.Selection<HTMLElement, TimelineEvent, HTMLElement, unknown>;

  constructor(config: ListVisualisationConfig) {
    this.config = config;
  }

  /**
   * Intialises the component and renders
   * all the necessary elements to the DOM.
   */
  init() {
    const { container, events } = this.config;
    const ids = events.map((e) => e.config.id);
    const content: ContentMap = new Map();

    for (const id of ids) {
      const template = qs<HTMLTemplateElement>(`#modal-${id}-template`).content;

      content.set(id, {
        header: template
          .querySelector(ListVisualisation.selectors.modalTitle)
          .cloneNode(true) as HTMLElement,
        content: template
          .querySelector(ListVisualisation.selectors.modalContent)
          .cloneNode(true) as HTMLElement,
      });
    }

    this.list = d3
      .select(container)
      .selectAll(ListVisualisation.selectors.timelineEvent)
      .data(
        events.sort(
          (a, b) => a.config.start.valueOf() - b.config.start.valueOf()
        )
      )
      .enter()
      .append('div')
      .attr('class', 'timeline-event collapsed')
      .style('border-left', (d) => {
        return `.25rem solid ${d.config.color}`;
      });

    const header = this.list
      .append((d) => content.get(d.config.id).header)
      .on('click', (d) => {
        const node = this.list
          .filter((item) => item.config.id === d.config.id)
          .node();

        const currentHeight = node.getBoundingClientRect().height;
        node.style.height = 'auto';
        node.classList.add('no-transition');
        node.classList.toggle('collapsed');
        const newHeight = node.getBoundingClientRect().height;
        node.style.height = `${currentHeight}px`;
        node.classList.remove('no-transition');
        requestAnimationFrame(() => {
          node.style.height = `${newHeight}px`;
        });
      });

    header
      .append('span')
      .attr('class', 'event-dates')
      .text((d) => `(${formatDateRange(d.config.start, d.config.end)})`);

    header.append('div').attr('class', 'chevron').text('👈');

    this.list.append((d) => content.get(d.config.id).content);

    // Ensure that new content in DOM
    // is properly initialized
    initEmbeddables();

    // Done and done.
    this.ready = true;
  }

  /**
   * Toggles given list item closed state.
   *
   * @param d - D3 Selection Datum
   */
  toggleItem(d: TimelineEvent) {
    const node = this.list
      .filter((item) => item.config.id === d.config.id)
      .node();

    // Otain elements current height, to start transition
    const currentHeight = node.getBoundingClientRect().height;
    node.style.height = 'auto';
    node.classList.add('no-transition');
    node.classList.toggle('collapsed');

    // Prepare element for accepting new height
    const newHeight = node.getBoundingClientRect().height;
    node.style.height = `${currentHeight}px`;
    node.classList.remove('no-transition');

    // Will not work without rAF
    requestAnimationFrame(() => {
      // Kick off the transition
      node.style.height = `${newHeight}px`;
    });
  }
}
