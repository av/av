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
    speed: 0.24,
    veto: r() < 0.62,
  }));

  const evalBezier = (
    u: number,
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
  ): [number, number] => {
    const inv = 1 - u;
    const b0 = inv * inv * inv;
    const b1 = 3 * inv * inv * u;
    const b2 = 3 * inv * u * u;
    const b3 = u * u * u;
    return [
      b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0],
      b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1],
    ];
  };

  mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 235),
    (ctx, W, H, c, _t, dt) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      const cx = W * 0.5;
      const topY = 16;
      const splitY = H * 0.34;
      const leftX = W * 0.25;
      const rightX = W * 0.75;
      const gateY = H * 0.66;
      const botY = H - 16;

      // Center mirror axis
      ctx.strokeStyle = c.tx3;
      ctx.globalAlpha = 0.4;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, splitY);
      ctx.lineTo(cx, botY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Smooth C1 guide tracks from top -> split -> gates -> deflection exits
      ctx.strokeStyle = c.ui;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx, splitY);
      [-1, 1].forEach((dir) => {
        const gx = dir < 0 ? leftX : rightX;
        ctx.moveTo(cx, splitY);
        ctx.bezierCurveTo(cx, splitY + 34, gx, gateY - 38, gx, gateY);
        [-1, 1].forEach((branch) => {
          const ex = gx + dir * branch * 34;
          ctx.moveTo(gx, gateY);
          ctx.bezierCurveTo(gx, gateY + 26, ex, botY - 22, ex, botY);
        });
      });
      ctx.stroke();

      // Track gate pulse intensity as particles pass smoothly through gateY
      let gatePulse = 0;

      for (const it of items) {
        it.u = (it.u + it.speed * dt * 0.65) % 1;
        const u = it.u;
        const col = it.veto ? c.red : c.green;

        if (u < 0.28) {
          const s = u / 0.28;
          const y = topY + s * (splitY - topY);
          drawGlowNode(ctx, cx, y, 3.2, c.tx2, 0.15, 2.2);
        } else if (u < 0.66) {
          // Segment 1: C1 cubic Bezier from (cx, splitY) into (gx, gateY) with vertical entry/exit tangents
          const s = (u - 0.28) / 0.38;
          const proximityToGate = Math.exp(-Math.pow((s - 0.96) / 0.16, 2));
          if (proximityToGate > gatePulse) gatePulse = proximityToGate;

          [-1, 1].forEach((dir) => {
            const gx = dir < 0 ? leftX : rightX;
            const [x, y] = evalBezier(
              s,
              [cx, splitY],
              [cx, splitY + 34],
              [gx, gateY - 38],
              [gx, gateY],
            );
            drawGlowNode(
              ctx,
              x,
              y,
              3.2 + proximityToGate * 0.8,
              s > 0.82 ? col : c.tx2,
              0.15 + proximityToGate * 0.22,
              2.6,
            );
          });
        } else {
          // Segment 2: C1 cubic Bezier from (gx, gateY) out to deflected exit (ex, botY)
          const s = (u - 0.66) / 0.34;
          const proximityToGate = Math.exp(-Math.pow(s / 0.18, 2));
          if (proximityToGate > gatePulse) gatePulse = proximityToGate;

          [-1, 1].forEach((dir) => {
            const gx = dir < 0 ? leftX : rightX;
            const ex = gx + dir * (it.veto ? -34 : 34);
            const [x, y] = evalBezier(
              s,
              [gx, gateY],
              [gx, gateY + 26],
              [ex, botY - 22],
              [ex, botY],
            );
            drawGlowNode(ctx, x, y, 3.3, col, 0.28 * (1 - s * 0.4), 2.7);
          });
        }
      }

      // Draw Left (you) and Right (clone) gate rings with subtle harmonic pulse on passage
      [leftX, rightX].forEach((gx, idx) => {
        const ringCol = idx === 0 ? c.tx : c.red;
        if (gatePulse > 0.05) {
          ctx.strokeStyle = ringCol;
          ctx.globalAlpha = gatePulse * 0.28;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(gx, gateY, 17 + gatePulse * 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.bg;
        ctx.strokeStyle = ringCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gx, gateY, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner reticle dot
        ctx.fillStyle = ringCol;
        ctx.globalAlpha = 0.25 + gatePulse * 0.45;
        ctx.beginPath();
        ctx.arc(gx, gateY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

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
