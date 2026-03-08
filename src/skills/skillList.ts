import skillsCsv from 'bundle-text:./skills.csv';
import { parseCsv } from '../utils';

enum SkillType {
  lang = 'lang',
  runtime = 'runtime',
  framework = 'framework',
  lib = 'lib',
  tool = 'tool',
  cloud = 'cloud',
  database = 'database',
}

export interface Skill {
  name: string;
  level: number;
  interest: number;
  importance: number;
  type: string;
  opacity: number;
  targetOpacity: number;
}

type ParsedSkill = Omit<Skill, 'opacity' | 'targetOpacity'>;

function parseSkills(skillsCsv: string): ParsedSkill[] {
  const skills = skillsCsv
    .split('\n')
    .splice(1)
    .map((line) => {
      let [type, name, level, interest, importance] = line.split(',');

      return {
        name,
        level: parseFloat(level),
        interest: parseFloat(interest),
        importance: parseFloat(importance),
        type,
      };
    });

  return skills;
}

const skills = parseCsv(skillsCsv).map(([type, name, level, interest, importance]) => {
  const parsedImportance = parseFloat(importance);
  const opacity = parsedImportance > 0.5 ? 1 : 0.2;

  return {
    name,
    level: parseFloat(level),
    interest: parseFloat(interest),
    importance: parseFloat(importance),
    type,
    opacity,
    targetOpacity: opacity,
  };
});

export default skills;
export const skillTypes = Object.values(SkillType);
