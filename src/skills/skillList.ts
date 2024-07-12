import skillsCsv from 'bundle-text:./skills.csv';

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

const skills = parseSkills(skillsCsv);

export default skills;
export const skillTypes = Object.values(SkillType);
