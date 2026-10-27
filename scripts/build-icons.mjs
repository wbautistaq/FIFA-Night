// Genera íconos PNG (sin dependencias): fondo césped oscuro + balón estilizado neón.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, maskable) {
  const px = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2, cy = size / 2;
  const R = size * (maskable ? 0.27 : 0.36);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    px[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      const t = (x + y) / (2 * size);
      let r = 4 + 8 * t, g = 16 + 40 * (1 - t), b = 10 + 30 * t; // césped oscuro
      const d = Math.hypot(x - cx, y - cy);
      const stripe = Math.abs(((y - cy) * 0.6 + (x - cx) * 0.8)) < size * 0.035;
      if (d < R) {
        // balón: blanco con parches neón
        r = 245; g = 250; b = 245;
        const pent = Math.hypot(x - cx, y - cy) < R * 0.28;
        const ring = [0, 1, 2, 3, 4].some((k) => {
          const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
          return Math.hypot(x - (cx + Math.cos(a) * R * 0.68), y - (cy + Math.sin(a) * R * 0.68)) < R * 0.2;
        });
        if (pent || ring) { r = 12; g = 30; b = 20; }
      } else if (d < R + size * 0.025) { r = 61; g = 255; b = 122; }
      else if (stripe && d > R * 1.3) { r = 61; g = 255; b = 122; }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(px)), chunk("IEND", Buffer.alloc(0))]);
}
mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192, false));
writeFileSync("public/icons/icon-512.png", png(512, false));
writeFileSync("public/icons/icon-maskable-512.png", png(512, true));
console.log("íconos generados");
