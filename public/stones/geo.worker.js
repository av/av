/* Stone meshes, built off the main thread.
   Reproduces three's IcosahedronGeometry(1, 40) + the lump/taper displacement + flat normals bit for bit,
   but runs the noise once per lattice vertex instead of once per triangle corner (each is shared by ~6). */

/* ---------------- JS noise for geometry ---------------- */
function hash(x, y, z) { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx*fx*(3-2*fx); fy = fy*fy*(3-2*fy); fz = fz*fz*(3-2*fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash(ix,iy,iz),hash(ix+1,iy,iz),fx), L(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx), fy),
           L(L(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx), L(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx), fy), fz);
}
const fbm = (x, y, z) => vnoise(x,y,z)*.55 + vnoise(x*2.1,y*2.1,z*2.1)*.3 + vnoise(x*4.3,y*4.3,z*4.3)*.15;

/* ---------------- unit icosphere: lattice points + the triangles that index them ---------------- */
const DETAIL = 40;
let sphere = null;
function icosphere() {
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [-1,t,0, 1,t,0, -1,-t,0, 1,-t,0, 0,-1,t, 0,1,t, 0,-1,-t, 0,1,-t, t,0,-1, t,0,1, -t,0,-1, -t,0,1];
  const F = [0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11, 1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8,
             3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9, 4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1];
  const cols = DETAIL + 1;
  const pts = new Float32Array(20 * (cols + 1) * (cols + 2) / 2 * 3), tri = new Uint32Array(20 * cols * cols * 3);
  let np = 0, nt = 0;
  for (let f = 0; f < F.length; f += 3) {
    const a = F[f] * 3, b = F[f+1] * 3, c = F[f+2] * 3, row = [];
    for (let i = 0; i <= cols; i++) {
      row[i] = np;
      const ti = i / cols, rows = cols - i;
      const ax = V[a] + (V[c] - V[a]) * ti, ay = V[a+1] + (V[c+1] - V[a+1]) * ti, az = V[a+2] + (V[c+2] - V[a+2]) * ti;
      const bx = V[b] + (V[c] - V[b]) * ti, by = V[b+1] + (V[c+1] - V[b+1]) * ti, bz = V[b+2] + (V[c+2] - V[b+2]) * ti;
      for (let j = 0; j <= rows; j++, np++) {
        let x = ax, y = ay, z = az;
        if (rows > 0) { const tj = j / rows; x += (bx - x) * tj; y += (by - y) * tj; z += (bz - z) * tj; }
        const inv = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
        pts[np*3] = x * inv; pts[np*3+1] = y * inv; pts[np*3+2] = z * inv;
      }
    }
    for (let i = 0; i < cols; i++) for (let j = 0; j < 2 * (cols - i) - 1; j++) {
      const k = j >> 1;
      if (j % 2 === 0) { tri[nt++] = row[i] + k + 1; tri[nt++] = row[i+1] + k; tri[nt++] = row[i] + k; }
      else { tri[nt++] = row[i] + k + 1; tri[nt++] = row[i+1] + k + 1; tri[nt++] = row[i+1] + k; }
    }
  }
  return { pts, tri };
}

function stone(o) {
  const { pts, tri } = sphere || (sphere = icosphere());
  const s = o.seed * 13.7, d = new Float32Array(pts.length);
  let minY = Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    let x = pts[i], y = pts[i+1], z = pts[i+2];
    // capsule-ish elongation + lumps
    const n = fbm(x * 1.1 + s, y * 1.1, z * 1.1 - s) - .5;
    const fine = vnoise(x * 5 + s, y * 5, z * 5) - .5;
    const k = 1 + n * o.lump + fine * .008;
    x *= k; y *= k; z *= k;
    // tapers (pear / wedge shapes)
    x *= 1 + o.taper * z;
    x *= o.size[0]; y *= o.size[1]; z *= o.size[2];
    // flatten underside softly (sits on paper)
    if (y < 0) y *= 0.62;
    d[i] = x; d[i+1] = y; d[i+2] = z;
    if (d[i+1] < minY) minY = d[i+1];
  }
  // rest it on y = 0 (the same arithmetic as BufferGeometry.translate)
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < d.length; i += 3) {
    const x = d[i], y = d[i+1], z = d[i+2], w = 1 / (0 * x + 0 * y + 0 * z + 1);
    d[i] = (1 * x + 0 * y + 0 * z + 0) * w; d[i+1] = (0 * x + 1 * y + 0 * z + -minY) * w; d[i+2] = (0 * x + 0 * y + 1 * z + 0) * w;
    for (let a = 0; a < 3; a++) { if (d[i+a] < min[a]) min[a] = d[i+a]; if (d[i+a] > max[a]) max[a] = d[i+a]; }
  }
  // unshared triangle corners with flat normals
  const position = new Float32Array(tri.length * 3), normal = new Float32Array(tri.length * 3), nf = new Float32Array(3);
  const center = [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5];
  let r2 = 0;
  for (let t = 0; t < tri.length; t += 3) {
    const A = tri[t] * 3, B = tri[t+1] * 3, C = tri[t+2] * 3;
    const cx = d[C] - d[B], cy = d[C+1] - d[B+1], cz = d[C+2] - d[B+2], ax = d[A] - d[B], ay = d[A+1] - d[B+1], az = d[A+2] - d[B+2];
    nf[0] = cy * az - cz * ay; nf[1] = cz * ax - cx * az; nf[2] = cx * ay - cy * ax;
    const inv = 1 / (Math.sqrt(nf[0] * nf[0] + nf[1] * nf[1] + nf[2] * nf[2]) || 1);
    const nx = nf[0] * inv, ny = nf[1] * inv, nz = nf[2] * inv;
    for (let c = 0; c < 3; c++) {
      const q = tri[t+c] * 3, p = (t + c) * 3;
      position[p] = d[q]; position[p+1] = d[q+1]; position[p+2] = d[q+2];
      normal[p] = nx; normal[p+1] = ny; normal[p+2] = nz;
      const dx = center[0] - d[q], dy = center[1] - d[q+1], dz = center[2] - d[q+2];
      r2 = Math.max(r2, dx * dx + dy * dy + dz * dz);
    }
  }
  return { position, normal, min, max, center, radius: Math.sqrt(r2) };
}

// the ring keeps three's TorusGeometry; only its lumps are computed here, in place
function ring(o, p) {
  const s = o.seed * 13.7;
  for (let i = 0; i < p.length; i += 3) {
    let x = p[i], y = p[i+1], z = p[i+2];
    const n = fbm(x * 1.4 + s, y * 1.4, z * 1.4) - .5;
    x *= 1 + n * .35; z *= 1 + n * .25; y *= 0.85 + n * .4;
    x *= o.size[0]; y *= o.size[1]; z *= o.size[2];
    p[i] = x; p[i+1] = y; p[i+2] = z;
  }
  return { position: p };
}

onmessage = ({ data: { id, o, position } }) => {
  const g = o.ring ? ring(o, position) : stone(o);
  postMessage({ id, ...g }, [g.position.buffer, ...(g.normal ? [g.normal.buffer] : [])]);
};
