import { hashPin } from '../../src/engine/pin';

describe('hashPin', () => {
  it('returns a 64-char hex SHA-256 of "salt:pin"', async () => {
    // sha256("a:1234")
    const h = await hashPin('1234', 'a');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(await hashPin('1234', 'a'));
  });

  it('matches a known SHA-256 value, so stored hashes stay valid', async () => {
    expect(await hashPin('1234', 'a')).toBe('3dc2252a9a5cbdbba0eb7211a93e92663460a85f8d4260b2caca18f742747bc0');
  });

  it('uses the salt, so the same PIN hashes differently per profile', async () => {
    expect(await hashPin('1234', 'a')).not.toBe(await hashPin('1234', 'b'));
  });

  it('hashes different PINs differently', async () => {
    expect(await hashPin('1234', 'a')).not.toBe(await hashPin('1235', 'a'));
  });
});
