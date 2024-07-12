import events, { tags } from './timelineEvents';
import SelectablePills from '../lib/SelectablePills';
import TimelineVisualisation from './TimelineVisualisation';
import ListVisualisation from './ListVisualisation';
import { qs, showModal, toggleDisplay } from '../utils';
import { EventTag } from './EventTag';
import { PageSection } from '../lib/PageSection';

/**
 * Implements behavior of Career, or 'Timeline' section.
 * Renders the visualisation and connects it to the selectable pills
 */
export default class CareerSection extends PageSection<typeof CareerSection.config> {
  static config = {
    container: 'section.career',
    elements: {
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
    },
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

  constructor() {
    super(CareerSection.config);

    this.timeline = new TimelineVisualisation({
      container: this.elements.timeline,
      events,
    });

    this.list = new ListVisualisation({
      container: this.elements.listContainer,
      events,
    });

    this.pills = new SelectablePills({
      container: this.elements.pills,
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

    this.actions({
      [CareerSection.config.elements.careerPill]: () => {
        this.timeline.zoomIn(careerEvent);
      },
      [CareerSection.config.elements.lifePill]: () => {
        this.timeline.zoomIn(lifeEvent);
      },
      [CareerSection.config.elements.listPill]: () => {
        this.showList();
      },
      [CareerSection.config.elements.timelinePill]: () => {
        this.showTimeline();
      },
    });

    this.showTimeline();
    this.timeline.zoomIn(careerEvent);
    this.processQueryParams();
  }

  /**
   * Brings the timeline container to the view
   */
  showTimeline() {
    toggleDisplay([
      this.elements.listContainer,
      this.elements.timelinePill,
    ], false);

    toggleDisplay([
      this.elements.timelineContainer,
      this.elements.listPill,
      this.elements.lifePill,
      this.elements.careerPill,
    ], true);

    this.timeline.onResize();
  }

  /**
   * Brings the list container to the view,
   * initializes the list lazily, if needed
   */
  showList() {
    if (!this.list.ready) {
      this.list.init();
    }

    toggleDisplay([
      this.elements.listContainer,
      this.elements.timelinePill,
    ], true);

    toggleDisplay([
      this.elements.timelineContainer,
      this.elements.listPill,
      this.elements.lifePill,
      this.elements.careerPill,
    ], false);

    this.pills.toggle(EventTag.career);
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
  onPillsChanged(selected: string | null) {
    this.timeline.highlight(selected);
    this.list.highlight(selected);
  }
}
