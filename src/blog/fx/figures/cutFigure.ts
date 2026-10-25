import { h, prefersReduced, sleep, watchVisible } from './util';

// Fig. 1: the opening scene as a diff. The agent's green branch lands first,
// then the human's five corrections play over it one at a time, and a log on
// the side keeps the record that the prompt never contained.

type Line = { id?: string; sign: ' ' | '+' | '-'; code: string; file?: string };

const PATCH: Line[] = [
  { sign: ' ', code: 'upload_client.py', file: 'upload_client.py' },
  { sign: ' ', code: 'def upload(payload):' },
  { sign: '+', code: '    for attempt in range(5):' },
  { sign: '+', code: '        r = session.post(URL, json=payload)' },
  { id: 'retry', sign: '+', code: '        if r.status_code >= 400:' },
  { id: 'sleep', sign: '+', code: '            time.sleep(2 ** attempt)' },
  { sign: '+', code: '            continue' },
  { sign: '+', code: '        return r' },
  { sign: ' ', code: 'config/prod.yaml', file: 'config/prod.yaml' },
  { id: 'cfg-old', sign: '-', code: '  timeout: 30' },
  { id: 'cfg-new', sign: '+', code: '  timeout: 300' },
  { sign: ' ', code: 'tests/test_upload.py', file: 'tests/test_upload.py' },
  { id: 'test-old', sign: '-', code: '    assert r.status_code == 422' },
  { id: 'test-new', sign: '+', code: '    assert r.status_code in (200, 422)' },
];

type Step = { at: string; icon: string; kind: 'reject' | 'edit' | 'revert' | 'stop'; text: string; run: (f: Fig) => void };

type Fig = {
  line: (id: string) => HTMLElement;
  run2: HTMLElement;
};

const STEPS: Step[] = [
  {
    at: '+00:40',
    icon: '✕',
    kind: 'reject',
    text: 'reject retry on 4xx',
    run: (f) => {
      const el = f.line('retry');
      el.classList.add('is-rejected');
      el.querySelector('.fxc-code')!.innerHTML = '        if r.status_code &gt;= <del>400</del><ins>500</ins>:';
    },
  },
  {
    at: '+03:15',
    icon: '✎',
    kind: 'edit',
    text: 'rewrite backoff by hand',
    run: (f) => {
      const el = f.line('sleep');
      el.classList.add('is-edited');
      el.querySelector('.fxc-code')!.innerHTML = '            time.sleep(<del>2 ** attempt</del><ins>backoff(attempt)</ins>)';
    },
  },
  {
    at: '+05:50',
    icon: '↺',
    kind: 'revert',
    text: 'revert drive-by config',
    run: (f) => {
      f.line('cfg-old').classList.add('is-restored');
      f.line('cfg-new').classList.add('is-collapsed');
    },
  },
  {
    at: '+07:30',
    icon: '■',
    kind: 'stop',
    text: 'stop run 2 mid-turn',
    run: (f) => f.run2.classList.add('is-stopped'),
  },
  {
    at: '+09:05',
    icon: '↺',
    kind: 'revert',
    text: 'restore the assertion',
    run: (f) => {
      f.line('test-old').classList.add('is-restored');
      f.line('test-new').classList.add('is-collapsed');
    },
  },
];

export function initCutFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxc');
  const prompt = h('div', 'fxc-prompt');
  const promptText = h('span', 'fxc-prompt__text');
  prompt.append(h('span', 'fxc-prompt__label', 'prompt'), promptText, h('span', 'fxc-prompt__count', '6 words'));

  const body = h('div', 'fxc-body');
  const diff = h('div', 'fxc-diff');
  const lines = new Map<string, HTMLElement>();
  PATCH.forEach((l, i) => {
    const row = h('div', l.file ? 'fxc-file' : `fxc-line is-${l.sign === '+' ? 'add' : l.sign === '-' ? 'del' : 'ctx'}`);
    row.style.setProperty('--i', String(i));
    if (l.file) {
      row.textContent = l.file;
    } else {
      row.append(h('span', 'fxc-sign', l.sign), h('span', 'fxc-code', l.code));
    }
    if (l.id) lines.set(l.id, row);
    diff.append(row);
  });

  const runs = h('div', 'fxc-runs');
  const run1 = h('div', 'fxc-run is-done');
  run1.innerHTML = '<span>run 1 · upload retries</span><b>tests ✓</b><i><u></u></i>';
  const run2 = h('div', 'fxc-run');
  run2.innerHTML = '<span>run 2 · editing tests/test_auth.py</span><b></b><i><u></u></i>';
  runs.append(run1, run2);

  const side = h('div', 'fxc-side');
  const logTitle = h('div', 'fxc-side__title', 'your cut');
  const log = h('ol', 'fxc-log');
  const meter = h('div', 'fxc-meter');
  meter.innerHTML =
    '<div class="fxc-meter__row"><span>prompt</span><i class="is-noise"><u></u></i><b>6 words · noise</b></div>' +
    '<div class="fxc-meter__row"><span>corrections</span><i class="is-signal"><u></u></i><b>5 decisions · signal</b></div>';
  side.append(logTitle, log, meter);

  const left = h('div', 'fxc-left');
  left.append(diff, runs);
  body.append(left, side);

  const replay = h('button', 'fx-figure__replay', 'Replay');
  replay.type = 'button';
  stage.append(prompt, body, replay);
  fig.prepend(stage);

  const f: Fig = { line: (id) => lines.get(id)!, run2 };
  const promptWords = 'add retries to the upload client';
  let token = 0;

  const reset = () => {
    stage.classList.remove('is-landed', 'is-done');
    promptText.textContent = '';
    log.innerHTML = '';
    stage.style.setProperty('--n', '0');
    diff.querySelectorAll<HTMLElement>('.fxc-line').forEach((el) => {
      el.classList.remove('is-rejected', 'is-edited', 'is-restored', 'is-collapsed');
      const src = PATCH.find((l) => l.id && lines.get(l.id) === el);
      if (src) el.querySelector('.fxc-code')!.textContent = src.code;
    });
    run2.classList.remove('is-stopped');
  };

  const addLog = (st: Step) => {
    const li = h('li', `is-${st.kind}`);
    li.append(h('span', 'fxc-log__icon', st.icon), h('span', 'fxc-log__text', st.text), h('span', 'fxc-log__at', st.at));
    log.append(li);
    stage.style.setProperty('--n', String(log.children.length));
  };

  const finish = () => {
    promptText.textContent = promptWords;
    stage.classList.add('is-landed', 'is-done');
    STEPS.forEach((st) => {
      st.run(f);
      addLog(st);
    });
  };

  const play = async () => {
    const my = ++token;
    reset();
    for (let i = 0; i <= promptWords.length; i++) {
      if (my !== token) return;
      promptText.textContent = promptWords.slice(0, i);
      await sleep(38);
    }
    await sleep(350);
    stage.classList.add('is-landed');
    await sleep(1900);
    for (const st of STEPS) {
      if (my !== token) return;
      st.run(f);
      addLog(st);
      await sleep(1250);
    }
    stage.classList.add('is-done');
  };

  replay.addEventListener('click', () => void play());

  if (prefersReduced()) {
    finish();
    return;
  }
  let started = false;
  watchVisible(
    stage,
    (on) => {
      if (on && !started) {
        started = true;
        void play();
      }
    },
    0.45,
  );
  // Looping bits (cursor, the live run) only animate while on screen.
  watchVisible(stage, (on) => stage.classList.toggle('is-visible', on), 0);
}
