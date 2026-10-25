import {
  clamp,
  createRandom,
  createSpring,
  drawBlueprint,
  drawChip,
  drawGlowNode,
  h,
  mountCanvas,
} from './util';

// Fig. 19 (clone): Mirror Twin Classifier (You vs Behavioral Clone in 98% lockstep).
export function initCloneFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const r = createRandom(1919);
  type Item = { u: number; speed: number; veto: boolean };
  const items: Item[] = Array.from({ length: 12 }, (_, i) => ({
    u: i / 12,
    speed: 0.26,
    veto: r() < 0.62,
  }));

  mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 235),
    (ctx, W, H, c, _t, dt) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      const cx = W * 0.5;
      const splitY = H * 0.4;
      const leftX = W * 0.25;
      const rightX = W * 0.75;
      const gateY = H * 0.72;

      // Center mirror axis
      ctx.strokeStyle = c.tx3;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, splitY);
      ctx.lineTo(cx, H - 18);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Left (you) and Right (clone) gate rings
      [leftX, rightX].forEach((gx, idx) => {
        ctx.fillStyle = c.bg;
        ctx.strokeStyle = idx === 0 ? c.tx : c.red;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gx, gateY, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      for (const it of items) {
        it.u = (it.u + it.speed * dt * 0.65) % 1;
        const u = it.u;
        const col = it.veto ? c.red : c.green;

        if (u < 0.38) {
          const y = 16 + (u / 0.38) * (splitY - 16);
          drawGlowNode(ctx, cx, y, 3.2, c.tx2, 0.15, 2.2);
        } else {
          const v = (u - 0.38) / 0.62;
          [-1, 1].forEach((dir) => {
            const gx = dir < 0 ? leftX : rightX;
            const deflect = v > 0.55 ? dir * (it.veto ? -34 : 34) * (v - 0.55) * 2.2 : 0;
            const x = cx + (gx - cx) * Math.min(1, v * 1.65) + deflect;
            const y = splitY + v * (H - 22 - splitY);
            drawGlowNode(ctx, x, y, 3.2, v > 0.52 ? col : c.tx2, v > 0.52 ? 0.28 : 0.1, 2.6);
          });
        }
      }

      drawChip(ctx, 'you', leftX, gateY + 34, c.tx, c.bg, c.ui, 'center');
      drawChip(ctx, 'clone · 98%', rightX, gateY + 34, c.red, c.bg, c.red, 'center');
    },
  );
}

// Fig. 20 (phase-space): 2D Decision-Boundary Field with interactive contour.
export function initPhaseSpaceFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const r = createRandom(2020);
  const pts = Array.from({ length: 200 }, () => ({
    x: 0.06 + r() * 0.88,
    y: 0.08 + r() * 0.84,
  }));

  const bendSp = createSpring(0.52);
  let userMoved = false;

  mountCanvas(
    stage,
    (w) => (w < 540 ? 215 : 240),
    (ctx, W, H, c, t, dt, pointer) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      if (pointer.inside) {
        userMoved = true;
        bendSp.target = clamp(1 - pointer.y, 0.15, 0.95);
      } else if (!userMoved) {
        bendSp.target = 0.48 + Math.sin(t * 0.6) * 0.16;
      }
      const b = clamp(bendSp.step(dt, 160, 20), 0.12, 0.98);

      const boundaryY = (nx: number) => 0.82 - b * 0.62 * Math.pow(nx, 1.2);

      // Shaded approval region above boundary
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const u = i / 48;
        const x = u * W;
        const y = boundaryY(u) * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(W, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fillStyle = c.green;
      ctx.globalAlpha = 0.08;
      ctx.fill();
      ctx.globalAlpha = 1;

      // 200 diff points classified by the live boundary
      for (const p of pts) {
        const by = boundaryY(p.x);
        const approved = p.y < by;
        ctx.fillStyle = approved ? c.green : c.red;
        ctx.globalAlpha = approved ? 0.82 : 0.72;
        const px = p.x * W;
        const py = p.y * H;
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      // Underglow + razor-sharp decision boundary curve
      ctx.strokeStyle = c.tx;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const u = i / 48;
        const x = u * W;
        const y = boundaryY(u) * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const u = i / 48;
        const x = u * W;
        const y = boundaryY(u) * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      drawChip(ctx, 'accept', 18, 22, c.green, c.bg, c.green, 'left');
      drawChip(ctx, 'boundary', W - 18, boundaryY(0.88) * H - 14, c.tx, c.bg, c.ui, 'right');
      drawChip(ctx, 'veto', W - 18, H - 20, c.red, c.bg, c.red, 'right');
    },
  );
  stage.style.cursor = 'ns-resize';
}
