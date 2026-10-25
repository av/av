import { createRandom, h, mountCanvas } from './util';

// Fig. 6 (xray): Interactive X-ray loupe over a clean git push block.
export function initXrayFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const r = createRandom(606);
  const rows = Array.from({ length: 11 }, (_, i) => {
    const indent = (i % 3) * 14;
    const bars = Array.from({ length: 3 + (i % 4) }, () => 18 + r() * 55);
    const secret = r() < 0.55 ? 'veto' : 'id';
    return { indent, bars, secret };
  });

  let lx = 0.52;
  let ly = 0.5;
  let userDragged = false;

  const ctrl = mountCanvas(
    stage,
    (w) => (w < 540 ? 205 : 230),
    (ctx, W, H, c, t) => {
      ctx.clearRect(0, 0, W, H);
      if (!userDragged) {
        lx = 0.5 + Math.cos(t * 0.65) * 0.24;
        ly = 0.5 + Math.sin(t * 0.95) * 0.18;
      }

      const cx = lx * W;
      const cy = ly * H;
      const rad = Math.min(78, W * 0.2);
      const padX = W * 0.14;

      // 1. Exterior calm git diff bars
      rows.forEach((row, i) => {
        const y = 24 + i * 16;
        let x = padX + row.indent;
        ctx.fillStyle = c.tx3;
        ctx.globalAlpha = 0.35;
        for (const bw of row.bars) {
          ctx.fillRect(x, y, bw, 5);
          x += bw + 6;
        }
      });
      ctx.globalAlpha = 1;

      // 2. Clipped interior X-ray lens: hidden telemetry wires & red/green veto nodes
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = c.bg;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);

      // Telemetry neural grid inside lens
      ctx.strokeStyle = c.red;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1;
      for (let i = 0; i < rows.length; i++) {
        const y = 24 + i * 16 + 2.5;
        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.bezierCurveTo(cx, y - 12, cx, cy, W - padX, 24);
        ctx.stroke();
      }

      rows.forEach((row, i) => {
        const y = 24 + i * 16;
        let x = padX + row.indent;
        for (let j = 0; j < row.bars.length; j++) {
          const bw = row.bars[j];
          const isVeto = (i + j) % 2 === 0;
          ctx.fillStyle = isVeto ? c.red : c.green;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(x, y - 1, bw, 7);
          x += bw + 6;
        }
      });

      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.fillStyle = c.red;
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.fillText('telemetry', cx, cy - rad + 18);
      ctx.restore();

      // Lens ring
      ctx.strokeStyle = c.tx;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();

      // Surface label (3 words total on canvas: git push, telemetry)
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.fillStyle = c.tx2;
      ctx.textAlign = 'left';
      ctx.fillText('git push', 18, 18);
    },
  );

  const move = (e: PointerEvent) => {
    const rect = ctrl.canvas.getBoundingClientRect();
    userDragged = true;
    lx = Math.max(0.15, Math.min(0.85, (e.clientX - rect.left) / Math.max(1, rect.width)));
    ly = Math.max(0.2, Math.min(0.8, (e.clientY - rect.top) / Math.max(1, rect.height)));
    ctrl.redraw();
  };
  stage.style.cursor = 'grab';
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerdown', move);
}

// Fig. 8 (hillclimb): 80 staff nodes draining into a rising company weight contour.
export function initHillclimbFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  let progress = 0.65;
  let userScrubbed = false;

  const ctrl = mountCanvas(
    stage,
    (w) => (w < 540 ? 205 : 230),
    (ctx, W, H, c, t) => {
      ctx.clearRect(0, 0, W, H);
      const p = userScrubbed ? progress : 0.15 + 0.78 * (0.5 + 0.5 * Math.sin(t * 0.45));

      // Left: 8x8 grid of staff seats
      const cols = 8;
      const rows = 8;
      const total = cols * rows;
      const keep = Math.max(6, Math.round(total * Math.pow(1 - p * 0.88, 1.3)));
      const gx0 = W * 0.08;
      const gy0 = 34;
      const cell = Math.min(18, (W * 0.34) / cols);

      for (let i = 0; i < total; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = gx0 + col * cell;
        const y = gy0 + row * cell;
        const active = i < keep;

        if (active) {
          ctx.fillStyle = c.tx;
          ctx.fillRect(x, y, cell - 4, cell - 4);
        } else {
          ctx.strokeStyle = c.red;
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 5, cell - 5);
          ctx.globalAlpha = 1;
        }
      }

      // Right: Rising company weight mountain
      const rx0 = W * 0.52;
      const rx1 = W * 0.94;
      const baseH = H - 30;
      const peakH = baseH - (H - 68) * p;

      ctx.beginPath();
      ctx.moveTo(rx0, baseH);
      for (let k = 0; k <= 32; k++) {
        const u = k / 32;
        const x = rx0 + u * (rx1 - rx0);
        const hill = Math.sin(u * Math.PI) * (1 - 0.15 * Math.cos(u * Math.PI * 4));
        const y = baseH - hill * (baseH - peakH);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(rx1, baseH);
      ctx.closePath();
      ctx.fillStyle = c.green;
      ctx.globalAlpha = 0.16;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.green;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Streaming arcs from drained seats into the mountain
      ctx.strokeStyle = c.red;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const sy = gy0 + ((k * 13) % (rows * cell));
        ctx.beginPath();
        ctx.moveTo(gx0 + cols * cell, sy);
        ctx.bezierCurveTo(W * 0.46, sy - 20, W * 0.5, peakH + 10, (rx0 + rx1) * 0.5, peakH + 16);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Scrubber bar along bottom
      ctx.fillStyle = c.ui;
      ctx.fillRect(gx0, H - 14, rx1 - gx0, 2);
      ctx.fillStyle = c.tx;
      ctx.fillRect(gx0, H - 15, (rx1 - gx0) * p, 4);

      // 3 words on canvas: staff, weights, 24m
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.fillStyle = c.tx2;
      ctx.textAlign = 'left';
      ctx.fillText('staff', gx0, 22);

      ctx.fillStyle = c.green;
      ctx.textAlign = 'right';
      ctx.fillText('weights', rx1, 22);

      ctx.fillStyle = c.tx3;
      ctx.fillText(`${Math.round(p * 24)}m`, rx1, H - 20);
    },
  );

  const scrub = (e: PointerEvent) => {
    const rect = ctrl.canvas.getBoundingClientRect();
    userScrubbed = true;
    progress = Math.max(0.05, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    ctrl.redraw();
  };
  stage.style.cursor = 'ew-resize';
  stage.addEventListener('pointermove', (e) => {
    if (e.buttons > 0) scrub(e);
  });
  stage.addEventListener('pointerdown', scrub);
}

// Fig. 9 (compounding): Stateless flatline vs compounding shield steps.
export function initCompoundingFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  let fast = false;
  stage.style.cursor = 'pointer';
  stage.addEventListener('click', () => {
    fast = !fast;
  });

  mountCanvas(
    stage,
    (w) => (w < 540 ? 200 : 225),
    (ctx, W, H, c, t) => {
      ctx.clearRect(0, 0, W, H);

      const x0 = 28;
      const x1 = W - 28;
      const flatY = H * 0.78;
      const topY = H * 0.16;

      // Stateless flatline at bottom
      ctx.strokeStyle = c.red;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, flatY);
      ctx.lineTo(x1, flatY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Stepped compounding curve (each step = 1 compiled rule)
      const steps = fast ? 18 : 12;
      const stepW = (x1 - x0) / steps;
      const rate = fast ? 3.2 : 2.3;

      ctx.beginPath();
      ctx.moveTo(x0, flatY);
      for (let i = 0; i < steps; i++) {
        const u = (i + 1) / steps;
        const k = 1 - Math.exp(-u * rate);
        const y = flatY - k * (flatY - topY);
        const sx = x0 + i * stepW;
        const nx = x0 + (i + 1) * stepW;
        ctx.lineTo(sx, y);
        ctx.lineTo(nx, y);
      }
      ctx.strokeStyle = c.green;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Shaded compounding capital wedge
      ctx.lineTo(x1, flatY);
      ctx.lineTo(x0, flatY);
      ctx.closePath();
      ctx.fillStyle = c.green;
      ctx.globalAlpha = 0.11;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Traveling pulse along compiled staircase
      const prog = (t * 0.28) % 1;
      const idx = Math.min(steps - 1, Math.floor(prog * steps));
      const u = (idx + 1) / steps;
      const py = flatY - (1 - Math.exp(-u * rate)) * (flatY - topY);
      const px = x0 + prog * (x1 - x0);
      ctx.fillStyle = c.green;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      // 2 words on canvas: compiled, stateless
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.textAlign = 'right';
      ctx.fillStyle = c.green;
      ctx.fillText('compiled', x1, topY + 14);

      ctx.fillStyle = c.red;
      ctx.fillText('stateless', x1, flatY + 16);
    },
  );
}
