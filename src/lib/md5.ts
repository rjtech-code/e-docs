// Minimal, dependency-free MD5 implementation operating on raw bytes.
// Standard RFC 1321 algorithm — used only for the PDF standard security handler.

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const K = new Uint32Array(64)
for (let i = 0; i < 64; i++) {
  K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0
}

function leftRotate(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0
}

export function md5(input: Uint8Array): Uint8Array {
  const origLenBits = input.length * 8
  // Padding: append 0x80, then zeros until length % 64 === 56, then 8 bytes little-endian bit length.
  let paddedLen = input.length + 1
  while (paddedLen % 64 !== 56) paddedLen++
  paddedLen += 8

  const msg = new Uint8Array(paddedLen)
  msg.set(input)
  msg[input.length] = 0x80
  // 64-bit length, little-endian, low 32 bits only realistically used.
  const view = new DataView(msg.buffer)
  view.setUint32(paddedLen - 8, origLenBits >>> 0, true)
  view.setUint32(paddedLen - 4, Math.floor(origLenBits / 0x100000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const chunks = paddedLen / 64
  for (let chunk = 0; chunk < chunks; chunk++) {
    const M = new Uint32Array(16)
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(chunk * 64 + j * 4, true)
    }

    let A = a0
    let B = b0
    let C = c0
    let D = d0

    for (let i = 0; i < 64; i++) {
      let F = 0
      let g = 0
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i] + M[g]) >>> 0
      A = D
      D = C
      C = B
      B = (B + leftRotate(F, S[i])) >>> 0
    }

    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  const out = new Uint8Array(16)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, a0, true)
  outView.setUint32(4, b0, true)
  outView.setUint32(8, c0, true)
  outView.setUint32(12, d0, true)
  return out
}
