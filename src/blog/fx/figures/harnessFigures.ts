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
    vy: 0.28 + r() * 0.22,
    bad: r() < 0.74,
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
    (w) => (w < 540 ? 215 : 240),
    (ctx, W, H, c, _t, dt) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      const padX = W * 0.12;
      const topY = 34;
      const botY = H - 28;
      const gateZoneH = botY - topY - 22;

      // Active horizontal laser gates
      for (let g = 0; g < 15; g++) {
        const active = gates === 15 || (gates === 4 && g % 4 === 0);
        if (!active) continue;
        const gy = topY + 12 + (g / 14) * gateZoneH;
        ctx.strokeStyle = c.green;
        ctx.globalAlpha = 0.36;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padX, gy);
        ctx.lineTo(W - padX, gy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Main branch baseline at bottom
      ctx.strokeStyle = c.tx;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(padX, botY);
      ctx.lineTo(W - padX, botY);
      ctx.stroke();

      for (const d of drops) {
        d.y += d.vy * dt * 0.65;
        if (d.y > 1) {
          d.y = 0;
          d.x = 0.14 + r() * 0.72;
          d.bad = r() < 0.74;
          d.stopGate = Math.floor(r() * 15);
        }

        const blocked = d.bad && (gates === 15 || (gates === 4 && d.stopGate % 4 === 0));
        const stopY = blocked ? (topY + 12 + (d.stopGate / 14) * gateZoneH) / H : botY / H;

        const px = d.x * W;
        const py = Math.min(d.y, stopY) * H;

        if (blocked && d.y >= stopY) {
          const age = clamp((d.y - stopY) * 6);
          ctx.strokeStyle = c.red;
          ctx.globalAlpha = 1 - age;
          ctx.lineWidth = 1.5;
          const rad = 4 + age * 26;
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          const col = d.bad ? c.red : c.green;
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.25;
          ctx.fillRect(px - 1, py - 14, 2, 12);
          ctx.globalAlpha = 0.92;
          ctx.fillRect(px - 4.5, py - 2.5, 9, 5);
        }
      }
      ctx.globalAlpha = 1;

      drawChip(ctx, 'main', padX, botY - 14, c.tx, c.bg, c.ui, 'left');
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
    (w) => (w < 540 ? 215 : 240),
    (ctx, W, H, c, _t, dt) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      pulseT += dt * 0.85;
      if (pulseT > 2.2) {
        pulseT = 0;
        triggerNode = (triggerNode + 1) % NODES.length;
      }

      const cx = W * 0.5;
      const cy = H * 0.5;
      const rx = Math.min(195, W * 0.35);
      const ry = Math.min(72, H * 0.32);

      // Expanding green sync wave ring from central hub
      if (pulseT >= 0.8 && pulseT <= 1.9) {
        const u = (pulseT - 0.8) / 1.1;
        ctx.strokeStyle = c.green;
        ctx.globalAlpha = (1 - u) * 0.45;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * u, ry * u, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      NODES.forEach((n, i) => {
        const nx = cx + Math.cos(n.ang) * rx;
        const ny = cy + Math.sin(n.ang) * ry;

        ctx.strokeStyle = c.tx3;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Phase 1 (0..0.8): Red error travels inward from triggerNode to hub
        if (i === triggerNode && pulseT < 0.8) {
          const u = pulseT / 0.8;
          const px = lerp(nx, cx, u);
          const py = lerp(ny, cy, u);
          drawGlowNode(ctx, px, py, 4.5, c.red, 0.35, 3);
        }

        // Phase 2 (0.8..1.8): Green compiled rule broadcasts outward to all 4 hosts
        if (pulseT >= 0.8 && pulseT <= 1.8) {
          const u = (pulseT - 0.8) / 1.0;
          const px = lerp(cx, nx, u);
          const py = lerp(cy, ny, u);
          drawGlowNode(ctx, px, py, 3.8, c.green, 0.3, 2.8);
        }

        const immunized = pulseT > 1.6;
        const nodeCol = immunized ? c.green : i === triggerNode && pulseT < 0.8 ? c.red : c.tx2;

        ctx.fillStyle = c.bg;
        ctx.strokeStyle = nodeCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawGlowNode(ctx, nx, ny, 3, nodeCol, immunized ? 0.25 : 0.1, 3);

        drawChip(ctx, n.name, nx, ny + (ny < cy ? -22 : 22), nodeCol, c.bg, c.ui, 'center');
      });

      // Central tracequest hub
      const hubActive = pulseT >= 0.72 && pulseT <= 1.25;
      ctx.fillStyle = c.bg;
      ctx.strokeStyle = hubActive ? c.green : c.tx;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, cy, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawGlowNode(ctx, cx, cy, 4.5, hubActive ? c.green : c.tx, 0.25, 3);

      drawChip(ctx, 'tracequest', cx, cy + 32, c.tx, c.bg, c.ui, 'center');
    },
  );
}

// Fig. 13 (anatomy): 3-Chamber Veto Crystallizer (3 chaotic traces -> slit -> 1 gate).
export function initAnatomyFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  mountCanvas(
    stage,
    (w) => (w < 540 ? 205 : 230),
    (ctx, W, H, c, t) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      const x0 = 28;
      const slitX = W * 0.46;
      const gateX = W * 0.8;
      const midY = H * 0.54;

      // Left: 3 chaotic red traces converging on optical collimator slit
      for (let k = -1; k <= 1; k++) {
        ctx.strokeStyle = c.red;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        const steps = 48;
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const x = lerp(x0, slitX, u);
          const env = Math.pow(1 - u, 1.1);
          const y = midY + k * 44 * env + Math.sin(u * 15 - t * 3.4 + k * 2.1) * 15 * env;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Collimator slit jaws at slitX
      ctx.strokeStyle = c.tx;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(slitX, 26);
      ctx.lineTo(slitX, midY - 9);
      ctx.moveTo(slitX, midY + 9);
      ctx.lineTo(slitX, H - 22);
      ctx.stroke();

      // Middle: extracted invariant laser beam + glow
      ctx.strokeStyle = c.green;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(slitX, midY);
      ctx.lineTo(gateX - 20, midY);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(slitX, midY);
      ctx.lineTo(gateX - 20, midY);
      ctx.stroke();

      // Traveling coherent pulse
      const px = lerp(slitX, gateX - 20, (t * 0.65) % 1);
      drawGlowNode(ctx, px, midY, 3.2, c.green, 0.3, 2.8);

      // Right: crystalline gate block
      ctx.fillStyle = c.bg;
      ctx.strokeStyle = c.green;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(gateX - 20, midY - 26, 40, 52, 5);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(gateX - 7, midY);
      ctx.lineTo(gateX - 1, midY + 6);
      ctx.lineTo(gateX + 9, midY - 6);
      ctx.stroke();

      drawChip(ctx, 'traces', (x0 + slitX) * 0.46, 20, c.red, c.bg, c.red, 'center');
      drawChip(ctx, 'invariant', (slitX + gateX) * 0.5, 20, c.tx2, c.bg, c.ui, 'center');
      drawChip(ctx, 'gate', gateX, midY + 42, c.green, c.bg, c.green, 'center');
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
    (w) => (w < 540 ? 215 : 240),
    (ctx, W, H, c, _t, dt) => {
      const k = clamp(compSp.step(dt, 150, 18), 0, 1);
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      const cx = W * 0.5;
      const maxW = Math.min(360, W * 0.64);
      const botY = H - 24;

      for (let i = 0; i < 15; i++) {
        const u = i / 14;
        const w = maxW * Math.pow(1 - u * 0.68, 0.85);
        const y = botY - (i + 1) * 9.5;
        const slide = k * ((i % 2 === 0 ? 1 : -1) * (W * 0.36));
        const alpha = 0.78 * (1 - k * 0.82);

        ctx.fillStyle = k > 0.5 ? c.green : c.tx3;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.roundRect(cx - w * 0.5 + slide, y, w, 7, 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const capY = lerp(botY - 15 * 9.5 - 22, H * 0.48, k);
      const capW = lerp(68, 96, k);
      const capH = lerp(18, 26, k);

      ctx.fillStyle = c.green;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.roundRect(cx - capW * 0.5 - 5, capY - 5, capW + 10, capH + 10, 6);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.roundRect(cx - capW * 0.5, capY, capW, capH, 4);
      ctx.fill();

      drawChip(ctx, '10% taste', cx, capY - 14, c.green, c.bg, c.green, 'center');
      if (k < 0.65) {
        drawChip(ctx, '90%', cx, botY - 68, c.tx, c.bg, c.ui, 'center');
      }
    },
  );
}
