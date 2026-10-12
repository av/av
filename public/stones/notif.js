/* macOS-style notification banners driven by an explicit clock (deterministic under ?manual) */
(function () {
const W = (a, b, glyph) => `<svg viewBox="0 0 64 64" width="100%" height="100%"><defs><linearGradient id="g${a.slice(1)}${b.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><path d="M32 0C8 0 0 8 0 32s8 32 32 32 32-8 32-32S56 0 32 0z" fill="url(#g${a.slice(1)}${b.slice(1)})"/>${glyph}</svg>`;
const ICON = {
  Mail: W('#3ec5ff','#1a6ff0','<rect x="13" y="19" width="38" height="27" rx="4" fill="#fff"/><path d="M14 21l18 14 18-14" stroke="#2a8cf5" stroke-width="3" fill="none" stroke-linejoin="round"/>'),
  Calendar: W('#ffffff','#f1f1f1','<rect x="0" y="0" width="64" height="0"/><text x="32" y="22" font-family="-apple-system,Inter,sans-serif" font-size="10" font-weight="600" fill="#f2433b" text-anchor="middle">MON</text><text x="32" y="50" font-family="-apple-system,Inter,sans-serif" font-size="28" font-weight="400" fill="#222" text-anchor="middle">12</text>'),
  Notes: W('#fff6c9','#fde27a','<rect x="0" y="0" width="64" height="16" fill="#f8c33a" opacity=".0"/><path d="M14 26h36M14 35h36M14 44h24" stroke="#c8b48a" stroke-width="2"/><path d="M0 18h64" stroke="#e8a92a" stroke-width="3"/>'),
  Reminders: W('#ffffff','#f2f2f2','<circle cx="18" cy="21" r="5" fill="#0a84ff"/><circle cx="18" cy="33" r="5" fill="#ff3b30"/><circle cx="18" cy="45" r="5" fill="#ff9f0a"/><path d="M28 21h22M28 33h22M28 45h22" stroke="#c7c7cc" stroke-width="2.4" stroke-linecap="round"/>'),
  Messages: W('#6af36a','#14c03a','<path d="M32 15c-11 0-20 7-20 16 0 5 3 9 7 12-.4 3-2 6-4 7 4 0 8-1 10-3 2 .5 4 .8 7 .8 11 0 20-7 20-16S43 15 32 15z" fill="#fff"/>'),
  Slack: W('#ffffff','#f4f4f4','<g stroke-width="7" stroke-linecap="round"><path d="M25 14v14" stroke="#36c5f0"/><path d="M50 25H36" stroke="#2eb67d"/><path d="M39 50V36" stroke="#ecb22e"/><path d="M14 39h14" stroke="#e01e5a"/><path d="M14 25h3" stroke="#36c5f0"/><path d="M39 14v3" stroke="#2eb67d"/><path d="M50 39h-3" stroke="#ecb22e"/><path d="M25 50v-3" stroke="#e01e5a"/></g>'),
  Finder: W('#7fd0ff','#1e7ef0','<path d="M32 0v64" stroke="#fff" stroke-width="0"/><path d="M34 0c-5 14-6 26-4 38h-5M34 64c-1-8-1-15 0-21" fill="none" stroke="#0d3d7a" stroke-width="2.5"/><path d="M14 22v6M46 22v6" stroke="#0d3d7a" stroke-width="3" stroke-linecap="round"/><path d="M17 44c9 7 21 7 30 0" fill="none" stroke="#0d3d7a" stroke-width="2.5" stroke-linecap="round"/>'),
  Safari: W('#ffffff','#e9eef5','<circle cx="32" cy="32" r="22" fill="url(#gs)" /><defs><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fc4ff"/><stop offset="1" stop-color="#1764e8"/></linearGradient></defs><path d="M42 22L35 35 22 42l7-13z" fill="#fff"/><path d="M42 22L35 35l-6-6z" fill="#ff3b30"/>'),
  Music: W('#ff6b81','#fa2d48','<path d="M27 44V22l17-4v22" stroke="#fff" stroke-width="3.5" fill="none" stroke-linejoin="round"/><ellipse cx="23" cy="44" rx="5.5" ry="4.5" fill="#fff"/><ellipse cx="40" cy="40" rx="5.5" ry="4.5" fill="#fff"/>'),
  Photos: W('#ffffff','#f6f6f6','<g transform="translate(32 32)" opacity=".85">'+['#fbbc05','#f68b1f','#ea4335','#c2185b','#7e57c2','#4285f4','#34a853','#a4c639'].map((c,i)=>`<ellipse cx="0" cy="-10" rx="7" ry="11" fill="${c}" transform="rotate(${i*45})" style="mix-blend-mode:multiply"/>`).join('')+'</g>'),
  Files: W('#5ab8ff','#1a7cf2','<path d="M13 22c0-2 1-4 4-4h9l4 4h17c2 0 4 2 4 4v18c0 2-2 4-4 4H17c-3 0-4-2-4-4z" fill="#fff"/>'),
  GitHub: W('#2c3138','#14171b','<path d="M32 13a19 19 0 00-6 37c1 0 1-.4 1-1v-4c-5 1-6-2-6-2-1-2-2-3-2-3-2-1 0-1 0-1 2 0 3 2 3 2 2 3 4 2 5 2 0-1 1-2 1-2-4-1-9-2-9-9 0-2 1-4 2-5 0-1-1-3 0-5 0 0 2 0 5 2a17 17 0 019 0c3-2 5-2 5-2 1 2 0 4 0 5 1 1 2 3 2 5 0 7-5 8-9 9 1 1 1 2 1 3v6c0 .6.4 1 1 1a19 19 0 00-6-37z" fill="#fff"/>'),
  Linear: W('#6d78f0','#4b54d4','<circle cx="32" cy="32" r="17" fill="none" stroke="#fff" stroke-width="0"/><path d="M16 36l12 12M15 30l19 19M17 24l23 23M21 19l24 24M27 16l21 21" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'),
  Figma: W('#2b2b2b','#1a1a1a','<rect x="23" y="12" width="9" height="13" rx="4.5" fill="#f24e1e"/><rect x="32" y="12" width="9" height="13" rx="4.5" fill="#ff7262"/><rect x="23" y="25" width="9" height="13" rx="4.5" fill="#a259ff"/><circle cx="36.5" cy="31.5" r="5" fill="#1abcfe"/><path d="M27.5 38h4.5v6.5a4.5 4.5 0 11-4.5-6.5z" fill="#0acf83"/>'),
  Notion: W('#ffffff','#f3f3f3','<rect x="16" y="14" width="32" height="36" rx="4" fill="#fff" stroke="#111" stroke-width="3"/><path d="M25 42V23l14 19V23" stroke="#111" stroke-width="3.2" fill="none" stroke-linejoin="round"/>'),
  Drive: W('#ffffff','#f3f3f3','<path d="M26 14h12l14 24H40z" fill="#fbbc04"/><path d="M26 14l-14 24 6 10 14-24z" fill="#0f9d58"/><path d="M18 48h28l6-10H24z" fill="#4285f4"/>'),
  Maps: W('#9fe39a','#5bc96a','<path d="M0 40L64 18" stroke="#fff" stroke-width="7"/><path d="M20 0v64" stroke="#f5d76e" stroke-width="5"/><circle cx="40" cy="26" r="8" fill="#ff3b30" stroke="#fff" stroke-width="2.5"/>'),
  Weather: W('#4aa7ff','#1d5fd6','<circle cx="26" cy="26" r="9" fill="#ffd33d"/><path d="M22 46h22a8 8 0 00-1-16 11 11 0 00-20 4 6 6 0 00-1 12z" fill="#fff"/>'),
  Wallet: W('#2a2a2c','#0e0e10','<rect x="12" y="18" width="40" height="10" rx="3" fill="#2aa1f5"/><rect x="12" y="24" width="40" height="10" rx="3" fill="#ffb800"/><rect x="12" y="30" width="40" height="10" rx="3" fill="#33c75a"/><rect x="10" y="34" width="44" height="16" rx="4" fill="#d9c9a8"/>'),
  Shortcuts: W('#ff5f9a','#5b4cf5','<path d="M20 22l12-7 12 7-12 7z M20 32l12-7 12 7-12 7z M20 42l12-7 12 7-12 7z" fill="#fff" opacity=".9"/>'),
};
const N = [
 ['Mail','Reply sent to Marta','Confirmed Thursday 14:00 and attached the Q3 deck.'],
 ['Calendar','Your Tuesday got lighter','Moved 3 meetings to Wednesday — you now have a 2-hour focus block.'],
 ['Notes','Meeting summary created','“Pricing sync” condensed to 6 bullets and 2 open questions.'],
 ['Reminders','Added: renew passport','Due Nov 3 — your current one expires before the Lisbon trip.'],
 ['Messages','Told Ola you’re running late','“Be there in 10, grab us the window table?”'],
 ['Slack','Posted standup in #design','Yesterday, today, blockers — written from your commits.'],
 ['Finder','Downloads tidied up','Sorted 214 files into Invoices, Screenshots and Installers.'],
 ['Safari','Reading list trimmed','Saved 4 long reads for the flight and closed 37 tabs.'],
 ['Music','Focus playlist ready','“Deep Work, Rainy” — 2 h 14 min, no lyrics, no ads.'],
 ['Photos','Album created: Hel Peninsula','Picked the 24 best shots from 312 and hid the duplicates.'],
 ['Files','Contract signed and filed','Lease_2027_signed.pdf is now in Documents › Home.'],
 ['GitHub','PR #482 approved and merged','CI was green; release notes updated automatically.'],
 ['Linear','Triaged 9 new issues','3 assigned to you, 2 marked as duplicates, 4 to backlog.'],
 ['Figma','Comments resolved','Answered 5 notes on Onboarding v3 and tagged Kuba on the last one.'],
 ['Notion','Weekly review drafted','Wins, misses and next week’s top 3 — ready for your edits.'],
 ['Drive','Shared with the board','“FY26 Budget” — view-only, link expires in 7 days.'],
 ['Maps','Leave at 8:12 for the airport','Traffic on S7 is building; I booked the car for 8:10.'],
 ['Weather','Rain moved your run','Swapped tomorrow’s 7:00 run with Thursday — it’ll be sunny.'],
 ['Wallet','Refund received','€42.90 from Zalando landed on your card ending 4417.'],
 ['Mail','Unsubscribed from 12 newsletters','Kept the 3 you actually open. Your inbox thanks you.'],
 ['Calendar','Dinner with Ania booked','Friday 19:30 at Rozbrat 20 — invite sent, she accepted.'],
 ['Messages','Wished Dad happy birthday','Sent at 8:00 sharp with the photo from the lake.'],
 ['Slack','Answered 4 questions for you','Linked the spec each time. Nobody had to wait for you.'],
 ['Notes','Grocery list merged','Combined yours and Kasia’s — 18 items, sorted by aisle.'],
 ['Reminders','Bills scheduled','Electricity and internet will pay on the 25th.'],
 ['GitHub','Flaky test quarantined','checkout.spec.ts failed 3 of 20 runs; issue #511 opened.'],
 ['Linear','Sprint planned','Cycle 14 is set: 31 points, under your team’s average.'],
 ['Figma','Exported 48 assets','Icons @1x/@2x/@3x pushed to the design-tokens repo.'],
 ['Drive','Duplicates cleaned up','Freed 6.2 GB — mostly old copies of video renders.'],
 ['Mail','Invoice paid','Settled #INV-2291 from Studio Mokotów and sent the receipt.'],
 ['Calendar','Found a time for 6 people','Wednesday 11:00 works for everyone across 3 time zones.'],
 ['Safari','Price drop on your headphones','Down 22% — added to cart, waiting for your OK.'],
 ['Music','Concert tickets on sale','Got 2 seats for Ólafur Arnalds, row F. Refundable till Friday.'],
 ['Photos','Receipts pulled from Camera Roll','17 receipts exported to Expenses › October.'],
 ['Files','Tax documents gathered','PIT-37, 3 bank statements and donations — all in one folder.'],
 ['Notion','Interview notes organised','Ranked 5 candidates by your rubric; Zofia leads.'],
 ['Maps','Saved 3 spots for Saturday','Bakery, a bookstore and a quiet park — all within 1 km.'],
 ['Weather','Bring a jacket','12° and windy after 17:00. I added it to your morning note.'],
 ['Wallet','Train ticket added','Warszawa → Gdańsk, Fri 07:15, car 6 seat 64.'],
 ['Shortcuts','Do Not Disturb until 16:00','You’re in deep work — only Marta and family can reach you.'],
 ['Slack','Thanked the support team','Shared the customer’s kind note in #wins with a 🎉.'],
 ['Mail','Follow-up scheduled','If Tomasz doesn’t reply by Wednesday, I’ll nudge him politely.'],
 ['Calendar','Declined a meeting for you','“Sync about the sync” — sent your notes instead.'],
 ['Messages','Shared your ETA','Mum can see you’ll be home at 18:40.'],
 ['GitHub','Dependabot PRs batched','Grouped 7 updates into one PR; all checks passing.'],
 ['Notes','Ideas captured','Turned your 3-minute voice memo into a tidy outline.'],
 ['Reminders','Plants watered? Not yet','Moved “water the monstera” to tonight — it’s been 9 days.'],
 ['Finder','Backup complete','Projects folder mirrored to the NAS. 0 errors.'],
 ['Drive','Slides translated','“Roadmap 2027” now has a German copy for the Berlin team.'],
 ['Linear','Customer bug closed','Replied to Acme with the fix version and a thank-you.'],
];
const css = `
@font-face{font-family:InterV;src:url(vendor/inter/inter-latin-400-normal.woff2) format('woff2');font-weight:400}
@font-face{font-family:InterV;src:url(vendor/inter/inter-latin-600-normal.woff2) format('woff2');font-weight:600}
@font-face{font-family:InterV;src:url(vendor/inter/inter-latin-700-normal.woff2) format('woff2');font-weight:700}
#nc{position:fixed;top:0;right:0;width:376px;height:100%;pointer-events:none;z-index:10}
.nb{position:absolute;top:0;right:16px;width:344px;box-sizing:border-box;padding:11px 14px 12px 12px;border-radius:20px;
 font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',InterV,sans-serif;-webkit-font-smoothing:antialiased;
 background:rgba(246,246,246,.72);backdrop-filter:blur(36px) saturate(180%);-webkit-backdrop-filter:blur(36px) saturate(180%);
 box-shadow:0 0 0 .5px rgba(0,0,0,.12),inset 0 0 0 .5px rgba(255,255,255,.55),0 12px 32px rgba(0,0,0,.16),0 1px 3px rgba(0,0,0,.08);
 display:flex;gap:10px;align-items:center;pointer-events:auto;cursor:default;user-select:none;will-change:transform,opacity;transform-origin:50% 0}
.nb .ic{flex:0 0 38px;height:38px;filter:drop-shadow(0 .5px 1px rgba(0,0,0,.18))}
.nb .tx{flex:1;min-width:0;line-height:16px;font-size:13px;letter-spacing:-.08px;color:rgba(0,0,0,.85)}
.nb .hd{display:flex;align-items:baseline;gap:8px}
.nb .tt{font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nb .tm{font-size:11.5px;color:rgba(0,0,0,.45);flex:none}
.nb .bd{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:rgba(0,0,0,.8)}
.nb .x{position:absolute;left:-7px;top:-7px;width:20px;height:20px;border-radius:50%;background:rgba(246,246,246,.9);
 backdrop-filter:blur(20px);box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.15);opacity:0;transition:opacity .15s;display:grid;place-items:center}
.nb:hover .x,.nb.hv .x{opacity:1}
`;
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
const nc = document.createElement('div'); nc.id = 'nc'; document.body.appendChild(nc);
let bag = [], live = [], now = 0, cool = 2.5, count = 0, lastShown = -99;
function draw() { if (!bag.length) { bag = N.map((_, i) => i); for (let i = bag.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [bag[i], bag[j]] = [bag[j], bag[i]]; } } return N[bag.pop()]; }
function show(n) {
  n = n || draw();
  const el = document.createElement('div'); el.className = 'nb';
  el.innerHTML = `<div class="ic">${ICON[n[0]]}</div><div class="tx"><div class="hd"><span class="tt"></span><span class="tm">now</span></div><div class="bd"></div></div>
  <div class="x"><svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 1l6 6M7 1L1 7" stroke="rgba(0,0,0,.6)" stroke-width="1.3" stroke-linecap="round"/></svg></div>`;
  el.querySelector('.tt').textContent = n[1]; el.querySelector('.bd').textContent = n[2];
  el.title = ''; nc.appendChild(el);
  const o = { el, born: now, x: 1.1, vx: 0, y: 16, vy: 0, out: false, hover: false, op: 1 };
  el.addEventListener('pointerenter', () => o.hover = true); el.addEventListener('pointerleave', () => o.hover = false);
  el.addEventListener('click', () => { o.out = true; o.click = true; });
  live.unshift(o); lastShown = now; count++;
  live.filter(q => !q.out).slice(3).forEach(q => q.out = true);
  return o;
}
function update(dt) {
  now += dt; let y = 16;
  for (const o of live) {
    if (!o.hover) o.age = (o.age || 0) + dt;
    if (o.age > 5.2) o.out = true;
    let tx = o.out ? 1.15 : 0;
    // spring: overshoot slightly (k=170, c=19 ≈ macOS banner spring)
    o.vx += ((tx - o.x) * 170 - o.vx * 19) * dt; o.x += o.vx * dt;
    if (!o.out) { const h = o.el.offsetHeight || 64; o.vy += ((y - o.y) * 220 - o.vy * 26) * dt; o.y += o.vy * dt; y += h + 8; }
    o.el.style.transform = `translate3d(${(o.x * 100).toFixed(2)}%,${o.y.toFixed(1)}px,0)`;
    o.el.style.zIndex = 100 - live.indexOf(o);
  }
  live = live.filter(o => { if (o.out && o.x > 1.08) { o.el.remove(); return false; } return true; });
}
// interaction hook: kind = 'press' | 'drag' | 'hover'
function poke(kind) {
  if (now - lastShown < cool) return;
  const p = count === 0 ? (kind === 'hover' ? .25 : .7) : (kind === 'press' ? .45 : kind === 'drag' ? .35 : .12);
  if (Math.random() < p || (count === 0 && now > 4)) { show(); cool = 4 + Math.random() * 5; }
}
window.Notif = { show, update, poke, N };
})();
