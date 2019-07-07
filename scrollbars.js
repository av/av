import simpleParallax from 'simple-parallax-js';

document.addEventListener('DOMContentLoaded', () => {
  new simpleParallax(document.querySelector('.logo'), {
    orientation: 'down',
    scale: 1.2,
    overflow: true,
    delay: 2
  });

  const cards = Array
    .from(document.querySelectorAll('[card]'))
    .forEach(card => card.complete = true);
  
  new simpleParallax(document.querySelectorAll('[card]'), {
    orientation: 'down',
    overflow: true,
    scale: 1.1,
    delay: 5
  })
});