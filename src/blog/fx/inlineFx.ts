// Inline text effects for blog prose. Markdown wraps a phrase in
// <span data-fx="name">; the phrase gets class `is-on` once it scrolls into
// view, and effects that need more than CSS run their setup here. Every effect
// ends in a readable resting state, and without JS the phrase is plain text.

type Effect = (el: HTMLElement) => void;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const GLYPHS = '▓▒░#%&*+<>/\\=_01';

// Letters become inline-blocks, grouped per word so lines still only break
// between words.
function splitChars(el: HTMLElement): HTMLElement[] {
  const text = el.textContent ?? '';
  el.textContent = '';
  const out: HTMLElement[] = [];
  text.split(/(\s+)/).forEach((part) => {
    if (part === '') return;
    if (/^\s+$/.test(part)) {
      el.append(part);
      out.length += part.length;
      return;
    }
    const word = document.createElement('span');
    word.className = 'fx-chword';
    [...part].forEach((ch) => {
      const s = document.createElement('span');
      s.className = 'fx-ch';
      s.textContent = ch;
      s.style.setProperty('--i', String(out.length));
      word.append(s);
      out.push(s);
    });
    el.append(word);
  });
  return out;
}

function splitWords(el: HTMLElement): HTMLElement[] {
  const words = (el.textContent ?? '').split(/(\s+)/);
  el.textContent = '';
  const out: HTMLElement[] = [];
  words.forEach((w) => {
    if (/^\s+$/.test(w) || w === '') {
      el.append(w);
      return;
    }
    const s = document.createElement('span');
    s.className = 'fx-word';
    s.textContent = w;
    s.style.setProperty('--i', String(out.length));
    out.push(s);
    el.append(s);
  });
  return out;
}

function append(el: HTMLElement, cls: string, html = ''): HTMLElement {
  const s = document.createElement('span');
  s.className = cls;
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = html;
  el.append(s);
  return s;
}

async function typeInto(el: HTMLElement, text: string, upTo = text.length, delay = 42) {
  el.classList.add('is-typing');
  for (let i = 0; i <= upTo; i++) {
    el.textContent = text.slice(0, i);
    await sleep(delay + Math.random() * delay * 0.6);
  }
  el.classList.remove('is-typing');
}

async function scramble(el: HTMLElement, text: string, ms = 750) {
  const t0 = performance.now();
  while (true) {
    const k = Math.min(1, (performance.now() - t0) / ms);
    const fixed = Math.floor(text.length * k);
    el.textContent = [...text]
      .map((ch, i) => (i < fixed || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
      .join('');
    if (k >= 1) return;
    await sleep(38);
  }
}

const effects: Record<string, Effect> = {
  type: (el) => {
    const text = el.textContent ?? '';
    el.setAttribute('aria-label', text);
    void typeInto(el, text, text.length, 46).then(() => el.classList.add('is-done'));
  },

  edit: (el) => void scramble(el, el.textContent ?? ''),
  rewrite: (el) => void scramble(el, el.textContent ?? '', 900),

  revert: (el) => {
    const text = el.textContent ?? '';
    const chars = [...text].reverse();
    // Undo the reversal one adjacent swap at a time, like a bubble sort.
    const order = [...chars.keys()].reverse();
    const steps: string[][] = [];
    const cur = order.slice();
    for (let i = 0; i < cur.length; i++) {
      for (let j = 0; j < cur.length - 1 - i; j++) {
        if (cur[j] > cur[j + 1]) {
          [cur[j], cur[j + 1]] = [cur[j + 1], cur[j]];
          steps.push(cur.map((k) => text[k]));
        }
      }
    }
    void (async () => {
      el.textContent = chars.join('');
      await sleep(260);
      for (const s of steps) {
        el.textContent = s.join('');
        await sleep(55);
      }
      el.textContent = text;
    })();
  },

  stop: (el) => {
    const text = el.textContent ?? '';
    const cut = text.length - 2;
    void (async () => {
      await typeInto(el, text, cut, 55);
      el.classList.add('is-halted');
      await sleep(650);
      el.textContent = text.slice(0, cut);
      append(el, 'fx-stop-rest', text.slice(cut)).removeAttribute('aria-hidden');
    })();
  },

  forget: (el) => {
    splitChars(el);
  },

  count: (el) => {
    const to = Number(el.dataset.to ?? el.textContent);
    const t0 = performance.now();
    const ms = 1700;
    const frame = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(frame);
    };
    frame();
  },

  bar: (el) => {
    const from = Number(el.dataset.from ?? 100);
    const to = Number(el.dataset.to ?? 100);
    const max = Math.max(from, to);
    const bar = append(el, `fx-bar ${to < from ? 'is-down' : 'is-up'}`, '<i class="fx-bar__old"></i><i class="fx-bar__new"></i>');
    bar.style.setProperty('--from', `${(from / max) * 100}%`);
    bar.style.setProperty('--to', `${(to / max) * 100}%`);
  },

  cursor: (el) => {
    const rects = Array.from(el.getClientRects());
    if (rects.length === 0) return;
    const sx = window.scrollX;
    const sy = window.scrollY;
    const pts: [number, number][] = [];
    rects.forEach((r) => {
      pts.push([r.left + sx, r.bottom + sy - 4], [r.right + sx - 6, r.bottom + sy - 4]);
    });
    const ptr = document.createElement('span');
    ptr.className = 'fx-pointer';
    ptr.setAttribute('aria-hidden', 'true');
    ptr.innerHTML =
      '<svg viewBox="0 0 12 18" width="12" height="18"><path d="M1 1 L1 14 L4.5 10.8 L7 17 L9.2 16 L6.8 10 L11 10 Z" /></svg>';
    document.body.append(ptr);
    const total = pts.length;
    const anim = ptr.animate(
      pts.map(([x, y], i) => ({ transform: `translate(${x}px, ${y}px)`, offset: total > 1 ? i / (total - 1) : 0 })),
      { duration: 900 * total, easing: 'ease-in-out', fill: 'forwards' },
    );
    pts.forEach(([x, y], i) => {
      if (i === 0) return;
      setTimeout(() => {
        const ring = document.createElement('span');
        ring.className = 'fx-click';
        ring.style.transform = `translate(${x}px, ${y}px)`;
        document.body.append(ring);
        setTimeout(() => ring.remove(), 700);
      }, (900 * total * i) / Math.max(1, total - 1));
    });
    anim.finished.then(() => {
      ptr.classList.add('is-gone');
      setTimeout(() => ptr.remove(), 500);
    });
  },

  decision: (el) => {
    const chip = append(el, 'fx-chip is-accept', 'accept');
    let accept = true;
    setInterval(() => {
      if (document.hidden) return;
      accept = !accept;
      chip.classList.add('is-flip');
      setTimeout(() => {
        chip.textContent = accept ? 'accept' : 'reject';
        chip.classList.toggle('is-accept', accept);
        chip.classList.toggle('is-reject', !accept);
        chip.classList.remove('is-flip');
      }, 180);
    }, 1900);
  },

  lock: (el) => {
    const icon = document.createElement('span');
    icon.className = 'fx-lock';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML =
      '<svg viewBox="0 0 12 14" width="12" height="14"><path class="fx-lock__shackle" d="M3 7 V4.5 a3 3 0 0 1 6 0 V7" /><rect x="1.5" y="6.5" width="9" height="7" rx="1.2" /></svg>';
    el.prepend(icon);
  },

  drain: (el) => {
    append(el, 'fx-meter is-drain', '<i></i>');
  },

  fill: (el) => {
    const m = append(el, 'fx-meter is-fill', '<i></i>');
    m.style.setProperty('--to', `${Number(el.dataset.to ?? 90)}%`);
  },

  dots: (el) => {
    const grid = append(el, 'fx-dots', Array.from({ length: 15 }, (_, i) => `<i style="--i:${i}"></i>`).join(''));
    const cells = Array.from(grid.children) as HTMLElement[];
    setTimeout(() => {
      setInterval(() => {
        if (document.hidden) return;
        const c = cells[Math.floor(Math.random() * cells.length)];
        c.classList.add('is-fire');
        setTimeout(() => c.classList.remove('is-fire'), 420);
      }, 650);
    }, 1800);
  },

  spike: (el) => {
    append(
      el,
      'fx-spark',
      '<svg viewBox="0 0 60 16" preserveAspectRatio="none"><path class="fx-spark__base" d="M1 12 L8 11.5 L15 12.4 L22 11.2 L29 12 L36 11.6 L41 12.2" /><path class="fx-spark__hot" d="M41 12.2 L46 11 L50 2.5 L54 9 L59 7" /><circle cx="50" cy="2.5" r="1.8" /></svg>',
    );
  },

  replay: (el) => {
    const play = document.createElement('span');
    play.className = 'fx-play';
    play.setAttribute('aria-hidden', 'true');
    el.prepend(play);
    append(el, 'fx-scrub', '<i></i>');
  },

  compile: (el) => splitChars(el),
  drift: (el) => splitChars(el),
  ladder: (el) => splitChars(el),
  mirror: (el) => splitWords(el),

  swap: (el) => {
    const text = el.textContent ?? '';
    el.innerHTML = '';
    const inner = append(el, 'fx-swap__inner');
    inner.removeAttribute('aria-hidden');
    inner.append(text);
    append(inner, 'fx-swap__next', text);
  },

  reject: (el) => void append(el, 'fx-x', '✕'),
};

// Second half of a prepared effect, run when the phrase is seen.
const play: Record<string, Effect> = {
  compile: (el) => {
    el.querySelectorAll<HTMLElement>('.fx-ch').forEach((ch, i) => {
      setTimeout(() => ch.classList.add('is-compiled'), i * 34);
    });
  },
};

// Effects that build their resting markup before they are seen, so the reveal
// does not reflow the paragraph when it starts.
const prepare = new Set(['bar', 'drain', 'fill', 'dots', 'spike', 'lock', 'replay', 'compile', 'drift', 'ladder', 'mirror', 'forget', 'swap', 'reject']);

export function initInlineFx(root: ParentNode = document): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-fx]'));
  if (els.length === 0) return;
  const still = reduced();

  els.forEach((el) => {
    const name = el.dataset.fx ?? '';
    if (prepare.has(name)) effects[name]?.(el);
  });

  const activate = (el: HTMLElement) => {
    if (el.classList.contains('is-on')) return;
    el.classList.add('is-on');
    const name = el.dataset.fx ?? '';
    if (still) {
      el.querySelectorAll('.fx-ch').forEach((ch) => ch.classList.add('is-compiled'));
      return;
    }
    if (!prepare.has(name)) effects[name]?.(el);
    play[name]?.(el);
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
        const block = el.closest('p, li, blockquote');
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
