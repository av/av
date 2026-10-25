import { h, mountCanvas } from './util';

// Fig. 3 (cut): Trajectory divergence & the 5 shear cuts.
const CUTS = [
  { x: 0.24, ay: 0.34, hy: 0.62, sym: '✕', a: '≥400', b: '≥500' },
  { x: 0.41, ay: 0.25, hy: 0.66, sym: '✎', a: '2**n', b: 'jitter' },
  { x: 0.58, ay: 0.19, hy: 0.68, sym: '↺', a: '300s', b: '30s' },
  { x: 0.74, ay: 0.15, hy: 0.69, sym: '↺', a: '200|422', b: '422' },
  { x: 0.89, ay: 0.12, hy: 0.7, sym: '■', a: 'run #2', b: 'SIGKILL' },
];

export function initCutFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  let active = 0;
  let userMoved = false;

  const ctrl = mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 240),
    (ctx, W, H, c, t) => {
      ctx.clearRect(0, 0, W, H);
      if (!userMoved) active = Math.floor(t * 0.55) % CUTS.length;

      const ox = W * 0.08;
      const oy = H * 0.58;
      const endX = W * 0.95;

      const aPts: [number, number][] = [[ox, oy], ...CUTS.map((k): [number, number] => [k.x * W, k.ay * H]), [endX, H * 0.1]];
      const hPts: [number, number][] = [[ox, oy], ...CUTS.map((k): [number, number] => [k.x * W, k.hy * H]), [endX, H * 0.7]];

      const traceCurve = (pts: [number, number][]) => {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i];
          const [x1, y1] = pts[i + 1];
          const mx = (x0 + x1) * 0.5;
          ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
        }
      };

      // Shaded correction delta wedge
      ctx.save();
      ctx.beginPath();
      traceCurve(aPts);
      for (let i = hPts.length - 1; i >= 0; i--) {
        ctx.lineTo(hPts[i][0], hPts[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = c.red;
      ctx.globalAlpha = 0.08;
      ctx.fill();
      ctx.restore();

      // Agent curve (dashed red/grey)
      ctx.strokeStyle = c.red;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      traceCurve(aPts);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Human curve (solid green)
      ctx.strokeStyle = c.green;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      traceCurve(hPts);
      ctx.stroke();

      // 5 vertical shear cuts
      CUTS.forEach((k, i) => {
        const x = k.x * W;
        const ay = k.ay * H;
        const hy = k.hy * H;
        const isAct = i === active;

        ctx.strokeStyle = isAct ? c.tx : c.tx3;
        ctx.globalAlpha = isAct ? 0.9 : 0.35;
        ctx.lineWidth = isAct ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(x, ay);
        ctx.lineTo(x, hy);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Top & bottom nodes
        ctx.fillStyle = c.red;
        ctx.beginPath();
        ctx.arc(x, ay, isAct ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = c.green;
        ctx.beginPath();
        ctx.arc(x, hy, isAct ? 5.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Symbol on the cut
        ctx.font = `500 ${isAct ? 12 : 10}px 'Geist Pixel', monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = isAct ? c.tx : c.tx2;
        ctx.fillText(k.sym, x, hy + 18);

        if (isAct) {
          ctx.font = `500 10px 'Geist Mono', monospace`;
          ctx.fillStyle = c.red;
          ctx.fillText(`-${k.a}`, x, ay - 9);
          ctx.fillStyle = c.green;
          ctx.fillText(`+${k.b}`, x, hy + 32);
        }
      });

      // Origin node
      ctx.fillStyle = c.tx;
      ctx.beginPath();
      ctx.arc(ox, oy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // 3 words on canvas: prompt, agent, you
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = c.tx2;
      ctx.fillText('prompt', ox - 6, oy - 12);

      ctx.textAlign = 'right';
      ctx.fillStyle = c.red;
      ctx.fillText('agent', endX, H * 0.1 - 8);
      ctx.fillStyle = c.green;
      ctx.fillText('you', endX, H * 0.7 - 10);
    },
  );

  const pickFromEvent = (clientX: number) => {
    const rect = ctrl.canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
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
  };

  stage.addEventListener('pointermove', (e) => pickFromEvent(e.clientX));
  stage.addEventListener('click', (e) => pickFromEvent(e.clientX));
}
