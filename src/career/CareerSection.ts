import events, { tags } from './timelineEvents';
import SelectablePills from './SelectablePills';
import TimelineVisualisation from './TimelineVisualisation';
import ListVisualisation from './ListVisualisation';
import { qs, showModal } from '../utils';

/**
 * Implements behavior of Career, or 'Timeline' section.
 * Renders the visualisation and connects it to the selectable pills
 */
export default class CareerSection {
  static selectors = {
    container: 'section.career',
    timeline: '.canvas-container',
    zoomCareer: '.zoom-pill.career',
    zoomLife: '.zoom-pill.life',
    listView: '.list-pill',
    timelineContainer: '.timeline-container',
    listContainer: '.list-container',
    pills: '.pills',
    lifePill: '.pill.life',
    careerPill: '.pill.career',
    listPill: '.list-pill',
    timelinePill: '.timeline-pill',
  };

  /**
   * An instance of visualisation, representing a reverse flame
   * chart with chronologically sorted events.
   */
  timeline: TimelineVisualisation;

  /**
   * An instance of a list of accordions representing
   * same exact set of events.
   */
  list: ListVisualisation;

  /**
   * Control palette for interacting with the visualisation.
   */
  pills: SelectablePills;

  /**
   * Holds section contents and timeline/list
   * visualisation containers
   */
  container: HTMLElement;

  /**
   * Holds the container for a canvas-based
   * flamechart visualisation
   */
  timelineContainer: HTMLElement;

  /**
   * Holds a set of toggle-able accordions
   * representing same events as the timeline
   */
  listContainer: HTMLElement;

  constructor() {
    this.container = qs(CareerSection.selectors.container);
    this.timelineContainer = qs(CareerSection.selectors.timelineContainer);
    this.listContainer = qs(CareerSection.selectors.listContainer);

    this.timeline = new TimelineVisualisation({
      container: this.container.querySelector(CareerSection.selectors.timeline),
      events,
    });

    this.list = new ListVisualisation({
      container: this.listContainer,
      events,
    });

    this.pills = new SelectablePills({
      container: this.container.querySelector(CareerSection.selectors.pills),
      pills: tags,
      onChange: this.onPillsChanged.bind(this),
    });
  }

  /**
   * Kicks off the visualisation and connects
   * controls with the viewport.
   */
  init() {
    this.timeline.start();

    const careerEvent = events.find((e) => e.config.id === 'career');
    const lifeEvent = events.find((e) => e.config.id === 'life');
    const listeners = {
      [CareerSection.selectors.careerPill]: () => {
        this.timeline.zoomIn(careerEvent);
      },
      [CareerSection.selectors.lifePill]: () => {
        this.timeline.zoomIn(lifeEvent);
      },
      [CareerSection.selectors.listPill]: () => {
        this.showList();
      },
      [CareerSection.selectors.timelinePill]: () => {
        this.showTimeline();
      },
    };

    for (const [selector, listener] of Object.entries(listeners)) {
      this.container
        .querySelector(selector)
        .addEventListener('click', listener);
    }

    this.processQueryParams();
  }

  /**
   * Brings the timeline container to the view
   */
  showTimeline() {
    this.timelineContainer.style.display = 'block';
    this.listContainer.style.display = 'none';
  }

  /**
   * Brings the list container to the view,
   * initializes the list lazily, if needed
   */
  showList() {
    if (!this.list.ready) {
      this.list.init();
    }

    this.timelineContainer.style.display = 'none';
    this.listContainer.style.display = 'block';
  }

  /**
   * Detects if the page was opened with the
   * intention to visit a particular content modal
   */
  processQueryParams() {
    const qs = new URLSearchParams(window.location.search);

    if (qs.has('modal')) {
      showModal(qs.get('modal'));
    }
  }

  /**
   * Handles the change of selected event
   * group from the control palette
   */
  onPillsChanged(selected: string) {
    this.timeline.highlight(selected);
  }
}
