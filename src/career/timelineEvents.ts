import chroma from 'chroma-js';

import { EventTag, EventTagColor } from './EventTag';
import TimelineEvent from './TimelineEvent';
import { parseCsv, parseDate } from '../utils';

import timelineCsv from 'bundle-text:./timeline.csv';

function parseTimelineCsv(csv: string): TimelineEvent[] {
  const parsed = parseCsv(csv);

  return parsed
    .filter(([id]) => !id.startsWith('-'))
    .map(([
      id,
      start,
      end,
      name,
      depth,
      tagsList,
    ]) => {
      const tags = tagsList.split(',').map((tag) => tag.trim() as EventTag);

      return new TimelineEvent({
        id,
        start: parseDate(start),
        end: parseDate(end),
        name,
        color: chroma.average(tags.map((tag) => EventTagColor[tag])).css(),
        depth: parseInt(depth),
        tags,
      });
    });
}

export default parseTimelineCsv(timelineCsv);
export const tags = Object.keys(EventTagColor);
