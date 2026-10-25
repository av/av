import { createRandom, h, mountCanvas } from './util';

// Fig. 1 (arbitrage): Magnetic particle separator.
// 96% grey noise tokens fall into the $1 trough; 4% red/green veto sparks
// deflect upward into the weight crystal.
export function initArbitrageFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxv');
  fig.prepend(stage);

  const r = createRandom(101);
  type P = { x: number; y: number; vx: number; vy: number; veto: boolean; phase: number };
  const pts: P[] = Array.from({ length: 180 }, () => ({
    x: r(),
    y: 0.42 + (r() - 0.5) * 0.08,
    vx: 0.18 + r() * 0.14,
    vy: 0,
    veto: r() < 0.08,
    phase: r() * Math.PI * 2,
  }));

  let boost = 0;
  stage.style.cursor = 'pointer';
  stage.addEventListener('click', () => {
    boost = 1;
  });

  mountCanvas(
    stage,
    (w) => (w < 540 ? 200 : 230),
    (ctx, W, H, c, t) => {
      ctx.clearRect(0, 0, W, H);
      boost *= 0.95;

      const splitX = W * 0.44;
      const crystalX = W * 0.84;
      const crystalY = H * 0.27;
      const troughY = H * 0.82;

      // Magnetic separator gate
      ctx.strokeStyle = c.ui;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(splitX, 18);
      ctx.lineTo(splitX, H - 18);
      ctx.stroke();
      ctx.setLineDash([]);

      // Guide trajectories
      ctx.strokeStyle = c.tx3;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, H * 0.44);
      ctx.bezierCurveTo(splitX, H * 0.44, splitX + 40, troughY, crystalX, troughY);
      ctx.stroke();

      ctx.strokeStyle = c.green;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(splitX, H * 0.44);
      ctx.bezierCurveTo(splitX + 50, H * 0.44, crystalX - 60, crystalY, crystalX, crystalY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Update & draw particles
      for (const p of pts) {
        p.x += p.vx * 0.009;
        if (p.x > 0.92) {
          p.x = 0.03;
          p.y = 0.44 + (r() - 0.5) * 0.07;
          p.veto = r() < (boost > 0.15 ? 0.38 : 0.09);
        }
        const px = p.x * W;
        let py = p.y * H;
        if (p.x > 0.44) {
          const u = Math.min(1, (p.x - 0.44) / 0.4);
          const ease = u * u * (3 - 2 * u);
          const targetY = p.veto
            ? crystalY + Math.sin(t * 3 + p.phase) * 9
            : troughY + Math.cos(p.phase * 7) * 8;
          py = py + (targetY - py) * ease;
        }

        if (p.veto && p.x > 0.36) {
          ctx.fillStyle = p.x > 0.55 ? c.green : c.red;
          ctx.globalAlpha = 0.95;
          ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
        } else {
          ctx.fillStyle = c.tx3;
          ctx.globalAlpha = p.x > 0.44 ? 0.35 : 0.55;
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      }
      ctx.globalAlpha = 1;

      // Rotating weight lattice on the top-right
      const rad = 22 + boost * 8;
      ctx.save();
      ctx.translate(crystalX, crystalY);
      ctx.rotate(t * 0.35);
      ctx.strokeStyle = c.green;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-rad / 1.4, -rad / 1.4, rad * 1.4, rad * 1.4);
      ctx.rotate(Math.PI / 4);
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(-rad / 1.4, -rad / 1.4, rad * 1.4, rad * 1.4);
      ctx.restore();
      ctx.globalAlpha = 1;

      // Minimalist labels (4 words total on canvas)
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.fillStyle = c.tx2;
      ctx.textAlign = 'left';
      ctx.fillText('tokens', 24, H * 0.44 - 14);

      ctx.textAlign = 'center';
      ctx.fillStyle = c.green;
      ctx.fillText('weights', crystalX, crystalY + rad + 18);

      ctx.fillStyle = c.tx3;
      ctx.fillText('$1 noise', crystalX, troughY + 22);
    },
  );
}

// Fig. 2 (bargain): The Exit Door Prism (1985 vs 2026).
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

  let mode: '1985' | '2026' = '2026';
  let anim = 1; // 0 = 1985, 1 = 2026

  const ctrl = mountCanvas(
    stage,
    (w) => (w < 540 ? 200 : 225),
    (ctx, W, H, c, t) => {
      const target = mode === '2026' ? 1 : 0;
      anim += (target - anim) * 0.12;
      ctx.clearRect(0, 0, W, H);

      const deskX = W * 0.14;
      const doorX = W * 0.54;
      const vaultX = W * 0.34;
      const vaultY = H * 0.82;
      const outX = W * 0.86;
      const midY = H * 0.44;

      // Exit threshold line
      ctx.strokeStyle = c.tx3;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(doorX, 20);
      ctx.lineTo(doorX, H - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      // Code stream (always loops back into employer vault)
      ctx.strokeStyle = c.tx3;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(deskX, midY - 10);
      ctx.bezierCurveTo(doorX - 40, midY - 10, doorX - 40, vaultY, vaultX, vaultY);
      ctx.stroke();

      // Judgment / scar-tissue stream: morphs from exiting door (1985) to captured in vault (2026)
      const endX = outX * (1 - anim) + vaultX * anim;
      const endY = (midY + 6) * (1 - anim) + vaultY * anim;
      const cp2X = (doorX + 60) * (1 - anim) + (doorX - 10) * anim;
      const cp2Y = (midY + 6) * (1 - anim) + vaultY * anim;

      ctx.strokeStyle = anim > 0.5 ? c.red : c.green;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(deskX, midY + 6);
      ctx.bezierCurveTo(doorX - 10, midY + 6, cp2X, cp2Y, endX, endY);
      ctx.stroke();

      // Animated pulse dots along judgment stream
      for (let i = 0; i < 7; i++) {
        const u = ((t * 0.35 + i / 7) % 1);
        const inv = 1 - u;
        const x =
          inv * inv * inv * deskX +
          3 * inv * inv * u * (doorX - 10) +
          3 * inv * u * u * cp2X +
          u * u * u * endX;
        const y =
          inv * inv * inv * (midY + 6) +
          3 * inv * inv * u * (midY + 6) +
          3 * inv * u * u * cp2Y +
          u * u * u * endY;
        ctx.fillStyle = anim > 0.5 && u > 0.45 ? c.red : c.green;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Desk node
      ctx.fillStyle = c.tx;
      ctx.fillRect(deskX - 6, midY - 14, 12, 26);

      // Vault box inside company
      ctx.strokeStyle = anim > 0.5 ? c.red : c.tx3;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(vaultX - 28, vaultY - 14, 56, 28);

      // Departing engineer node on right of exit door
      ctx.strokeStyle = anim < 0.5 ? c.green : c.tx3;
      ctx.fillStyle = anim < 0.5 ? c.green : 'transparent';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(outX, midY + 6, 12, 0, Math.PI * 2);
      if (anim < 0.5) {
        ctx.globalAlpha = 0.25 * (1 - anim);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.stroke();

      // Minimal labels (5 words total on stage including toggle)
      ctx.font = `500 10px 'Geist Pixel', monospace`;
      ctx.fillStyle = c.tx3;
      ctx.textAlign = 'center';
      ctx.fillText('exit', doorX, 14);
      ctx.fillText('code', vaultX, vaultY + 4);

      ctx.fillStyle = anim > 0.5 ? c.red : c.green;
      ctx.fillText('judgment', (deskX + doorX) * 0.5, midY - 18);
    },
  );

  const setMode = (m: '1985' | '2026') => {
    mode = m;
    bOld.classList.toggle('is-active', m === '1985');
    bNew.classList.toggle('is-active', m === '2026');
    ctrl.redraw();
  };
  bOld.addEventListener('click', () => setMode('1985'));
  bNew.addEventListener('click', () => setMode('2026'));
}
