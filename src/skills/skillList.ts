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
}

function parseSkills(skillsCsv: string): Skill[] {
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
  return {
    name,
    level: parseFloat(level),
    interest: parseFloat(interest),
    importance: parseFloat(importance),
    type,
  };
});

export default skills;
export const skillTypes = Object.values(SkillType);
