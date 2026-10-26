import {
  clamp,
  createRandom,
  createSpring,
  drawBlueprint,
  drawChip,
  drawGlowNode,
  easeInOutCubic,
  h,
  lerp,
  mountCanvas,
} from './util';

// Fig. 1 (arbitrage): Magnetic Mass Spectrometer.
// Raw token particles enter from the left; an electromagnetic field separator
// bends the 4% red/green veto ions upward into a 3D rotating weight tesseract,
// while 96% grey noise tokens fall into the $1 collector trough.
export function initArbitrageFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const r = createRandom(101);
  type Ion = {
    x: number;
    y0: number;
    speed: number;
    veto: boolean;
    phase: number;
    trail: [number, number][];
  };

  const ions: Ion[] = Array.from({ length: 130 }, () => ({
    x: r(),
    y0: 0.46 + (r() - 0.5) * 0.08,
    speed: 0.22 + r() * 0.16,
    veto: r() < 0.12,
    phase: r() * Math.PI * 2,
    trail: [],
  }));

  const boostSp = createSpring(0);
  stage.style.cursor = 'pointer';
  stage.addEventListener('click', () => {
    boostSp.vel += 4.5;
  });

  mountCanvas(
    stage,
    (w) => (w < 540 ? 215 : 245),
    (ctx, W, H, c, t, dt, pointer) => {
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      boostSp.target = pointer.inside ? 0.45 : 0;
      const boost = clamp(boostSp.step(dt, 140, 16), 0, 1.5);

      const splitX = W * 0.42;
      const crystalX = W * 0.82;
      const crystalY = H * 0.28;
      const troughY = H * 0.81;
      const beamY = H * 0.46;

      // Magnetic field flux rings around the separator plane
      ctx.save();
      for (let k = 0; k < 3; k++) {
        const rad = 18 + k * 14 + Math.sin(t * 2.5 + k) * 3;
        ctx.strokeStyle = c.tx3;
        ctx.globalAlpha = 0.14 - k * 0.03;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(splitX, beamY, rad * 0.45, rad * 1.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Separator vertical axis
      ctx.strokeStyle = c.tx3;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(splitX, 18);
      ctx.lineTo(splitX, H - 18);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Update & draw ion streams with velocity ribbon trails
      for (const p of ions) {
        const prevX = p.x;
        p.x += p.speed * dt * (1 + boost * 0.45);
        if (p.x > 0.9) {
          p.x = 0.04;
          p.y0 = 0.46 + (r() - 0.5) * 0.07;
          p.veto = r() < (0.12 + boost * 0.18);
          p.trail.length = 0;
        }

        const px = p.x * W;
        let py = p.y0 * H;
        if (p.x > 0.4) {
          const u = clamp((p.x - 0.4) / 0.42);
          const e = easeInOutCubic(u);
          const destY = p.veto
            ? crystalY + Math.sin(t * 3.2 + p.phase) * 7
            : troughY + Math.cos(p.phase * 5) * 6;
          py = lerp(py, destY, e);
        }

        if (p.x > prevX) {
          p.trail.push([px, py]);
          if (p.trail.length > (p.veto ? 8 : 4)) p.trail.shift();
        }

        if (p.veto && p.x > 0.36) {
          const col = p.x > 0.52 ? c.green : c.red;
          if (p.trail.length > 1) {
            ctx.strokeStyle = col;
            ctx.globalAlpha = 0.45;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(p.trail[0][0], p.trail[0][1]);
            for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i][0], p.trail[i][1]);
            ctx.stroke();
          }
          drawGlowNode(ctx, px, py, 2.6, col, 0.22, 2.8);
        } else {
          ctx.fillStyle = c.tx3;
          ctx.globalAlpha = p.x > 0.42 ? 0.28 : 0.52;
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      }
      ctx.globalAlpha = 1;

      // 3D Isometric rotating weight octahedron / crystal at (crystalX, crystalY)
      const rad = 24 + boost * 6;
      const rot = t * 0.65;
      const verts: [number, number][] = [
        [0, -rad],
        [Math.cos(rot) * rad, 0],
        [Math.sin(rot) * rad * 0.7, rad * 0.35],
        [-Math.cos(rot) * rad, 0],
        [-Math.sin(rot) * rad * 0.7, -rad * 0.35],
        [0, rad],
      ];
      ctx.save();
      ctx.translate(crystalX, crystalY);
      ctx.strokeStyle = c.green;
      ctx.fillStyle = c.green;
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.arc(0, 0, rad * 1.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.4;
      const edges = [
        [0, 1], [0, 2], [0, 3], [0, 4],
        [5, 1], [5, 2], [5, 3], [5, 4],
        [1, 2], [2, 3], [3, 4], [4, 1],
      ];
      ctx.beginPath();
      for (const [i, j] of edges) {
        ctx.moveTo(verts[i][0], verts[i][1]);
        ctx.lineTo(verts[j][0], verts[j][1]);
      }
      ctx.stroke();
      drawGlowNode(ctx, 0, 0, 3.5, c.green, 0.35, 3.2);
      ctx.restore();

      // Collector trough bar at bottom right
      ctx.strokeStyle = c.tx3;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(crystalX - 42, troughY + 8);
      ctx.lineTo(crystalX - 42, troughY + 14);
      ctx.lineTo(crystalX + 42, troughY + 14);
      ctx.lineTo(crystalX + 42, troughY + 8);
      ctx.stroke();
      ctx.globalAlpha = 1;

      drawChip(ctx, 'tokens', 22, beamY - 22, c.tx2, c.bg, c.ui, 'left');
      drawChip(ctx, 'weights', crystalX, crystalY + rad + 18, c.green, c.bg, c.green, 'center');
      drawChip(ctx, '$1 noise', crystalX, troughY - 14, c.tx2, c.bg, c.ui, 'center');
    },
  );
}

// Fig. 2 (bargain): The Exit Threshold Prism (1985 vs 2026).
export function initBargainFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  const toggle = h('div', 'fxv-pill');
  const bOld = h('button', 'fxv-pill__btn', '1985');
  const bNew = h('button', 'fxv-pill__btn is-active', '2026');
  bOld.type = 'button';
  bNew.type = 'button';
  toggle.append(bOld, bNew);
  stage.append(toggle);
  fig.prepend(stage);

  const eraSp = createSpring(1); // 0 = 1985, 1 = 2026

  const ctrl = mountCanvas(
    stage,
    (w) => (w < 540 ? 210 : 235),
    (ctx, W, H, c, t, dt) => {
      const anim = clamp(eraSp.step(dt, 150, 20), 0, 1);
      ctx.clearRect(0, 0, W, H);
      drawBlueprint(ctx, W, H, c);

      const deskX = W * 0.14;
      const doorX = W * 0.54;
      const vaultX = W * 0.34;
      const vaultY = H * 0.8;
      const outX = W * 0.86;
      const midY = H * 0.42;

      // Exit threshold gate with architectural ticks
      ctx.strokeStyle = c.tx2;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(doorX, 26);
      ctx.lineTo(doorX, H - 20);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Code stream (always loops back into employer vault)
      ctx.strokeStyle = c.tx3;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(deskX, midY - 8);
      ctx.bezierCurveTo(doorX - 42, midY - 8, doorX - 42, vaultY, vaultX, vaultY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Judgment stream: smoothly bends from exiting door (1985) into company vault (2026)
      const endX = lerp(outX, vaultX, anim);
      const endY = lerp(midY + 6, vaultY, anim);
      const cp1X = doorX - 6;
      const cp1Y = midY + 6;
      const cp2X = lerp(doorX + 64, doorX - 18, anim);
      const cp2Y = lerp(midY + 6, vaultY - 8, anim);

      const streamCol = anim > 0.5 ? c.red : c.green;

      // Soft glow behind judgment curve
      ctx.strokeStyle = streamCol;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(deskX, midY + 6);
      ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
      ctx.stroke();

      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(deskX, midY + 6);
      ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Animated luminous packets along the judgment curve
      for (let i = 0; i < 8; i++) {
        const u = (t * 0.34 + i / 8) % 1;
        const inv = 1 - u;
        const x =
          inv * inv * inv * deskX +
          3 * inv * inv * u * cp1X +
          3 * inv * u * u * cp2X +
          u * u * u * endX;
        const y =
          inv * inv * inv * (midY + 6) +
          3 * inv * inv * u * cp1Y +
          3 * inv * u * u * cp2Y +
          u * u * u * endY;
        drawGlowNode(ctx, x, y, 2.8, streamCol, 0.25, 2.6);
      }

      // Origin engineer workstation node
      drawGlowNode(ctx, deskX, midY, 5.5, c.tx, 0.15, 2.5);

      // Company vault node
      ctx.fillStyle = c.bg;
      ctx.strokeStyle = anim > 0.5 ? c.red : c.tx2;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(vaultX - 34, vaultY - 13, 68, 26, 4);
      ctx.fill();
      ctx.stroke();

      // Departing engineer halo outside the door
      ctx.save();
      ctx.translate(outX, midY + 6);
      ctx.strokeStyle = anim < 0.5 ? c.green : c.tx3;
      ctx.lineWidth = 1.8;
      if (anim > 0.5) ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (anim < 0.5) {
        drawGlowNode(ctx, outX, midY + 6, 4.5, c.green, 0.3 * (1 - anim), 3);
      }

      drawChip(ctx, 'exit', doorX, 18, c.tx2, c.bg, c.ui, 'center');
      drawChip(ctx, 'code', vaultX, vaultY, anim > 0.5 ? c.red : c.tx2, c.bg, anim > 0.5 ? c.red : c.ui, 'center');
      drawChip(ctx, 'judgment', (deskX + doorX) * 0.48, midY - 20, streamCol, c.bg, streamCol, 'center');
    },
  );

  const setEra = (target: 0 | 1) => {
    eraSp.target = target;
    bOld.classList.toggle('is-active', target === 0);
    bNew.classList.toggle('is-active', target === 1);
    ctrl.redraw();
  };
  bOld.addEventListener('click', () => setEra(0));
  bNew.addEventListener('click', () => setEra(1));
  stage.style.cursor = 'pointer';
  stage.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setEra(eraSp.target > 0.5 ? 0 : 1);
  });
}
