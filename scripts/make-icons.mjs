// Generates placeholder PWA icons: indigo square with a white "SK".
// Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const GLYPHS = {
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
}
const BG = [0x4f, 0x5b, 0xd5]
const FG = [255, 255, 255]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function png(size) {
  const cell = Math.floor(size / 16) // glyph cell size; text is 11 cells wide, 7 tall
  const textW = (5 + 1 + 5) * cell
  const textH = 7 * cell
  const x0 = Math.floor((size - textW) / 2)
  const y0 = Math.floor((size - textH) / 2)
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let x = 0; x < size; x++) {
      let on = false
      const cy = Math.floor((y - y0) / cell)
      const cx = Math.floor((x - x0) / cell)
      if (y >= y0 && x >= x0 && cy < 7 && cx < 11) {
        if (cx < 5) on = GLYPHS.S[cy][cx] === '1'
        else if (cx > 5) on = GLYPHS.K[cy][cx - 6] === '1'
      }
      row.set(on ? FG : BG, 1 + x * 3)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/${name}`, png(size))
}
