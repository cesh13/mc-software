// Generates assets/icon.ico (placeholder: blue rounded square with a white "M").
// No external assets or dependencies: PNG frames are encoded with node:zlib.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icon.ico')
const SIZES = [16, 32, 48, 64, 128, 256]
const SS = 3 // supersampling per axis

function crc32(buf) {
  let c, crc = ~0
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Distance from point to segment, in unit coordinates.
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// "M" as a polyline in unit coordinates.
const M = [[0.26, 0.74], [0.26, 0.28], [0.5, 0.58], [0.74, 0.28], [0.74, 0.74]]

function sample(u, v) {
  // rounded square mask
  const r = 0.2
  const cx = Math.max(r, Math.min(1 - r, u)), cy = Math.max(r, Math.min(1 - r, v))
  if (Math.hypot(u - cx, v - cy) > r) return [0, 0, 0, 0]
  for (let i = 0; i < M.length - 1; i++) {
    if (segDist(u, v, ...M[i], ...M[i + 1]) < 0.055) return [255, 255, 255, 255]
  }
  const g = 1 - v * 0.35 // light vertical gradient
  return [Math.round(47 * g), Math.round(111 * g), Math.round(237 * g), 255]
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [r, g, b, a] = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)
          acc[0] += r * a; acc[1] += g * a; acc[2] += b * a; acc[3] += a
        }
      }
      const n = SS * SS, o = (y * size + x) * 4
      buf[o + 3] = Math.round(acc[3] / n)
      if (acc[3] > 0) {
        buf[o] = Math.round(acc[0] / acc[3]); buf[o + 1] = Math.round(acc[1] / acc[3]); buf[o + 2] = Math.round(acc[2] / acc[3])
      }
    }
  }
  return buf
}

const frames = SIZES.map((s) => png(s, render(s)))
const head = Buffer.alloc(6)
head.writeUInt16LE(1, 2) // type: icon
head.writeUInt16LE(SIZES.length, 4)
let offset = 6 + 16 * SIZES.length
const dir = SIZES.map((s, i) => {
  const e = Buffer.alloc(16)
  e[0] = s === 256 ? 0 : s
  e[1] = s === 256 ? 0 : s
  e.writeUInt16LE(1, 4) // planes
  e.writeUInt16LE(32, 6) // bpp
  e.writeUInt32LE(frames[i].length, 8)
  e.writeUInt32LE(offset, 12)
  offset += frames[i].length
  return e
})
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, Buffer.concat([head, ...dir, ...frames]))
console.log(`Icon written: ${out}`)
