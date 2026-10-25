import { createRandom, h, mountCanvas } from './util';

// Fig. 10 (sandbox): Falling swarm patches filtered by 0, 4, or 15 horizontal laser gates.
export function initSandboxFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  const pill = h('div', 'fxv-pill');
  const b0 = h('button', 'fxv-pill__btn', '0');
  const b4 = h('button', 'fxv-pill__btn', '4');
  const b15 = h('button', 'fxv-pill__btn is-active', '15 gates');
  [b0, b4, b15].forEach((b) => (b.type = 'button'));
  pill.append(b0, b4, b15);
  stage.append(pill);
  fig.prepend(stage);

  let gates = 15;
  const r = createRandom(1010);
  type Drop = { x: number; y: number; vy: number; bad: boolean; stopGate: number };
  const drops: Drop[] = Array.from({ length: 28 }, () => ({
    x: 0.14 + r() * 0.72,
    y: r(),
    vy: 0.22 + r() * 0.18,
    bad: r() < 0.72,
    stopGate: Math.floor(r() * 15),
  }));

  const setGates = (n: number) => {
    gates = n;
    b0.classList.toggle('is-active', n === 0);
    b4.classList.toggle('is-active', n === 4);
    b15.classList.toggle('is-active', n === 15);
  };
  b0.addEventListener('click', () => setGates(0));
  b4.addEventListener('click', () => setGates(4));
  b15.addEventListener('click', () => setGates(15));

  mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 235),
    (ctx, W, H, c) => {
      ctx.clearRect(0, 0, W, H);
      const padX = W * 0.12;
      const topY = 32;
      const botY = H - 28;
      const gateZoneH = botY - topY - 24;

      // Draw active horizontal laser gates
      for (let g = 0; g < 15; g++) {
        const active = (gates === 15) || (gates === 4 && g % 4 === 0);
        if (!active) continue;
        const gy = topY + 12 + (g / 14) * gateZoneH;
        ctx.strokeStyle = c.green;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padX, gy);
        ctx.lineTo(W - padX, gy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Main branch baseline at bottom
      ctx.strokeStyle = c.tx;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padX, botY);
      ctx.lineTo(W - padX, botY);
      ctx.stroke();

      // Update & draw falling patches
      for (const d of drops) {
        d.y += d.vy * 0.008;
        if (d.y > 1) {
          d.y = 0;
          d.x = 0.14 + r() * 0.72;
          d.bad = r() < 0.72;
          d.stopGate = Math.floor(r() * 15);
        }

        const blocked =
          d.bad &&
          ((gates === 15) || (gates === 4 && d.stopGate % 4 === 0));
        const stopY = blocked
          ? (topY + 12 + (d.stopGate / 14) * gateZoneH) / H
          : botY / H;

        const px = d.x * W;
        const py = Math.min(d.y, stopY) * H;

        if (blocked && d.y >= stopY) {
          // Vaporized spark on gate
          ctx.strokeStyle = c.red;
          ctx.globalAlpha = Math.max(0, 1 - (d.y - stopY) * 6);
          ctx.lineWidth = 1.4;
          const rad = 3 + (d.y - stopY) * 28;
          ctx.strokeRect(px - rad, py - 2, rad * 2, 4);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = d.bad ? c.red : c.green;
          ctx.globalAlpha = 0.88;
          ctx.fillRect(px - 5, py - 3, 10, 6);
        }
      }
      ctx.globalAlpha = 1;

      // 1 word on canvas: main (+ 3 words in pill = 4 words)
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.fillStyle = c.tx2;
      ctx.textAlign = 'left';
      ctx.fillText('main', padX, botY + 15);
    },
  );
}

// Fig. 12 (topology): 4 Tailscale hosts pulsing errors into tracequest and receiving synced green rings.
export function initTopologyFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const NODES = [
    { name: 'mac', ang: -2.4 },
    { name: 'fedora', ang: -0.7 },
    { name: 'hetzner', ang: 0.7 },
    { name: 'av', ang: 2.4 },
  ];

  let triggerNode = 1;
  let pulseT = 0;

  stage.style.cursor = 'pointer';
  stage.addEventListener('click', () => {
    triggerNode = (triggerNode + 1) % NODES.length;
    pulseT = 0;
  });

  mountCanvas(
    stage,
    (w) => (w < 540 ? 205 : 230),
    (ctx, W, H, c) => {
      ctx.clearRect(0, 0, W, H);
      pulseT += 0.014;
      if (pulseT > 2.2) {
        pulseT = 0;
        triggerNode = (triggerNode + 1) % NODES.length;
      }

      const cx = W * 0.5;
      const cy = H * 0.52;
      const rx = Math.min(185, W * 0.34);
      const ry = Math.min(68, H * 0.31);

      // Spokes & nodes
      NODES.forEach((n, i) => {
        const nx = cx + Math.cos(n.ang) * rx;
        const ny = cy + Math.sin(n.ang) * ry;

        ctx.strokeStyle = c.ui;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        // Phase 1 (0..0.8): Red error travels inward from triggerNode to hub
        if (i === triggerNode && pulseT < 0.8) {
          const u = pulseT / 0.8;
          const px = nx + (cx - nx) * u;
          const py = ny + (cy - ny) * u;
          ctx.fillStyle = c.red;
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Phase 2 (0.8..1.8): Green compiled rule broadcasts outward to all 4 hosts
        if (pulseT >= 0.8 && pulseT <= 1.8) {
          const u = (pulseT - 0.8) / 1.0;
          const px = cx + (nx - cx) * u;
          const py = cy + (ny - cy) * u;
          ctx.fillStyle = c.green;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        const immunized = pulseT > 1.65;
        ctx.fillStyle = c.bg;
        ctx.strokeStyle = immunized ? c.green : i === triggerNode && pulseT < 0.8 ? c.red : c.tx2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = `500 10px 'Geist Pixel', monospace`;
        ctx.fillStyle = c.tx2;
        ctx.textAlign = 'center';
        ctx.fillText(n.name, nx, ny + (ny < cy ? -14 : 22));
      });

      // Central tracequest hub
      ctx.fillStyle = c.bg;
      ctx.strokeStyle = pulseT >= 0.75 && pulseT <= 1.2 ? c.green : c.tx;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.fillStyle = c.tx;
      ctx.textAlign = 'center';
      ctx.fillText('tracequest', cx, cy + 28);
    },
  );
}

// Fig. 13 (anatomy): 3-Chamber Veto Crystallizer (3 chaotic traces -> slit -> 1 gate).
export function initAnatomyFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  mountCanvas(
    stage,
    (w) => (w < 540 ? 195 : 220),
    (ctx, W, H, c, t) => {
      ctx.clearRect(0, 0, W, H);

      const x0 = 28;
      const slitX = W * 0.46;
      const gateX = W * 0.8;
      const midY = H * 0.52;

      // Left: 3 chaotic red traces converging on optical collimator slit
      for (let k = -1; k <= 1; k++) {
        ctx.strokeStyle = c.red;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const x = x0 + u * (slitX - x0);
          const env = 1 - u;
          const y =
            midY +
            k * 42 * env +
            Math.sin(u * 14 - t * 3 + k * 2) * 14 * env;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Collimator slit jaws at slitX
      ctx.strokeStyle = c.tx;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(slitX, 24);
      ctx.lineTo(slitX, midY - 8);
      ctx.moveTo(slitX, midY + 8);
      ctx.lineTo(slitX, H - 24);
      ctx.stroke();

      // Middle: extracted invariant laser beam
      ctx.strokeStyle = c.green;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(slitX, midY);
      ctx.lineTo(gateX - 18, midY);
      ctx.stroke();

      // Right: crystalline gate block
      ctx.strokeStyle = c.green;
      ctx.fillStyle = c.bg;
      ctx.lineWidth = 2.2;
      ctx.fillRect(gateX - 18, midY - 26, 36, 52);
      ctx.strokeRect(gateX - 18, midY - 26, 36, 52);

      // Checkmark inside gate
      ctx.beginPath();
      ctx.moveTo(gateX - 7, midY);
      ctx.lineTo(gateX - 1, midY + 6);
      ctx.lineTo(gateX + 9, midY - 6);
      ctx.stroke();

      // 3 words on canvas: traces, invariant, gate
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = c.red;
      ctx.fillText('traces', (x0 + slitX) * 0.5, 20);

      ctx.fillStyle = c.tx2;
      ctx.fillText('invariant', (slitX + gateX) * 0.5, 20);

      ctx.fillStyle = c.green;
      ctx.fillText('gate', gateX, midY + 42);
    },
  );
}

// Fig. 14 (pareto): The 90/10 Pareto Tower (15 mechanical blocks vs 10% rare capstone).
export function initParetoFigure(fig: HTMLElement): void {
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
    (w) => (w < 540 ? 210 : 235),
    (ctx, W, H, c) => {
      k += ((compiled ? 1 : 0) - k) * 0.12;
      ctx.clearRect(0, 0, W, H);

      const cx = W * 0.5;
      const maxW = Math.min(360, W * 0.64);
      const botY = H - 24;

      // 15 Pareto slabs (90% of height)
      for (let i = 0; i < 15; i++) {
        const u = i / 14;
        const w = maxW * Math.pow(1 - u * 0.68, 0.85);
        const y = botY - (i + 1) * 9.5;
        const slide = k * ((i % 2 === 0 ? 1 : -1) * (W * 0.36));
        const alpha = 0.75 * (1 - k * 0.78);

        ctx.fillStyle = k > 0.5 ? c.green : c.tx3;
        ctx.globalAlpha = alpha;
        ctx.fillRect(cx - w / 2 + slide, y, w, 7);
      }
      ctx.globalAlpha = 1;

      // Top 10% rare judgment capstone (drops to center when 90% compiles away)
      const capY = (botY - 15 * 9.5 - 22) * (1 - k) + (H * 0.46) * k;
      const capW = 64 + k * 24;
      const capH = 18 + k * 8;
      ctx.fillStyle = c.green;
      ctx.fillRect(cx - capW / 2, capY, capW, capH);

      // 3 words on canvas: 10% taste, 90% (+ compile pill = 4 words)
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = c.green;
      ctx.fillText('10% taste', cx, capY - 8);

      if (k < 0.7) {
        ctx.fillStyle = c.tx2;
        ctx.globalAlpha = 1 - k;
        ctx.fillText('90%', cx, botY - 68);
        ctx.globalAlpha = 1;
      }
    },
  );
}
