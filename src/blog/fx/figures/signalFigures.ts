import { createRandom, h, mountCanvas } from './util';

// Fig. 4 (divergent): Optical prism refracting 1 prompt into 6 distinct diff barcodes.
export function initDivergentFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const r = createRandom(404);
  // 6 distinct diff barcode patterns (-1 = red del, 0 = grey ctx, 1 = green add)
  const PATTERNS: number[][] = Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 18 }, (__, col) => {
      if (row === 0) return 0; // unedited pass-through
      const v = r();
      if (v < 0.18 + row * 0.06) return -1;
      if (v < 0.36 + row * 0.09) return 1;
      return 0;
    }),
  );

  let hoverRow = 4;

  const ctrl = mountCanvas(
    stage,
    (w) => (w < 540 ? 205 : 230),
    (ctx, W, H, c, t) => {
      ctx.clearRect(0, 0, W, H);
      const px = W * 0.34;
      const py = H * 0.5;

      // Incoming single prompt beam
      ctx.strokeStyle = c.tx;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(24, py);
      ctx.lineTo(px - 18, py);
      ctx.stroke();

      // Traveling pulse on input beam
      const pulseX = 24 + ((t * 95) % Math.max(10, px - 42));
      ctx.fillStyle = c.tx;
      ctx.beginPath();
      ctx.arc(pulseX, py, 3, 0, Math.PI * 2);
      ctx.fill();

      // Central triangular prism (agent)
      ctx.strokeStyle = c.tx2;
      ctx.fillStyle = c.bg;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px, py - 24);
      ctx.lineTo(px + 22, py + 16);
      ctx.lineTo(px - 22, py + 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 6 refracted beams + diff barcode strips
      const startX = W * 0.54;
      const stripW = W * 0.38;
      const blockW = Math.max(3, (stripW - 36) / 18);

      for (let i = 0; i < 6; i++) {
        const ry = 28 + (i / 5) * (H - 56);
        const isAct = i === hoverRow;

        ctx.strokeStyle = isAct ? c.green : c.tx3;
        ctx.globalAlpha = isAct ? 0.9 : 0.35;
        ctx.lineWidth = isAct ? 1.8 : 1;
        ctx.beginPath();
        ctx.moveTo(px + 12, py - 4 + (i - 2.5) * 3);
        ctx.bezierCurveTo(px + 60, py, startX - 45, ry, startX, ry);
        ctx.stroke();

        // Barcode blocks along the lane
        const pat = PATTERNS[i];
        for (let j = 0; j < pat.length; j++) {
          const kind = pat[j];
          const bx = startX + j * (blockW + 2);
          const bh = isAct ? 12 : 8;
          ctx.fillStyle = kind < 0 ? c.red : kind > 0 ? c.green : c.tx3;
          ctx.globalAlpha = isAct ? (kind === 0 ? 0.35 : 0.95) : kind === 0 ? 0.18 : 0.55;
          ctx.fillRect(bx, ry - bh / 2, blockW, bh);
        }
      }
      ctx.globalAlpha = 1;

      // 5 words total on canvas
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.fillStyle = c.tx2;
      ctx.textAlign = 'left';
      ctx.fillText('1 prompt', 24, py - 12);

      ctx.textAlign = 'center';
      ctx.fillText('agent', px, py + 32);

      ctx.textAlign = 'right';
      ctx.fillStyle = c.green;
      ctx.fillText('6 diffs', W - 20, 16);
    },
  );

  stage.addEventListener('pointermove', (e) => {
    const rect = ctrl.canvas.getBoundingClientRect();
    const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
    hoverRow = Math.max(0, Math.min(5, Math.round((ny - 0.12) / 0.15)));
    ctrl.redraw();
  });
}

// Fig. 5 (retry-loop): Sisyphus orbital trap vs compiled tangent escape.
export function initRetryLoopFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  const pill = h('div', 'fxv-pill');
  const btn = h('button', 'fxv-pill__btn', 'compile');
  btn.type = 'button';
  pill.append(btn);
  stage.append(pill);
  fig.prepend(stage);

  let compiled = false;
  let k = 0;

  const toggle = () => {
    compiled = !compiled;
    btn.classList.toggle('is-active', compiled);
  };
  stage.style.cursor = 'pointer';
  stage.addEventListener('click', toggle);

  mountCanvas(
    stage,
    (w) => (w < 540 ? 200 : 225),
    (ctx, W, H, c, t) => {
      k += ((compiled ? 1 : 0) - k) * 0.1;
      ctx.clearRect(0, 0, W, H);

      const cx = W * 0.34;
      const cy = H * 0.54;
      const rad = Math.min(64, H * 0.33);

      // Circular retry orbit
      ctx.strokeStyle = compiled ? c.tx3 : c.red;
      ctx.globalAlpha = compiled ? 0.25 : 0.65;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Red wall at top of orbit (12 o'clock)
      const wallX = cx;
      const wallY = cy - rad;
      ctx.strokeStyle = compiled ? c. green : c.red;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wallX - 8, wallY - 6);
      ctx.lineTo(wallX + 8, wallY + 6);
      ctx.stroke();

      // Tangent escape beam when compiled
      const exitEnd = W * 0.88;
      if (k > 0.02) {
        ctx.strokeStyle = c.green;
        ctx.globalAlpha = k;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(wallX, wallY);
        ctx.lineTo(wallX + (exitEnd - wallX) * k, wallY);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Orbiting / escaping particles
      for (let i = 0; i < 6; i++) {
        const u = (t * 0.55 + i / 6) % 1;
        if (!compiled) {
          const ang = -Math.PI / 2 + u * Math.PI * 2;
          const px = cx + Math.cos(ang) * rad;
          const py = cy + Math.sin(ang) * rad;
          ctx.fillStyle = u < 0.08 ? c.red : c.tx2;
          ctx.beginPath();
          ctx.arc(px, py, u < 0.08 ? 4.5 : 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Climb left half of circle then launch straight along green tangent
          if (u < 0.35) {
            const ang = Math.PI / 2 + (u / 0.35) * Math.PI;
            const px = cx + Math.cos(ang) * rad;
            const py = cy + Math.sin(ang) * rad;
            ctx.fillStyle = c.tx2;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const lin = (u - 0.35) / 0.65;
            const px = wallX + lin * (exitEnd - wallX);
            ctx.fillStyle = c.green;
            ctx.beginPath();
            ctx.arc(px, wallY, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 2 words on canvas: loop, rule (+ 1 word in pill = 3 words)
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = compiled ? c.tx3 : c.red;
      ctx.fillText('loop', cx, cy + 4);

      if (k > 0.2) {
        ctx.fillStyle = c.green;
        ctx.textAlign = 'right';
        ctx.fillText('rule', exitEnd, wallY - 10);
      }
    },
  );
}
