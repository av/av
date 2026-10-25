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

// Fig. 6 (xray): Precision Optical X-Ray Loupe over a git push payload.
export function initXrayFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const r = createRandom(606);
  const rows = Array.from({ length: 11 }, (_, i) => ({
    indent: (i % 3) * 14,
    bars: Array.from({ length: 3 + (i % 4) }, () => 18 + r() * 58),
  }));

  const lxSp = createSpring(0.52);
  const lySp = createSpring(0.5);

  mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 240),
    (ctx, W, H, c, t, dt, pointer) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      if (pointer.inside) {
        lxSp.target = clamp(pointer.x, 0.16, 0.84);
        lySp.target = clamp(pointer.y, 0.22, 0.78);
      } else {
        lxSp.target = 0.52 + Math.cos(t * 0.65) * 0.22;
        lySp.target = 0.5 + Math.sin(t * 0.95) * 0.16;
      }

      const cx = lxSp.step(dt, 180, 22) * W;
      const cy = lySp.step(dt, 180, 22) * H;
      const rad = Math.min(82, W * 0.21);
      const padX = W * 0.14;

      // 1. Exterior calm git diff bars
      rows.forEach((row, i) => {
        const y = 30 + i * 16;
        let x = padX + row.indent;
        ctx.fillStyle = c.tx3;
        ctx.globalAlpha = 0.34;
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

      // Fine cross-grid inside optical loupe
      ctx.strokeStyle = c.ui;
      ctx.lineWidth = 1;
      for (let x = cx - rad; x <= cx + rad; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, cy - rad);
        ctx.lineTo(x, cy + rad);
        ctx.stroke();
      }
      for (let y = cy - rad; y <= cy + rad; y += 14) {
        ctx.beginPath();
        ctx.moveTo(cx - rad, y);
        ctx.lineTo(cx + rad, y);
        ctx.stroke();
      }

      // Telemetry extraction splines converging to collector
      ctx.strokeStyle = c.red;
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < rows.length; i++) {
        const y = 30 + i * 16 + 2.5;
        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.bezierCurveTo(cx, y - 10, cx, cy, W - padX, 26);
        ctx.stroke();
      }

      rows.forEach((row, i) => {
        const y = 30 + i * 16;
        let x = padX + row.indent;
        for (let j = 0; j < row.bars.length; j++) {
          const bw = row.bars[j];
          const isVeto = (i + j) % 2 === 0;
          ctx.fillStyle = isVeto ? c.red : c.green;
          ctx.globalAlpha = 0.88;
          ctx.fillRect(x, y - 1, bw, 7);
          x += bw + 6;
        }
      });

      drawChip(ctx, 'telemetry', cx, cy - rad + 20, c.red, c.bg, c.red, 'center');
      ctx.restore();

      // Optical loupe double bezel + degree ticks
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = c.tx;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = c.tx3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, rad + 4, 0, Math.PI * 2);
      ctx.stroke();

      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2 + t * 0.15;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * (rad - 4), Math.sin(ang) * (rad - 4));
        ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        ctx.stroke();
      }
      ctx.restore();

      drawChip(ctx, 'git push', 18, 20, c.tx2, c.bg, c.ui, 'left');
    },
  );
  stage.style.cursor = 'grab';
}

// Fig. 8 (hillclimb): 64 staff seats draining into a rising multi-ridgeline weight mountain.
export function initHillclimbFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const progSp = createSpring(0.65);
  let userScrubbed = false;

  mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 240),
    (ctx, W, H, c, t, dt, pointer) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      if (pointer.inside) {
        userScrubbed = true;
        progSp.target = clamp(pointer.x, 0.05, 1);
      } else if (!userScrubbed) {
        progSp.target = 0.18 + 0.76 * (0.5 + 0.5 * Math.sin(t * 0.45));
      }
      const p = clamp(progSp.step(dt, 140, 20), 0.02, 1);

      const cols = 8;
      const rows = 8;
      const total = cols * rows;
      const keep = Math.max(5, Math.round(total * Math.pow(1 - p * 0.88, 1.3)));
      const gx0 = W * 0.08;
      const gy0 = 38;
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
          ctx.globalAlpha = 0.36;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 5, cell - 5);
          ctx.globalAlpha = 1;
        }
      }

      // Right: Multi-ridgeline elevation contour of company weights
      const rx0 = W * 0.5;
      const rx1 = W * 0.94;
      const baseH = H - 30;
      const maxPeak = (H - 72) * p;

      for (let layer = 4; layer >= 0; layer--) {
        const lk = (layer + 1) / 5;
        const peakH = baseH - maxPeak * lk;
        ctx.beginPath();
        ctx.moveTo(rx0, baseH);
        for (let k = 0; k <= 36; k++) {
          const u = k / 36;
          const x = rx0 + u * (rx1 - rx0);
          const env = Math.sin(u * Math.PI);
          const ridge = 1 - 0.14 * Math.cos(u * Math.PI * 4 + layer * 0.8);
          const y = baseH - env * ridge * (baseH - peakH);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(rx1, baseH);
        ctx.closePath();
        ctx.fillStyle = c.green;
        ctx.globalAlpha = 0.06;
        ctx.fill();

        ctx.strokeStyle = c.green;
        ctx.globalAlpha = layer === 4 ? 0.95 : 0.28;
        ctx.lineWidth = layer === 4 ? 2.2 : 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Flowing particle arcs from drained seats into the peak
      const topPeakY = baseH - maxPeak;
      const midPeakX = (rx0 + rx1) * 0.5;
      for (let k = 0; k < 5; k++) {
        const sy = gy0 + ((k * 15) % (rows * cell));
        const sx = gx0 + cols * cell;
        ctx.strokeStyle = c.red;
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(W * 0.45, sy - 18, W * 0.48, topPeakY + 8, midPeakX, topPeakY + 12);
        ctx.stroke();

        const u = (t * 0.4 + k * 0.2) % 1;
        const inv = 1 - u;
        const px =
          inv * inv * inv * sx +
          3 * inv * inv * u * (W * 0.45) +
          3 * inv * u * u * (W * 0.48) +
          u * u * u * midPeakX;
        const py =
          inv * inv * inv * sy +
          3 * inv * inv * u * (sy - 18) +
          3 * inv * u * u * (topPeakY + 8) +
          u * u * u * (topPeakY + 12);
        drawGlowNode(ctx, px, py, 2.2, u > 0.55 ? c.green : c.red, 0.2, 2.4);
      }
      ctx.globalAlpha = 1;

      // Scrubber track along bottom
      ctx.fillStyle = c.ui;
      ctx.fillRect(gx0, H - 14, rx1 - gx0, 2);
      ctx.fillStyle = c.tx;
      ctx.fillRect(gx0, H - 15, (rx1 - gx0) * p, 4);

      drawChip(ctx, 'staff', gx0, 20, c.tx2, c.bg, c.ui, 'left');
      drawChip(ctx, 'weights', rx1, 20, c.green, c.bg, c.green, 'right');
      drawChip(ctx, `${Math.round(p * 24)}m`, gx0 + (rx1 - gx0) * p, H - 24, c.tx, c.bg, c.ui, 'center');
    },
  );
  stage.style.cursor = 'ew-resize';
}

// Fig. 9 (compounding): Stateless flatline vs compounding shield staircase.
export function initCompoundingFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  let fast = false;
  const rateSp = createSpring(2.3);
  stage.style.cursor = 'pointer';
  stage.addEventListener('click', () => {
    fast = !fast;
    rateSp.target = fast ? 3.4 : 2.3;
  });

  mountCanvas(
    stage,
    (w) => (w < 540 ? 205 : 235),
    (ctx, W, H, c, t, dt) => {
      const rate = rateSp.step(dt, 140, 18);
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      const x0 = 28;
      const x1 = W - 28;
      const flatY = H * 0.78;
      const topY = H * 0.16;

      // Stateless flatline at bottom
      ctx.strokeStyle = c.red;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, flatY);
      ctx.lineTo(x1, flatY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      const steps = 14;
      const stepW = (x1 - x0) / steps;

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

      // Shaded compounding capital wedge with vertical riser ticks
      ctx.lineTo(x1, flatY);
      ctx.lineTo(x0, flatY);
      ctx.closePath();
      ctx.fillStyle = c.green;
      ctx.globalAlpha = 0.1;
      ctx.fill();
      ctx.globalAlpha = 1;

      for (let i = 0; i < steps; i++) {
        const u = (i + 1) / steps;
        const k = 1 - Math.exp(-u * rate);
        const y = flatY - k * (flatY - topY);
        const sx = x0 + i * stepW;
        drawGlowNode(ctx, sx, y, 2.2, c.green, 0.15, 2.2);
      }

      // Traveling pulse along compiled staircase
      const prog = (t * 0.26) % 1;
      const idx = Math.min(steps - 1, Math.floor(prog * steps));
      const u = (idx + 1) / steps;
      const py = flatY - (1 - Math.exp(-u * rate)) * (flatY - topY);
      const px = x0 + prog * (x1 - x0);
      drawGlowNode(ctx, px, py, 4, c.green, 0.35, 3);

      drawChip(ctx, 'compiled', x1, topY + 6, c.green, c.bg, c.green, 'right');
      drawChip(ctx, 'stateless', x1, flatY - 16, c.red, c.bg, c.red, 'right');
    },
  );
}
