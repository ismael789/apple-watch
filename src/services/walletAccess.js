import * as SecureStore from 'expo-secure-store';

const WALLET_ACCESS_KEY = 'watch-home.wallet-access-token';

const normalizeToken = value => (typeof value === 'string' ? value.trim() : '');

export const isValidWalletAccessToken = value => {
  const token = normalizeToken(value);
  return token.length >= 32 && token.length <= 256 && !/\s/.test(token);
};

export const getWalletAccessToken = async () =>
  normalizeToken(await SecureStore.getItemAsync(WALLET_ACCESS_KEY));

export const saveWalletAccessToken = async value => {
  const token = normalizeToken(value);
  if (!isValidWalletAccessToken(token)) {
    throw new Error('La clave personal debe tener al menos 32 caracteres.');
  }
  await SecureStore.setItemAsync(WALLET_ACCESS_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return token;
};

export const removeWalletAccessToken = async () =>
  SecureStore.deleteItemAsync(WALLET_ACCESS_KEY);
