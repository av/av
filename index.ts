import CareerSection from "./career/CareerSection";
import * as SkillsSection from "./skills/skillsSection";
import * as postprocess from "./postprocess";

// Run post-processing of DOM
postprocess.run();

// Module is written in procedural style
SkillsSection.init(SkillsSection.selectors);

// Module is written in "classical" style
new CareerSection().init();
