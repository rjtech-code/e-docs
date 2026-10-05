// RC4 stream cipher — symmetric, so the same function encrypts and decrypts.
export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const S = new Uint8Array(256)
  for (let i = 0; i < 256; i++) S[i] = i

  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff
    ;[S[i], S[j]] = [S[j], S[i]]
  }

  const out = new Uint8Array(data.length)
  let i = 0
  j = 0
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 0xff
    j = (j + S[i]) & 0xff
    ;[S[i], S[j]] = [S[j], S[i]]
    const k = S[(S[i] + S[j]) & 0xff]
    out[n] = data[n] ^ k
  }
  return out
}
