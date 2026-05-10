/**
 * Default impl — used by web bundle, Node test env.
 * Native (iOS/Android) uses `sha256.native.ts` via Metro's platform suffix.
 *
 * Both impls return the same lowercase 64-char hex digest.
 */

export async function hashTile(data: Uint8Array): Promise<string> {
  const buffer = toArrayBuffer(data);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return toHex(new Uint8Array(digest));
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  // Slice to honor byteOffset/byteLength — the underlying buffer can be larger
  // than the view (e.g. when Uint8Array shares a buffer with other views).
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
