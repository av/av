import { initGrainClipping } from './grain-clipping';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGrainClipping);
} else {
  initGrainClipping();
}