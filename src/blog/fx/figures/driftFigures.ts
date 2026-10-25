import { createRandom, h, mountCanvas, scrollProgress } from './util';

// Fig. 15 (fatigue-diff): 10:00 vs 01:00 tunnel-vision aperture over a 300-line diff.
export function initFatigueDiffFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  const pill = h('div', 'fxv-pill');
  const b10 = h('button', 'fxv-pill__btn is-active', '10:00');
  const b01 = h('button', 'fxv-pill__btn', '01:00');
  b10.type = 'button';
  b01.type = 'button';
  pill.append(b10, b01);
  stage.append(pill);
  fig.prepend(stage);

  const r = createRandom(1515);
  const lines = Array.from({ length: 14 }, (_, i) => ({
    indent: (i % 3) * 14,
    w: 90 + r() * 220,
    fault: i === 6 || i === 10,
  }));

  let tired = false;
  let k = 0;

  const setMode = (tMode: boolean) => {
    tired = tMode;
    b10.classList.toggle('is-active', !tMode);
    b01.classList.toggle('is-active', tMode);
  };
  b10.addEventListener('click', () => setMode(false));
  b01.addEventListener('click', () => setMode(true));

  mountCanvas(
    stage,
    (w) => (w < 540 ? 205 : 230),
    (ctx, W, H, c) => {
      k += ((tired ? 1 : 0) - k) * 0.1;
      ctx.clearRect(0, 0, W, H);

      const padX = W * 0.14;
      // Top green CI banner
      ctx.fillStyle = c.green;
      ctx.globalAlpha = 0.18 + k * 0.25;
      ctx.fillRect(padX, 16, W - padX * 2, 22);
      ctx.globalAlpha = 1;

      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.fillStyle = c.green;
      ctx.textAlign = 'left';
      ctx.fillText('CI ✓', padX + 10, 31);

      // 14 diff bars below
      lines.forEach((ln, i) => {
        const y = 50 + i * 11.5;
        const x = padX + ln.indent;
        const bw = Math.min(ln.w, W - padX * 2 - ln.indent);

        if (ln.fault) {
          // At 10:00: bright red fault bar. At 01:00: fades into dull grey bar
          ctx.fillStyle = k > 0.6 ? c.tx3 : c.red;
          ctx.globalAlpha = (1 - k) * 0.9 + k * 0.16;
          ctx.fillRect(x, y, bw, 6);

          if (k < 0.75) {
            ctx.fillStyle = c.red;
            ctx.globalAlpha = 1 - k;
            ctx.beginPath();
            ctx.arc(padX - 10, y + 3, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = c.tx3;
          ctx.globalAlpha = 0.28 * (1 - k * 0.55);
          ctx.fillRect(x, y, bw, 5);
        }
      });
      ctx.globalAlpha = 1;

      if (k < 0.6) {
        ctx.font = `500 10px 'Geist Pixel', monospace`;
        ctx.fillStyle = c.red;
        ctx.globalAlpha = 1 - k;
        ctx.textAlign = 'right';
        ctx.fillText('faults', W - padX, 50 + 6 * 11.5 + 6);
        ctx.globalAlpha = 1;
      }
    },
  );
}

// Fig. 16 (recorder): Coupled oscilloscope (midnight focus dip -> +48h revert spike).
export function initRecorderFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  let dip = 0.85;
  let userTouched = false;

  const ctrl = mountCanvas(
    stage,
    (w) => (w < 540 ? 200 : 225),
    (ctx, W, H, c, t) => {
      ctx.clearRect(0, 0, W, H);
      const d = userTouched ? dip : 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.7));

      const x0 = 28;
      const x1 = W - 28;
      const w = x1 - x0;
      const topBase = H * 0.28;
      const botBase = H * 0.78;

      const dipX = 0.42; // 01:00 midnight dip
      const spikeX = 0.76; // +48h Thursday revert wave

      // Phase-lag connector between 01:00 dip and +48h spike
      const dxPx = x0 + dipX * w;
      const sxPx = x0 + spikeX * w;
      const dyPx = topBase + d * 48;
      const syPx = botBase - d * 68;

      ctx.strokeStyle = c.tx3;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dxPx, dyPx);
      ctx.lineTo(sxPx, syPx);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top curve: operator focus
      ctx.strokeStyle = c.green;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const u = i / 80;
        const x = x0 + u * w;
        const g = Math.exp(-Math.pow((u - dipX) / 0.09, 2));
        const y = topBase + g * d * 48;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Bottom curve: +48h revert rate
      ctx.strokeStyle = c.red;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const u = i / 80;
        const x = x0 + u * w;
        const g = Math.exp(-Math.pow((u - spikeX) / 0.08, 2));
        const y = botBase - g * d * 68;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Peak markers
      ctx.fillStyle = c.green;
      ctx.beginPath();
      ctx.arc(dxPx, dyPx, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = c.red;
      ctx.beginPath();
      ctx.arc(sxPx, syPx, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // 3 words on canvas: focus, 01:00, +48h reverts
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = c.green;
      ctx.fillText('focus', x0, topBase - 12);

      ctx.textAlign = 'center';
      ctx.fillStyle = c.tx2;
      ctx.fillText('01:00', dxPx, dyPx + 16);

      ctx.fillStyle = c.red;
      ctx.fillText('+48h reverts', sxPx, syPx - 10);
    },
  );

  stage.style.cursor = 'ns-resize';
  stage.addEventListener('pointermove', (e) => {
    const rect = ctrl.canvas.getBoundingClientRect();
    userTouched = true;
    dip = Math.max(0.15, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
    ctrl.redraw();
  });
}

// Fig. 17 (surface): Concentric Iris of Automation shrinking manual review onto the core.
export function initSurfaceFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  let userP: number | null = null;

  const ctrl = mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 235),
    (ctx, W, H, c) => {
      ctx.clearRect(0, 0, W, H);
      const p = userP ?? scrollProgress(stage, 0.9, 0.2);

      const cx = W * 0.5;
      const cy = H * 0.52;
      const maxR = Math.min(86, H * 0.38);

      // Outer disk: total review surface (green compiled ring grows inward)
      ctx.fillStyle = c.green;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.green;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Middle ring: uncompiled manual bug-catching (shrinks as p -> 1)
      const manR = maxR * (0.85 - p * 0.56);
      ctx.fillStyle = c.bg;
      ctx.beginPath();
      ctx.arc(cx, cy, manR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = c.red;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.arc(cx, cy, manR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.red;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner core: high-entropy human judgment ("you")
      const coreR = maxR * 0.24;
      ctx.fillStyle = c.tx;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // 3 words on canvas: checks, manual, you
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = c.bg;
      ctx.fillText('you', cx, cy + 3.5);

      ctx.textAlign = 'left';
      ctx.fillStyle = c.green;
      ctx.fillText('checks', cx + maxR + 12, cy - maxR * 0.55);

      if (manR > coreR + 8) {
        ctx.fillStyle = c.red;
        ctx.fillText('manual', cx + manR + 10, cy + 4);
      }
    },
  );

  stage.style.cursor = 'ew-resize';
  stage.addEventListener('pointermove', (e) => {
    const rect = ctrl.canvas.getBoundingClientRect();
    userP = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    ctrl.redraw();
  });
}
