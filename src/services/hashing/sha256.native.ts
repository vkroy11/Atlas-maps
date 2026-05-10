/**
 * Native impl — used on iOS/Android via Metro's platform suffix.
 * `expo-crypto`'s `digest` runs on each platform's native crypto.
 */
import * as Crypto from 'expo-crypto';

export async function hashTile(data: Uint8Array): Promise<string> {
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, buffer);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
