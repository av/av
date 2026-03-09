import chroma from 'chroma-js';

import { EventTag, EventTagColor } from './EventTag';
import TimelineEvent from './TimelineEvent';
import { parseCsv, parseDate } from '../utils';

import timelineCsv from 'bundle-text:./timeline.csv';

function assignDepths(events: Array<{ start: Date; end: Date; depth: number; pinned: boolean }>): number[] {
  const rowIntervals: Array<Array<[number, number]>> = [];
  const result = new Array(events.length).fill(0);

  const overlaps = (row: number, s: number, e: number): boolean =>
    (rowIntervals[row] ?? []).some(([rs, re]) => s < re && e > rs);

  const addInterval = (row: number, s: number, e: number) => {
    (rowIntervals[row] ??= []).push([s, e]);
  };

  // Pinned items: placed at authored depth unconditionally.
  events.forEach((event, i) => {
    if (!event.pinned) return;
    result[i] = event.depth;
    addInterval(event.depth, event.start.getTime(), event.end.getTime());
  });

  // Non-pinned items: greedy row packing, checking real interval overlap.
  const sorted = events
    .map((e, i) => ({ ...e, i }))
    .filter(e => !e.pinned)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const event of sorted) {
    const s = event.start.getTime();
    const e = event.end.getTime();
    let row = event.depth;
    while (overlaps(row, s, e)) row++;
    result[event.i] = row;
    addInterval(row, s, e);
  }

  return result;
}

function parseTimelineCsv(csv: string): TimelineEvent[] {
  const rows = parseCsv(csv).filter(([id]) => !id.startsWith('-'));

  const raw = rows.map(([id, start, end, name, depth, tagsList]) => {
    const depthStr = depth.trim();
    const pinned = depthStr.startsWith('!');
    return {
      id,
      start: parseDate(start),
      end: parseDate(end),
      name,
      pinned,
      depth: parseInt(pinned ? depthStr.slice(1) : depthStr),
      tags: tagsList.split(',').map((tag) => tag.trim() as EventTag),
    };
  });

  const displayDepths = assignDepths(raw);

  return raw.map((event, i) => new TimelineEvent({
    id: event.id,
    start: event.start,
    end: event.end,
    name: event.name,
    color: chroma.average(event.tags.map((tag) => EventTagColor[tag])).css(),
    depth: displayDepths[i],
    tags: event.tags,
  }));
}

export default parseTimelineCsv(timelineCsv);
export const tags = Object.keys(EventTagColor);
