import chroma from 'chroma-js';

export enum EventTag {
  general = 'general',
  education = 'education',
  career = 'career',
  project = 'project',
  deliverable = 'deliverable',
  cool = 'cool',
  hobby = 'hobby',
};

export const EventTagColor: Record<string, EventTag> = {
  [EventTag.general]: chroma('darkorange').alpha(.5),
  [EventTag.education]: chroma(0xffc000).alpha(1),
  [EventTag.career]: chroma(0x0000dd).alpha(1),
  [EventTag.project]: chroma(0x296315).alpha(0.5),
  [EventTag.cool]: chroma(0xff1f8f).alpha(0.8),
  [EventTag.hobby]: chroma('lime').alpha(0.5),
  [EventTag.deliverable]: chroma(0x51eaff),
};
