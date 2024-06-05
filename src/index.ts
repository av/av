import CareerSection from './career/CareerSection';
import * as SkillsSection from './skills/skillsSection';
import * as IntroSection from './intro/introSection';
import * as postprocess from './postprocess';

// Run post-processing of DOM
postprocess.run();

// Modules are written in procedural style
IntroSection.init(IntroSection.selectors);
SkillsSection.init(SkillsSection.selectors);

// Module is written in 'classical' style,
// hence slightly different init procedure
new CareerSection().init();
