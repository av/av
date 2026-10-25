import { createRandom, h, mountCanvas } from './util';

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

  mountCanvas(
    stage,
    (w) => (w < 540 ? 205 : 230),
    (ctx, W, H, c) => {
      ctx.clearRect(0, 0, W, H);

      const cx = W * 0.5;
      const splitY = H * 0.44;
      const leftX = W * 0.24;
      const rightX = W * 0.76;
      const gateY = H * 0.74;

      // Center divider line
      ctx.strokeStyle = c.ui;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, splitY);
      ctx.lineTo(cx, H - 18);
      ctx.stroke();
      ctx.setLineDash([]);

      // Left (you) and Right (clone) gate rings
      [leftX, rightX].forEach((gx) => {
        ctx.strokeStyle = c.tx2;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(gx, gateY, 16, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Stream items down center, then mirror into both gates simultaneously
      for (const it of items) {
        it.u = (it.u + it.speed * 0.008) % 1;
        const u = it.u;
        const col = it.veto ? c.red : c.green;

        if (u < 0.4) {
          const y = 16 + (u / 0.4) * (splitY - 16);
          ctx.fillStyle = c.tx2;
          ctx.fillRect(cx - 4, y - 4, 8, 8);
        } else {
          const v = (u - 0.4) / 0.6;
          [-1, 1].forEach((dir) => {
            const gx = dir < 0 ? leftX : rightX;
            const x = cx + (gx - cx) * Math.min(1, v * 1.4) + (v > 0.7 ? dir * (it.veto ? -28 : 28) * (v - 0.7) * 3 : 0);
            const y = splitY + v * (H - 22 - splitY);
            ctx.fillStyle = v > 0.48 ? col : c.tx2;
            ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
          });
        }
      }

      // 3 words on canvas: you, clone · 98%
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = c.tx;
      ctx.fillText('you', leftX, gateY + 30);

      ctx.fillStyle = c.red;
      ctx.fillText('clone · 98%', rightX, gateY + 30);
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

  let bend = 0.52;
  let userMoved = false;

  const ctrl = mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 235),
    (ctx, W, H, c, t) => {
      ctx.clearRect(0, 0, W, H);
      const b = userMoved ? bend : 0.48 + Math.sin(t * 0.6) * 0.16;

      // Decision boundary function in normalized [0,1] coords
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
        ctx.globalAlpha = approved ? 0.78 : 0.68;
        const px = p.x * W;
        const py = p.y * H;
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      // Razor-sharp decision boundary curve
      ctx.strokeStyle = c.tx;
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

      // 3 words on canvas: accept, boundary, veto
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = c.green;
      ctx.fillText('accept', 18, 22);

      ctx.textAlign = 'right';
      ctx.fillStyle = c.tx;
      ctx.fillText('boundary', W - 18, boundaryY(0.92) * H - 8);

      ctx.fillStyle = c.red;
      ctx.fillText('veto', W - 18, H - 14);
    },
  );

  stage.style.cursor = 'ns-resize';
  stage.addEventListener('pointermove', (e) => {
    const rect = ctrl.canvas.getBoundingClientRect();
    userMoved = true;
    bend = Math.max(0.15, Math.min(0.95, 1 - (e.clientY - rect.top) / Math.max(1, rect.height)));
    ctrl.redraw();
  });
}
