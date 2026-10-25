// Inline text effects for blog prose. Markdown wraps a phrase in
// <span data-fx="name">; the phrase gets class `is-on` once it scrolls into
// view and plays once. Every effect ends in a readable resting state, and
// without JS the phrase is plain text.

type Effect = (el: HTMLElement) => void;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function append(el: HTMLElement, cls: string, html = ''): HTMLElement {
  const s = document.createElement('span');
  s.className = cls;
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = html;
  el.append(s);
  return s;
}

// Built before the phrase is seen, so the reveal does not reflow the line.
const prepare: Record<string, Effect> = {
  bar: (el) => {
    const from = Number(el.dataset.from ?? 100);
    const to = Number(el.dataset.to ?? 100);
    const max = Math.max(from, to);
    const bar = append(el, `fx-bar ${to < from ? 'is-down' : 'is-up'}`, '<i class="fx-bar__old"></i><i class="fx-bar__new"></i>');
    bar.style.setProperty('--from', `${(from / max) * 100}%`);
    bar.style.setProperty('--from-k', String(from / max));
    bar.style.setProperty('--to-k', String(to / max));
  },

  fill: (el) => {
    const m = append(el, 'fx-meter', '<i></i>');
    m.style.setProperty('--to-k', String(Number(el.dataset.to ?? 90) / 100));
  },

  spike: (el) => {
    append(
      el,
      'fx-spark',
      '<svg viewBox="0 0 60 16" preserveAspectRatio="none"><path class="fx-spark__base" d="M1 12 L8 11.5 L15 12.4 L22 11.2 L29 12 L36 11.6 L41 12.2" /><path class="fx-spark__hot" d="M41 12.2 L46 11 L50 2.5 L54 9 L59 7" /><circle cx="50" cy="2.5" r="1.8" /></svg>',
    );
  },
};

// Run when the phrase is seen.
const play: Record<string, Effect> = {
  type: (el) => {
    const text = el.textContent ?? '';
    el.setAttribute('aria-label', text);
    void (async () => {
      for (let i = 0; i <= text.length; i++) {
        el.textContent = text.slice(0, i);
        await sleep(46 + Math.random() * 28);
      }
      el.classList.add('is-done');
    })();
  },

  count: (el) => {
    const to = Number(el.dataset.to ?? el.textContent);
    const t0 = performance.now();
    const frame = () => {
      const k = Math.min(1, (performance.now() - t0) / 1700);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(frame);
    };
    frame();
  },
};

export function initInlineFx(root: ParentNode = document): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-fx]'));
  if (els.length === 0) return;
  const still = reduced();

  els.forEach((el) => prepare[el.dataset.fx ?? '']?.(el));

  const activate = (el: HTMLElement) => {
    el.classList.add('is-on');
    if (!still) play[el.dataset.fx ?? '']?.(el);
  };

  if (still || !('IntersectionObserver' in window)) {
    els.forEach(activate);
    return;
  }

  // Phrases in one paragraph play in reading order instead of all at once.
  const nextFree = new Map<Element | null, number>();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target as HTMLElement;
        const block = el.closest('p, li, blockquote, aside');
        const now = performance.now();
        const at = Math.max(now, nextFree.get(block) ?? 0);
        nextFree.set(block, at + 320);
        setTimeout(() => activate(el), at - now);
      });
    },
    { rootMargin: '0px 0px -18% 0px', threshold: 0.6 },
  );
  els.forEach((el) => io.observe(el));
}
