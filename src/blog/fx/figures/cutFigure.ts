import {
  clamp,
  createSpring,
  drawBlueprint,
  drawChip,
  drawGlowNode,
  h,
  lerp,
  mountCanvas,
} from './util';

// Fig. 3 (cut): Trajectory divergence & the 5 shear cuts.
const CUTS = [
  { x: 0.24, ay: 0.34, hy: 0.63, sym: '✕', a: '≥400', b: '≥500' },
  { x: 0.41, ay: 0.25, hy: 0.67, sym: '✎', a: '2**n', b: 'jitter' },
  { x: 0.58, ay: 0.19, hy: 0.69, sym: '↺', a: '300s', b: '30s' },
  { x: 0.74, ay: 0.15, hy: 0.71, sym: '↺', a: '200|422', b: '422' },
  { x: 0.89, ay: 0.12, hy: 0.72, sym: '■', a: 'run #2', b: 'SIGKILL' },
];

export function initCutFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  let active = 0;
  let userMoved = false;
  const focusSp = createSpring(0);

  const ctrl = mountCanvas(
    stage,
    (w) => (w < 540 ? 220 : 250),
    (ctx, W, H, c, t, dt, pointer) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      if (pointer.inside) {
        userMoved = true;
        let best = 0;
        let bestD = 99;
        CUTS.forEach((k, i) => {
          const d = Math.abs(k.x - pointer.x);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        active = best;
      } else if (!userMoved) {
        active = Math.floor(t * 0.5) % CUTS.length;
      }

      focusSp.target = active;
      const focusIdx = focusSp.step(dt, 180, 22);

      const ox = W * 0.08;
      const oy = H * 0.56;
      const endX = W * 0.94;

      const aPts: [number, number][] = [
        [ox, oy],
        ...CUTS.map((k): [number, number] => [k.x * W, k.ay * H]),
        [endX, H * 0.11],
      ];
      const hPts: [number, number][] = [
        [ox, oy],
        ...CUTS.map((k): [number, number] => [k.x * W, k.hy * H]),
        [endX, H * 0.72],
      ];

      const traceCurve = (pts: [number, number][]) => {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i];
          const [x1, y1] = pts[i + 1];
          const mx = (x0 + x1) * 0.5;
          ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
        }
      };

      // Shaded correction delta wedge with diagonal hatch lines
      ctx.save();
      ctx.beginPath();
      traceCurve(aPts);
      for (let i = hPts.length - 1; i >= 0; i--) {
        ctx.lineTo(hPts[i][0], hPts[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = c.red;
      ctx.globalAlpha = 0.07;
      ctx.fill();
      ctx.clip();

      ctx.strokeStyle = c.red;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = 1;
      for (let x = -H; x < W + H; x += 11) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + H, H);
        ctx.stroke();
      }
      ctx.restore();

      // Agent curve (dashed red)
      ctx.strokeStyle = c.red;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      traceCurve(aPts);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Human curve (solid green + subtle underglow)
      ctx.strokeStyle = c.green;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 6;
      ctx.beginPath();
      traceCurve(hPts);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      traceCurve(hPts);
      ctx.stroke();

      // 5 vertical shear cuts
      CUTS.forEach((k, i) => {
        const x = k.x * W;
        const ay = k.ay * H;
        const hy = k.hy * H;
        const prox = clamp(1 - Math.abs(focusIdx - i));

        ctx.strokeStyle = prox > 0.5 ? c.tx : c.tx3;
        ctx.globalAlpha = lerp(0.32, 0.95, prox);
        ctx.lineWidth = lerp(1, 1.8, prox);
        ctx.beginPath();
        ctx.moveTo(x, ay);
        ctx.lineTo(x, hy);
        ctx.stroke();
        ctx.globalAlpha = 1;

        drawGlowNode(ctx, x, ay, lerp(2.8, 4.5, prox), c.red, prox * 0.25, 2.8);
        drawGlowNode(ctx, x, hy, lerp(3.2, 5.2, prox), c.green, prox * 0.3, 2.8);

        ctx.font = `500 ${Math.round(lerp(10, 12, prox))}px 'Geist Pixel', monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = prox > 0.5 ? c.tx : c.tx2;
        ctx.fillText(k.sym, x, hy + 18);

        if (i === active) {
          drawChip(ctx, `-${k.a}`, x, ay - 16, c.red, c.bg, c.red, 'center');
          drawChip(ctx, `+${k.b}`, x, hy + 34, c.green, c.bg, c.green, 'center');
        }
      });

      drawGlowNode(ctx, ox, oy, 5, c.tx, 0.18, 2.5);

      drawChip(ctx, 'prompt', ox + 4, oy - 18, c.tx2, c.bg, c.ui, 'left');
      drawChip(ctx, 'agent', endX, H * 0.11 - 12, c.red, c.bg, c.red, 'right');
      drawChip(ctx, 'you', endX, H * 0.72 - 14, c.green, c.bg, c.green, 'right');
    },
  );

  stage.style.cursor = 'crosshair';
  stage.addEventListener('click', (e) => {
    const rect = ctrl.canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
    let best = 0;
    let bestD = 99;
    CUTS.forEach((k, i) => {
      const d = Math.abs(k.x - nx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    userMoved = true;
    active = best;
    ctrl.redraw();
  });
}
