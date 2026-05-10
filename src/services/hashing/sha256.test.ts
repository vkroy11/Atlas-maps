import { hashTile } from './sha256';

// NIST FIPS 180-2 reference vectors.
const SHA256_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('hashTile', () => {
  it('hashes empty input to the canonical SHA-256 of "" ', async () => {
    const hash = await hashTile(new Uint8Array(0));
    expect(hash).toBe(SHA256_EMPTY);
  });

  it('hashes "abc" to the canonical NIST vector', async () => {
    const data = new TextEncoder().encode('abc');
    const hash = await hashTile(data);
    expect(hash).toBe(SHA256_ABC);
  });

  it('returns a stable lowercase 64-char hex string', async () => {
    const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);
    const a = await hashTile(data);
    const b = await hashTile(data);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('honors byteOffset/byteLength when given a Uint8Array view of a larger buffer', async () => {
    // Buffer contains [0,1,2,3,4,5,6,7,8,9]; view is bytes [3,4,5,6,7] = "abc.." ish.
    // Using a sliced view should hash only those 3 bytes equal to ASCII "abc".
    const big = new Uint8Array(10);
    new TextEncoder().encodeInto('abc', big.subarray(3));
    const view = big.subarray(3, 6);
    const hash = await hashTile(view);
    expect(hash).toBe(SHA256_ABC);
  });

  it('produces different hashes for different inputs', async () => {
    const a = await hashTile(new Uint8Array([1, 2, 3]));
    const b = await hashTile(new Uint8Array([1, 2, 4]));
    expect(a).not.toBe(b);
  });
});
