/* global beforeEach, describe, expect, it, jest */

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

const SecureStore = require('expo-secure-store');
const {
  getWalletAccessToken,
  isValidWalletAccessToken,
  removeWalletAccessToken,
  saveWalletAccessToken,
} = require('../walletAccess');

describe('walletAccess', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects short or whitespace-containing tokens', () => {
    expect(isValidWalletAccessToken('short')).toBe(false);
    expect(isValidWalletAccessToken(`${'a'.repeat(32)} space`)).toBe(false);
    expect(isValidWalletAccessToken('a'.repeat(32))).toBe(true);
  });

  it('stores a valid token using device-only secure storage', async () => {
    const token = 'a'.repeat(32);
    await expect(saveWalletAccessToken(` ${token} `)).resolves.toBe(token);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'watch-home.wallet-access-token',
      token,
      {
        keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
      },
    );
  });

  it('reads and removes the stored token', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce(` ${'b'.repeat(32)} `);
    await expect(getWalletAccessToken()).resolves.toBe('b'.repeat(32));
    await removeWalletAccessToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'watch-home.wallet-access-token',
    );
  });
});
