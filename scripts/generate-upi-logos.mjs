import { deflateSync } from "zlib"
import { mkdirSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const SIZE = 128
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "assets", "upi")

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePng(getPixel) {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
  for (let y = 0; y < SIZE; y++) {
    const row = y * (SIZE * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a] = getPixel(x, y)
      const i = row + 1 + x * 4
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function inRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || py < y || px >= x + w || py >= y + h) return false
  const lx = px - x
  const ly = py - y
  if (lx >= r && lx < w - r) return true
  if (ly >= r && ly < h - r) return true
  const cx = lx < r ? r : w - r
  const cy = ly < r ? r : h - r
  return (lx - cx) ** 2 + (ly - cy) ** 2 <= r * r
}

const WHITE = [255, 255, 255, 255]

function gpayPixel(x, y) {
  const cx = (SIZE - 1) / 2
  const cy = (SIZE - 1) / 2
  const outer = SIZE * 0.46
  const inner = SIZE * 0.28
  const dx = x - cx
  const dy = y - cy
  const dist = Math.hypot(dx, dy)
  if (dist > outer + 0.6) return WHITE
  const blue = [66, 133, 244, 255]
  if (dist <= inner) {
    const bar = Math.abs(dy) <= SIZE * 0.07 && dx >= -SIZE * 0.02
    return bar ? blue : [255, 255, 255, 255]
  }
  const ang = Math.atan2(dy, dx)
  if (ang >= -Math.PI * 0.25 && ang < Math.PI * 0.35) return blue
  if (ang >= Math.PI * 0.35 && ang < Math.PI * 0.9) return [52, 168, 83, 255]
  if (ang >= Math.PI * 0.9 || ang < -Math.PI * 0.7) return [251, 188, 5, 255]
  return [234, 67, 53, 255]
}

function phonepePixel(x, y) {
  const pad = SIZE * 0.06
  if (!inRoundedRect(x, y, pad, pad, SIZE - pad * 2, SIZE - pad * 2, SIZE * 0.18)) {
    return WHITE
  }
  const purple = [95, 37, 159, 255]
  const white = [255, 255, 255, 255]
  const gold = [245, 197, 24, 255]
  const stemX0 = SIZE * 0.32
  const stemX1 = SIZE * 0.44
  const stemY0 = SIZE * 0.26
  const stemY1 = SIZE * 0.74
  const bowl = inRoundedRect(x, y, SIZE * 0.32, SIZE * 0.26, SIZE * 0.34, SIZE * 0.34, SIZE * 0.08)
  const bowlInner = inRoundedRect(x, y, SIZE * 0.44, SIZE * 0.36, SIZE * 0.18, SIZE * 0.15, SIZE * 0.05)
  const stem = x >= stemX0 && x <= stemX1 && y >= stemY0 && y <= stemY1
  const dx = x - SIZE * 0.7
  const dy = y - SIZE * 0.7
  const dot = dx * dx + dy * dy <= (SIZE * 0.07) ** 2
  if (dot) return gold
  if ((bowl && !bowlInner) || stem) return white
  return purple
}

function paytmPixel(x, y) {
  const pad = SIZE * 0.06
  if (!inRoundedRect(x, y, pad, pad, SIZE - pad * 2, SIZE - pad * 2, SIZE * 0.18)) {
    return WHITE
  }
  const cyan = [0, 186, 242, 255]
  const white = [255, 255, 255, 255]
  const navy = [0, 46, 110, 255]
  const pStem = x >= SIZE * 0.28 && x <= SIZE * 0.38 && y >= SIZE * 0.28 && y <= SIZE * 0.72
  const pBowl = inRoundedRect(x, y, SIZE * 0.28, SIZE * 0.28, SIZE * 0.28, SIZE * 0.28, SIZE * 0.08)
  const pInner = inRoundedRect(x, y, SIZE * 0.38, SIZE * 0.35, SIZE * 0.14, SIZE * 0.14, SIZE * 0.05)
  const aLeft = inRoundedRect(x, y, SIZE * 0.58, SIZE * 0.42, SIZE * 0.08, SIZE * 0.3, SIZE * 0.03)
  const aRight = inRoundedRect(x, y, SIZE * 0.72, SIZE * 0.42, SIZE * 0.08, SIZE * 0.3, SIZE * 0.03)
  const aTop = inRoundedRect(x, y, SIZE * 0.58, SIZE * 0.42, SIZE * 0.22, SIZE * 0.1, SIZE * 0.04)
  const aBar = x >= SIZE * 0.6 && x <= SIZE * 0.78 && y >= SIZE * 0.54 && y <= SIZE * 0.6
  if ((pBowl && !pInner) || pStem) return white
  if (aLeft || aRight || aTop || aBar) return navy
  return cyan
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, "gpay.png"), encodePng(gpayPixel))
writeFileSync(join(OUT_DIR, "phonepe.png"), encodePng(phonepePixel))
writeFileSync(join(OUT_DIR, "paytm.png"), encodePng(paytmPixel))
console.log("Wrote UPI PNG logos to", OUT_DIR)
