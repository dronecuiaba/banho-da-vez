// Gera icons/icon-192.png e icons/icon-512.png sem dependências externas.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function buildPNG(width, height, pixelFn) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function makeIcon(size) {
  const cx = size / 2, cy = size / 2;
  const bgTop = [58, 160, 255];
  const bgBottom = [111, 195, 255];
  const radius = size * 0.30;

  return buildPNG(size, size, (x, y) => {
    const t = y / size;
    let r = lerp(bgTop[0], bgBottom[0], t);
    let g = lerp(bgTop[1], bgBottom[1], t);
    let b = lerp(bgTop[2], bgBottom[2], t);

    // rounded square mask (squircle-ish corners)
    const corner = size * 0.18;
    const inCorner = (px, py) => {
      const cxr = [ [corner, corner], [size - corner, corner], [corner, size - corner], [size - corner, size - corner] ];
      for (const [ox, oy] of cxr) {
        const nearX = (px < corner && ox === corner) || (px > size - corner && ox === size - corner);
        const nearY = (py < corner && oy === corner) || (py > size - corner && oy === size - corner);
        if (nearX && nearY) {
          const dx = px - ox, dy = py - oy;
          if (dx * dx + dy * dy > corner * corner) return true;
        }
      }
      return false;
    };
    if (inCorner(x, y)) return [255, 255, 255, 0];

    // water drop shape in center (white, semi-transparent circle + small triangle top)
    const dx = x - cx;
    const dy = y - (cy + size * 0.04);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // drop: circle bottom + tapered top
    const dropTopY = cy - radius * 1.35;
    let isDrop = false;
    if (dist < radius) {
      isDrop = true;
    } else if (y > dropTopY && y < cy) {
      const yt = (cy - y) / (cy - dropTopY); // 0 at cy, 1 at top
      const widthAtY = radius * (1 - yt) * 1.05;
      if (Math.abs(dx) < widthAtY * 0.9 && yt > 0.05) isDrop = true;
    }

    if (isDrop) {
      r = 255; g = 255; b = 255;
      // small inner highlight bubble
      const hdx = x - (cx - radius * 0.35);
      const hdy = y - (cy - radius * 0.15);
      const hdist = Math.sqrt(hdx * hdx + hdy * hdy);
      if (hdist < radius * 0.22) {
        r = 220; g = 240; b = 255;
      }
      return [Math.round(r), Math.round(g), Math.round(b), 255];
    }

    return [Math.round(r), Math.round(g), Math.round(b), 255];
  });
}

const outDir = path.join(__dirname, "icons");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

for (const size of [192, 512]) {
  const png = makeIcon(size);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`icons/icon-${size}.png gerado (${png.length} bytes)`);
}
