import CareerSection from './career/CareerSection';
import SkillsSection from './skills/SkillsSection';

import * as IntroSection from './intro/introSection';
import * as postprocess from './postprocess';

// Run post-processing of DOM
postprocess.run();

// Modules are written in procedural style
IntroSection.init(IntroSection.selectors);

// Module is written in 'classical' style,
// hence slightly different init procedure
new CareerSection().init();
new SkillsSection().init();
