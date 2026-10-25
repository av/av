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
} from './util';

// Fig. 4 (divergent): Optical prism refracting 1 prompt into 6 distinct diff barcodes.
export function initDivergentFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const r = createRandom(404);
  const PATTERNS: number[][] = Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 18 }, () => {
      if (row === 0) return 0;
      const v = r();
      if (v < 0.18 + row * 0.06) return -1;
      if (v < 0.36 + row * 0.09) return 1;
      return 0;
    }),
  );

  let hoverRow = 4;
  const rowSp = createSpring(4);

  mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 235),
    (ctx, W, H, c, t, dt, pointer) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      if (pointer.inside) {
        hoverRow = clamp(Math.round((pointer.y - 0.12) / 0.15), 0, 5);
      }
      rowSp.target = hoverRow;
      const focus = rowSp.step(dt, 180, 22);

      const px = W * 0.33;
      const py = H * 0.5;

      // Incoming single prompt laser beam + underglow
      ctx.strokeStyle = c.tx;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(24, py);
      ctx.lineTo(px - 18, py);
      ctx.stroke();

      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(24, py);
      ctx.lineTo(px - 18, py);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Traveling photon pulse on input beam
      const pulseX = 24 + ((t * 110) % Math.max(12, px - 42));
      drawGlowNode(ctx, pulseX, py, 3, c.tx, 0.25, 2.8);

      // 6 refracted beams + diff barcode strips
      const startX = W * 0.54;
      const stripW = W * 0.38;
      const blockW = Math.max(3, (stripW - 36) / 18);

      for (let i = 0; i < 6; i++) {
        const ry = 30 + (i / 5) * (H - 60);
        const prox = clamp(1 - Math.abs(focus - i));

        ctx.strokeStyle = prox > 0.5 ? (i === 0 ? c.red : c.green) : c.tx3;
        ctx.globalAlpha = lerp(0.28, 0.92, prox);
        ctx.lineWidth = lerp(1, 2.2, prox);
        ctx.beginPath();
        ctx.moveTo(px + 14, py - 4 + (i - 2.5) * 3);
        ctx.bezierCurveTo(px + 62, py, startX - 48, ry, startX - 4, ry);
        ctx.stroke();

        // Barcode blocks along the lane
        const pat = PATTERNS[i];
        for (let j = 0; j < pat.length; j++) {
          const kind = pat[j];
          const bx = startX + j * (blockW + 2);
          const bh = lerp(7, 13, prox);
          ctx.fillStyle = kind < 0 ? c.red : kind > 0 ? c.green : c.tx3;
          ctx.globalAlpha = lerp(kind === 0 ? 0.16 : 0.48, kind === 0 ? 0.38 : 0.96, prox);
          ctx.fillRect(bx, ry - bh * 0.5, blockW, bh);
        }
      }
      ctx.globalAlpha = 1;

      // Central optical prism with internal facets
      ctx.save();
      ctx.translate(px, py);
      ctx.fillStyle = c.bg;
      ctx.strokeStyle = c.tx;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(24, 18);
      ctx.lineTo(-24, 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = c.green;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-12, 2);
      ctx.lineTo(14, -2);
      ctx.lineTo(8, 12);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      drawChip(ctx, '1 prompt', 24, py - 20, c.tx2, c.bg, c.ui, 'left');
      drawChip(ctx, 'agent', px, py + 34, c.tx2, c.bg, c.ui, 'center');
      drawChip(ctx, '6 diffs', W - 18, 18, c.green, c.bg, c.green, 'right');
    },
  );
  stage.style.cursor = 'ns-resize';
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
  const compSp = createSpring(0);

  const toggle = () => {
    compiled = !compiled;
    compSp.target = compiled ? 1 : 0;
    btn.classList.toggle('is-active', compiled);
  };
  stage.style.cursor = 'pointer';
  stage.addEventListener('click', toggle);

  mountCanvas(
    stage,
    (w) => (w < 540 ? 205 : 230),
    (ctx, W, H, c, t, dt) => {
      const k = clamp(compSp.step(dt, 150, 18), 0, 1);
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      const cx = W * 0.34;
      const cy = H * 0.55;
      const rad = Math.min(64, H * 0.33);

      // Circular retry orbit
      ctx.strokeStyle = k > 0.5 ? c.tx3 : c.red;
      ctx.globalAlpha = lerp(0.65, 0.22, k);
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      const wallX = cx;
      const wallY = cy - rad;

      // Tangent escape beam when compiled
      const exitEnd = W * 0.88;
      if (k > 0.01) {
        const curEnd = lerp(wallX, exitEnd, k);
        ctx.strokeStyle = c.green;
        ctx.globalAlpha = 0.18 * k;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(wallX, wallY);
        ctx.lineTo(curEnd, wallY);
        ctx.stroke();

        ctx.globalAlpha = k;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(wallX, wallY);
        ctx.lineTo(curEnd, wallY);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Gate / wall at 12 o'clock
      ctx.save();
      ctx.translate(wallX, wallY);
      ctx.rotate(lerp(0.65, 0, k));
      ctx.strokeStyle = k > 0.5 ? c.green : c.red;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
      ctx.restore();

      // Orbiting / escaping particles
      for (let i = 0; i < 6; i++) {
        const u = (t * 0.52 + i / 6) % 1;
        if (k < 0.5) {
          const ang = -Math.PI / 2 + u * Math.PI * 2;
          const px = cx + Math.cos(ang) * rad;
          const py = cy + Math.sin(ang) * rad;
          const hit = u < 0.09;
          drawGlowNode(ctx, px, py, hit ? 4.2 : 2.8, hit ? c.red : c.tx2, hit ? 0.35 : 0.1, 3);
        } else {
          if (u < 0.35) {
            const ang = Math.PI / 2 + (u / 0.35) * Math.PI;
            const px = cx + Math.cos(ang) * rad;
            const py = cy + Math.sin(ang) * rad;
            drawGlowNode(ctx, px, py, 2.8, c.tx2, 0.1, 2);
          } else {
            const lin = (u - 0.35) / 0.65;
            const px = wallX + lin * (exitEnd - wallX) * k;
            drawGlowNode(ctx, px, wallY, 3.4, c.green, 0.28, 2.8);
          }
        }
      }

      drawChip(ctx, 'loop', cx, cy, k > 0.5 ? c.tx3 : c.red, c.bg, k > 0.5 ? c.ui : c.red, 'center');
      if (k > 0.25) {
        drawChip(ctx, 'rule', lerp(wallX + 40, exitEnd, k), wallY - 18, c.green, c.bg, c.green, 'right');
      }
    },
  );
}
