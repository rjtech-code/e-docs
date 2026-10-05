// PDF standard security handler (RC4, revisions 2 & 3) implemented from ISO 32000-1 §7.6.3.
// Supports adding a user/owner password (Protect PDF) and removing one when the password
// is known, or the file only restricts permissions with an empty user password (Unlock PDF).
import { PDFDict, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString, type PDFDocument } from 'pdf-lib'
import { md5 } from './md5'
import { rc4 } from './rc4'

const PAD = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
])

function toLatin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

function padPassword(password: string): Uint8Array {
  const bytes = toLatin1Bytes(password).slice(0, 32)
  const out = new Uint8Array(32)
  out.set(bytes)
  out.set(PAD.subarray(0, 32 - bytes.length), bytes.length)
  return out
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

function permissionsToBytes(p: number): Uint8Array {
  const buf = new Uint8Array(4)
  const view = new DataView(buf.buffer)
  view.setInt32(0, p, true)
  return buf
}

function xorBytes(bytes: Uint8Array, value: number): Uint8Array {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ value
  return out
}

export interface SecurityParams {
  revision: 2 | 3
  keyLengthBytes: 5 | 16
}

/** Algorithm 3: compute the /O entry. */
function computeOwnerValue(ownerPassword: string, userPassword: string, params: SecurityParams): Uint8Array {
  const ownerPad = padPassword(ownerPassword || userPassword)
  let digest = md5(ownerPad)
  if (params.revision >= 3) {
    for (let i = 0; i < 50; i++) digest = md5(digest)
  }
  const key = digest.slice(0, params.keyLengthBytes)

  let result = padPassword(userPassword)
  if (params.revision === 2) {
    result = rc4(key, result)
  } else {
    for (let i = 0; i < 20; i++) {
      const roundKey = xorBytes(key, i)
      result = rc4(roundKey, result)
    }
  }
  return result
}

/** Algorithm 2: compute the file encryption key. */
function computeFileKey(
  userPassword: string,
  ownerValue: Uint8Array,
  permissions: number,
  idBytes: Uint8Array,
  params: SecurityParams,
  encryptMetadata = true,
): Uint8Array {
  const parts = [padPassword(userPassword), ownerValue, permissionsToBytes(permissions), idBytes]
  if (params.revision >= 4 && !encryptMetadata) {
    parts.push(new Uint8Array([0xff, 0xff, 0xff, 0xff]))
  }
  let digest = md5(concatBytes(...parts))
  if (params.revision >= 3) {
    for (let i = 0; i < 50; i++) digest = md5(digest.slice(0, params.keyLengthBytes))
  }
  return digest.slice(0, params.keyLengthBytes)
}

/** Algorithm 4 (rev 2) / Algorithm 5 (rev 3+): compute the /U entry. */
function computeUserValue(fileKey: Uint8Array, idBytes: Uint8Array, params: SecurityParams): Uint8Array {
  if (params.revision === 2) {
    return rc4(fileKey, PAD)
  }
  let hash = md5(concatBytes(PAD, idBytes))
  for (let i = 0; i < 20; i++) {
    const roundKey = xorBytes(fileKey, i)
    hash = rc4(roundKey, hash)
  }
  const out = new Uint8Array(32)
  out.set(hash)
  return out
}

function objectKey(fileKey: Uint8Array, objNum: number, genNum: number, aes = false): Uint8Array {
  const extra = new Uint8Array(aes ? 9 : 5)
  extra[0] = objNum & 0xff
  extra[1] = (objNum >> 8) & 0xff
  extra[2] = (objNum >> 16) & 0xff
  extra[3] = genNum & 0xff
  extra[4] = (genNum >> 8) & 0xff
  if (aes) extra.set([0x73, 0x41, 0x6c, 0x54], 5) // "sAlT" for AES, unused here
  const digest = md5(concatBytes(fileKey, extra))
  const len = Math.min(fileKey.length + 5, 16)
  return digest.slice(0, len)
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n)
  crypto.getRandomValues(out)
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getOrCreateFileId(doc: PDFDocument): Uint8Array {
  const context = doc.context
  const existing = context.trailerInfo.ID as any
  if (existing?.constructor?.name === 'PDFArray' && existing.size?.() > 0) {
    const first = existing.get(0)
    if (first instanceof PDFHexString || first instanceof PDFString) return first.asBytes()
  }
  const id = randomBytes(16)
  const hex = PDFHexString.of(bytesToHex(id))
  context.trailerInfo.ID = context.obj([hex, hex])
  return id
}

/** Walk every indirect object (except `skipRef`) and transform each contained string / stream via `fn`. */
function transformObjects(
  doc: PDFDocument,
  fn: (bytes: Uint8Array, objNum: number, genNum: number) => Uint8Array,
  skipRef?: PDFRef,
) {
  const context = doc.context
  const entries = context.enumerateIndirectObjects()

  const transformValue = (value: unknown, objNum: number, genNum: number): unknown => {
    if (value instanceof PDFHexString || value instanceof PDFString) {
      const bytes = value.asBytes()
      if (bytes.length === 0) return value
      const transformed = fn(bytes, objNum, genNum)
      return PDFHexString.of(bytesToHex(transformed))
    }
    if (value instanceof PDFDict) {
      for (const [key, val] of value.entries()) {
        const next = transformValue(val, objNum, genNum)
        if (next !== val) value.set(key, next as any)
      }
      return value
    }
    if ((value as any)?.constructor?.name === 'PDFArray') {
      const arr = value as any
      for (let i = 0; i < arr.size(); i++) {
        const el = arr.get(i)
        const next = transformValue(el, objNum, genNum)
        if (next !== el) arr.set(i, next)
      }
      return arr
    }
    return value
  }

  for (const [ref, object] of entries) {
    if (!(ref instanceof PDFRef)) continue
    if (skipRef && ref.objectNumber === skipRef.objectNumber && ref.generationNumber === skipRef.generationNumber) continue
    if (object instanceof PDFRawStream) {
      // `contents` is typed readonly by pdf-lib, but is a plain mutable field at runtime.
      ;(object as any).contents = fn(object.contents, ref.objectNumber, ref.generationNumber)
      transformValue(object.dict, ref.objectNumber, ref.generationNumber)
    } else {
      transformValue(object, ref.objectNumber, ref.generationNumber)
    }
  }
}

export interface ProtectOptions {
  userPassword: string
  ownerPassword?: string
  /** 128-bit RC4 (revision 3) by default; pass 'rc4-40' for the older 40-bit variant. */
  strength?: 'rc4-40' | 'rc4-128'
  allowPrinting?: boolean
  allowCopying?: boolean
  allowModify?: boolean
  allowAnnotations?: boolean
}

export async function protectPdfDocument(doc: PDFDocument, opts: ProtectOptions): Promise<void> {
  const params: SecurityParams = opts.strength === 'rc4-40' ? { revision: 2, keyLengthBytes: 5 } : { revision: 3, keyLengthBytes: 16 }

  // Build the permission bitmask: start from "allow everything" (all bits 1 except the two
  // reserved bits 1 & 2), then clear individual bits for permissions the caller disallows.
  let permissions = -4 // 0xFFFFFFFC as a signed 32-bit int
  const clearBit = (n: number) => {
    permissions &= ~(1 << (n - 1))
  }
  if (opts.allowPrinting === false) clearBit(3)
  if (opts.allowModify === false) clearBit(4)
  if (opts.allowCopying === false) clearBit(5)
  if (opts.allowAnnotations === false) clearBit(6)

  const idBytes = getOrCreateFileId(doc)
  const ownerValue = computeOwnerValue(opts.ownerPassword ?? '', opts.userPassword, params)
  const fileKey = computeFileKey(opts.userPassword, ownerValue, permissions, idBytes, params)
  const userValue = computeUserValue(fileKey, idBytes, params)

  transformObjects(doc, (bytes, objNum, genNum) => rc4(objectKey(fileKey, objNum, genNum), bytes))

  const context = doc.context
  const encryptDict = context.obj({
    Filter: 'Standard',
    V: params.revision === 2 ? 1 : 2,
    R: params.revision,
    O: PDFHexString.of(bytesToHex(ownerValue)),
    U: PDFHexString.of(bytesToHex(userValue)),
    P: PDFNumber.of(permissions),
    Length: params.keyLengthBytes * 8,
  })
  const encryptRef = context.register(encryptDict)
  context.trailerInfo.Encrypt = encryptRef
}

export interface UnlockResult {
  success: boolean
  reason?: 'no-encryption' | 'wrong-password' | 'unsupported'
}

/** Attempts to decrypt & strip protection from an encrypted pdf-lib document, in place. */
export function unlockPdfDocument(doc: PDFDocument, password: string): UnlockResult {
  const context = doc.context
  const encryptRef = context.trailerInfo.Encrypt
  if (!encryptRef) return { success: true, reason: 'no-encryption' }

  const encryptDict = context.lookup(encryptRef, PDFDict)
  const filter = encryptDict.get(PDFName.of('Filter'))
  if (!(filter instanceof PDFName) || filter.asString() !== '/Standard') {
    return { success: false, reason: 'unsupported' }
  }
  const v = (encryptDict.get(PDFName.of('V')) as PDFNumber | undefined)?.asNumber() ?? 1
  if (v > 2) return { success: false, reason: 'unsupported' } // AES (V4/V5) not supported

  const r = (encryptDict.get(PDFName.of('R')) as PDFNumber | undefined)?.asNumber() ?? 2
  const params: SecurityParams = r >= 3 ? { revision: 3, keyLengthBytes: 16 } : { revision: 2, keyLengthBytes: 5 }
  const lengthBits = (encryptDict.get(PDFName.of('Length')) as PDFNumber | undefined)?.asNumber()
  if (lengthBits) params.keyLengthBytes = (lengthBits / 8) as 5 | 16

  const O = (encryptDict.get(PDFName.of('O')) as PDFHexString | PDFString).asBytes()
  const U = (encryptDict.get(PDFName.of('U')) as PDFHexString | PDFString).asBytes()
  const P = (encryptDict.get(PDFName.of('P')) as PDFNumber).asNumber()
  const idEntry = context.trailerInfo.ID
  let idBytes: Uint8Array = new Uint8Array(0)
  if (idEntry && (idEntry as any).constructor?.name === 'PDFArray') {
    const first = (idEntry as any).get(0)
    if (first instanceof PDFHexString || first instanceof PDFString) idBytes = first.asBytes()
  }

  const tryKey = (candidatePassword: string): Uint8Array | null => {
    const fileKey = computeFileKey(candidatePassword, O, P, idBytes, params)
    const u = computeUserValue(fileKey, idBytes, params)
    const check = params.revision === 2 ? u : u.slice(0, 16)
    const stored = params.revision === 2 ? U : U.slice(0, 16)
    const matches = check.length === stored.length && check.every((b, i) => b === stored[i])
    return matches ? fileKey : null
  }

  // Try the given password as the user password, then as empty (permission-only protection),
  // then as the owner password recovering the user key via Algorithm 3's inverse (rev 2/3 RC4).
  let fileKey = tryKey(password) ?? (password ? tryKey('') : null)
  if (!fileKey && password) {
    // Owner-password path: derive the RC4 key from the (possibly iterated) owner password hash,
    // decrypt O to recover the user password, then compute the real file key from it.
    let digest = md5(padPassword(password))
    if (params.revision >= 3) for (let i = 0; i < 50; i++) digest = md5(digest)
    const ownerKey = digest.slice(0, params.keyLengthBytes)
    let recovered: Uint8Array = O
    if (params.revision === 2) {
      recovered = rc4(ownerKey, O)
    } else {
      for (let i = 19; i >= 0; i--) {
        const roundKey = xorBytes(ownerKey, i)
        recovered = rc4(roundKey, recovered)
      }
    }
    const recoveredPassword = String.fromCharCode(...recovered).replace(/[\x00-\x1f].*$/s, '')
    fileKey = tryKey(recoveredPassword)
  }

  if (!fileKey) return { success: false, reason: 'wrong-password' }

  transformObjects(
    doc,
    (bytes, objNum, genNum) => rc4(objectKey(fileKey!, objNum, genNum), bytes),
    encryptRef instanceof PDFRef ? encryptRef : undefined,
  )
  context.trailerInfo.Encrypt = undefined
  return { success: true }
}
