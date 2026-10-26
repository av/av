import {
  clamp,
  createRandom,
  createSpring,
  drawBlueprint,
  drawChip,
  drawGlowNode,
  h,
  lerp,
  mountCanvas,
  scrollProgress,
} from './util';

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
  const kSp = createSpring(0);

  const setMode = (tMode: boolean) => {
    tired = tMode;
    kSp.target = tMode ? 1 : 0;
    b10.classList.toggle('is-active', !tMode);
    b01.classList.toggle('is-active', tMode);
  };
  b10.addEventListener('click', () => setMode(false));
  b01.addEventListener('click', () => setMode(true));
  stage.style.cursor = 'pointer';
  stage.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setMode(!tired);
  });

  mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 235),
    (ctx, W, H, c, _t, dt) => {
      const k = clamp(kSp.step(dt, 140, 18), 0, 1);
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      const padX = W * 0.14;

      // Top green CI banner (glows brighter at 01:00 as operator tunnel-visions on it)
      ctx.fillStyle = c.green;
      ctx.globalAlpha = lerp(0.14, 0.34, k);
      ctx.beginPath();
      ctx.roundRect(padX, 16, W - padX * 2, 24, 4);
      ctx.fill();

      ctx.strokeStyle = c.green;
      ctx.globalAlpha = lerp(0.45, 0.95, k);
      ctx.lineWidth = lerp(1, 2, k);
      ctx.stroke();
      ctx.globalAlpha = 1;

      drawChip(ctx, 'CI ✓', padX + 10, 28, c.green, c.bg, c.green, 'left');

      // 14 diff bars below
      lines.forEach((ln, i) => {
        const y = 52 + i * 11.5;
        const x = padX + ln.indent;
        const bw = Math.min(ln.w, W - padX * 2 - ln.indent);

        if (ln.fault) {
          ctx.fillStyle = k > 0.6 ? c.tx3 : c.red;
          ctx.globalAlpha = lerp(0.92, 0.14, k);
          ctx.fillRect(x, y, bw, 6);

          if (k < 0.8) {
            drawGlowNode(ctx, padX - 10, y + 3, 3, c.red, (1 - k) * 0.25, 2.6);
          }
        } else {
          ctx.fillStyle = c.tx3;
          ctx.globalAlpha = 0.28 * (1 - k * 0.55);
          ctx.fillRect(x, y, bw, 5);
        }
      });
      ctx.globalAlpha = 1;

      if (k < 0.65) {
        drawChip(ctx, 'faults', W - padX, 52 + 6 * 11.5 + 3, c.red, c.bg, c.red, 'right');
      }
    },
  );
}

// Fig. 16 (recorder): Coupled dual-channel oscilloscope (01:00 focus dip -> +48h revert spike).
export function initRecorderFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const dipSp = createSpring(0.85);
  let userTouched = false;

  mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 235),
    (ctx, W, H, c, t, dt, pointer) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      if (pointer.inside) {
        userTouched = true;
        dipSp.target = clamp(pointer.y, 0.2, 1);
      } else if (!userTouched) {
        dipSp.target = 0.38 + 0.54 * (0.5 + 0.5 * Math.sin(t * 0.75));
      }
      const d = clamp(dipSp.step(dt, 160, 20), 0.15, 1);

      const x0 = 28;
      const x1 = W - 28;
      const w = x1 - x0;
      const topBase = H * 0.26;
      const botBase = H * 0.8;

      const dipX = 0.38;
      const spikeX = 0.74;

      const dxPx = x0 + dipX * w;
      const sxPx = x0 + spikeX * w;
      const dyPx = topBase + d * 48;
      const syPx = botBase - d * 68;

      // Phase-lag coupling vector between 01:00 dip and +48h spike
      ctx.strokeStyle = c.tx3;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.2;
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
        const g = Math.exp(-Math.pow((u - dipX) / 0.085, 2));
        const y = topBase + g * d * 48;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Bottom curve: +48h revert rate with red area fill
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const u = i / 80;
        const x = x0 + u * w;
        const g = Math.exp(-Math.pow((u - spikeX) / 0.075, 2));
        const y = botBase - g * d * 68;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = c.red;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.lineTo(x1, botBase);
      ctx.lineTo(x0, botBase);
      ctx.closePath();
      ctx.fillStyle = c.red;
      ctx.globalAlpha = 0.1;
      ctx.fill();
      ctx.globalAlpha = 1;

      drawGlowNode(ctx, dxPx, dyPx, 4, c.green, 0.25, 2.8);
      drawGlowNode(ctx, sxPx, syPx, 4.5, c.red, 0.35, 3);

      drawChip(ctx, 'focus', x0, topBase - 14, c.green, c.bg, c.green, 'left');
      drawChip(ctx, '01:00', dxPx, dyPx + 18, c.tx2, c.bg, c.ui, 'center');
      drawChip(ctx, '+48h reverts', sxPx, syPx - 16, c.red, c.bg, c.red, 'center');
    },
  );
  stage.style.cursor = 'ns-resize';
}

// Fig. 17 (surface): Concentric Iris of Automation shrinking manual review onto the core.
export function initSurfaceFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const pSp = createSpring(0.5);

  mountCanvas(
    stage,
    (w) => (w < 540 ? 215 : 240),
    (ctx, W, H, c, t, dt, pointer) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      pSp.target = pointer.inside ? pointer.x : scrollProgress(stage, 0.9, 0.2);
      const p = clamp(pSp.step(dt, 140, 20), 0, 1);

      const cx = W * 0.5;
      const cy = H * 0.5;
      const maxR = Math.min(88, H * 0.39);

      // Outer disk: compiled harness checks
      ctx.fillStyle = c.green;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.green;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Radial shutter ticks on the compiled iris ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.1 + p * 0.8);
      ctx.strokeStyle = c.green;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * (maxR - 8), Math.sin(ang) * (maxR - 8));
        ctx.lineTo(Math.cos(ang) * maxR, Math.sin(ang) * maxR);
        ctx.stroke();
      }
      ctx.restore();

      // Middle ring: uncompiled manual bug-catching (shrinks as p -> 1)
      const manR = maxR * (0.85 - p * 0.56);
      ctx.fillStyle = c.bg;
      ctx.beginPath();
      ctx.arc(cx, cy, manR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = c.red;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(cx, cy, manR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.red;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner core: high-entropy human judgment ("you")
      const coreR = maxR * 0.25;
      ctx.fillStyle = c.tx;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = c.bg;
      ctx.fillText('you', cx, cy + 0.5);

      drawChip(ctx, 'checks', cx + maxR + 14, cy - maxR * 0.55, c.green, c.bg, c.green, 'left');
      if (manR > coreR + 8) {
        drawChip(ctx, 'manual', cx + manR + 12, cy + 16, c.red, c.bg, c.red, 'left');
      }
    },
  );
  stage.style.cursor = 'ew-resize';
}
