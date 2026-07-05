// 依存なしでPWAアイコンPNGを生成する（zlibのみ使用）。
import zlib from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public')
mkdirSync(outDir, { recursive: true })

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}
const BG = hex('#0f172a')
const CARD = hex('#1e293b')
const BORDER = hex('#3b82f6')
const LINE = hex('#94a3b8')
const CHECK = hex('#22c55e')

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function render(size) {
  const s = size / 512
  const buf = Buffer.alloc(size * size * 4)
  const put = (x, y, [r, g, b], a = 255) => {
    const i = (y * size + x) * 4
    buf[i] = r
    buf[i + 1] = g
    buf[i + 2] = b
    buf[i + 3] = a
  }
  const cardX0 = 132 * s, cardX1 = 380 * s, cardY0 = 120 * s, cardY1 = 420 * s
  const borderW = 12 * s
  // 2本の横線（テキスト表現）
  const lines = [
    [176 * s, 336 * s, 176 * s, 196 * s], // 左x, 右x, y0, y1 (使わない, 下で別処理)
  ]
  void lines
  const textRows = [
    { x0: 176 * s, x1: 336 * s, y0: 176 * s, y1: 196 * s },
    { x0: 176 * s, x1: 336 * s, y0: 224 * s, y1: 244 * s },
  ]
  const check = [
    [188 * s, 300 * s, 228 * s, 340 * s],
    [228 * s, 340 * s, 324 * s, 236 * s],
  ]
  const checkW = 26 * s

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let col = BG
      // card
      if (x >= cardX0 && x <= cardX1 && y >= cardY0 && y <= cardY1) {
        const nearBorder =
          x < cardX0 + borderW || x > cardX1 - borderW || y < cardY0 + borderW || y > cardY1 - borderW
        col = nearBorder ? BORDER : CARD
      }
      // text rows
      for (const r of textRows) {
        if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) col = LINE
      }
      // check mark
      for (const [ax, ay, bx, by] of check) {
        if (distToSeg(x, y, ax, ay, bx, by) <= checkW / 2) col = CHECK
      }
      put(x, y, col)
    }
  }
  return buf
}

function toPng(size, rgba) {
  // フィルタバイト付きのスキャンライン
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })

  const crcTable = (() => {
    const t = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })()
  const crc32 = (b) => {
    let c = 0xffffffff
    for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const t = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
    return Buffer.concat([len, t, data, crc])
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  const rgba = render(size)
  const png = toPng(size, rgba)
  writeFileSync(join(outDir, `pwa-${size}.png`), png)
  console.log(`wrote pwa-${size}.png (${png.length} bytes)`)
}
// apple-touch-icon（180は192を流用でよいが個別生成）
writeFileSync(join(outDir, 'apple-touch-icon.png'), toPng(180, render(180)))
console.log('wrote apple-touch-icon.png')
