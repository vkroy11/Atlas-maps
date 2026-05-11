/**
 * Native impl — used on iOS/Android via Metro's platform suffix.
 *
 * `expo-crypto`'s `digest` is typed `BufferSource` but the Android Kotlin
 * bridge can only auto-convert TypedArrays, not raw `ArrayBuffer`s. So we
 * pass the `Uint8Array` directly.
 */
import * as Crypto from 'expo-crypto';

export async function hashTile(data: Uint8Array): Promise<string> {
  // Cast through `unknown` — TS lib types parameterize Uint8Array on its
  // backing buffer (`Uint8Array<ArrayBufferLike>`), which doesn't unify with
  // `BufferSource`'s stricter `ArrayBuffer`. The Android Kotlin bridge still
  // requires a TypedArray view (not a bare ArrayBuffer), so we pass `data`
  // through as-is at runtime.
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    data as unknown as BufferSource,
  );
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
