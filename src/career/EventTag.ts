import chroma, { type Color } from 'chroma-js';
import { cssVar } from '../utils';

export enum EventTag {
  career = 'career',
  education = 'education',
  project = 'project',
  deliverable = 'deliverable',
  cool = 'cool',
  hobby = 'hobby',
  general = 'general',
};

export const EventTagColor: Record<EventTag, Color> = {
  [EventTag.career]:      chroma(cssVar('--color-tag-career')).alpha(1),
  [EventTag.project]:     chroma(cssVar('--color-tag-project')).alpha(0.5),
  [EventTag.cool]:        chroma(cssVar('--color-tag-cool')).alpha(0.8),
  [EventTag.hobby]:       chroma(cssVar('--color-tag-hobby')).alpha(0.5),
  [EventTag.deliverable]: chroma(cssVar('--color-tag-deliverable')),
  [EventTag.education]:   chroma(cssVar('--color-tag-education')).alpha(1),
  [EventTag.general]:     chroma(cssVar('--color-tag-general')).alpha(0.5),
};
