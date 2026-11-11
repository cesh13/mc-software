// Text decoding for legacy DBF tables. Spanish text only: cp1252 (marked 0x03)
// or cp850 (DOS-era tables, usually unmarked).

export type Encoding = 'cp1252' | 'cp850'

// cp850 bytes 0x80..0xFF → Unicode, 16 characters per row.
const CP850_HIGH =
  'ÇüéâäàåçêëèïîìÄÅ' +
  'ÉæÆôöòûùÿÖÜø£Ø×ƒ' +
  'áíóúñÑªº¿®¬½¼¡«»' +
  '░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐' +
  '└┴┬├─┼ãÃ╚╔╩╦╠═╬¤' +
  'ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀' +
  'ÓßÔÒõÕµþÞÚÛÙýÝ¯´' +
  '­±‗¾¶§÷¸°¨·¹³²■ '

if (CP850_HIGH.length !== 128) throw new Error('cp850 table must have 128 entries')

// Spanish letters (á é í ó ú ñ Ñ ü Á É Í Ó Ú ¿ ¡) in each code page.
const SPANISH_1252 = new Set([0xe1, 0xe9, 0xed, 0xf3, 0xfa, 0xf1, 0xd1, 0xfc, 0xc1, 0xc9, 0xcd, 0xd3, 0xda, 0xbf, 0xa1])
const SPANISH_850 = new Set([0xa0, 0x82, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0x81, 0xb5, 0x90, 0xd6, 0xe0, 0xe9, 0xa8, 0xad])

const isAsciiLetter = (b: number | undefined) =>
  b !== undefined && ((b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a))

let win1252: TextDecoder | null | undefined

function decode1252(buf: Uint8Array): string {
  if (win1252 === undefined) {
    try {
      win1252 = new TextDecoder('windows-1252')
    } catch {
      win1252 = null
    }
  }
  return win1252 ? win1252.decode(buf) : Buffer.from(buf).toString('latin1')
}

function decode850(buf: Uint8Array): string {
  let out = ''
  for (const b of buf) out += b < 0x80 ? String.fromCharCode(b) : CP850_HIGH[b - 0x80]
  return out
}

export function decodeText(buf: Uint8Array, encoding: Encoding): string {
  return encoding === 'cp850' ? decode850(buf) : decode1252(buf)
}

// Language-driver byte 0x03 = cp1252. Anything else is unmarked or unreliable
// (observed: 0x00, 0xC8, 0xC9 on tables holding Spanish text), so the content
// decides.
export function isMarkedCp1252(languageDriver: number): boolean {
  return languageDriver === 0x03
}

// Counts accented-letter bytes that sit next to an ASCII letter ("cañon"),
// which is what real Spanish words look like in each code page.
export function guessEncoding(samples: Iterable<Uint8Array>): Encoding {
  let s1252 = 0
  let s850 = 0
  for (const buf of samples) {
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i]!
      if (b < 0x80) continue
      if (!isAsciiLetter(buf[i - 1]) && !isAsciiLetter(buf[i + 1])) continue
      if (SPANISH_1252.has(b)) s1252++
      if (SPANISH_850.has(b)) s850++
    }
  }
  return s850 > s1252 ? 'cp850' : 'cp1252'
}
