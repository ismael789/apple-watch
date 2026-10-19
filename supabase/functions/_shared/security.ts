import { HttpError } from './http.ts';

const encode = (value: string) => new TextEncoder().encode(value);

const digest = async (value: string) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', encode(value)));

const equalDigests = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
};

export const requireWalletAccess = async (request: Request) => {
  const expected = Deno.env.get('WALLET_ACCESS_TOKEN') || '';
  if (expected.length < 32) {
    throw new HttpError(503, 'El acceso privado de Wallet no está configurado.');
  }
  const received = request.headers.get('x-wallet-access-token') || '';
  if (
    received.length < 32 ||
    !(await equalDigests(await digest(received), await digest(expected)))
  ) {
    throw new HttpError(401, 'Acceso no autorizado.');
  }
};

export const requireOperationId = (value: unknown) => {
  if (
    typeof value !== 'string' ||
    !/^watch-[0-9]{10,16}-[a-z0-9]{10,32}$/.test(value)
  ) {
    throw new HttpError(400, 'Identificador de operación inválido.');
  }
  return value;
};

export const requirePaymentIntentId = (value: unknown) => {
  if (typeof value !== 'string' || !/^pi_[A-Za-z0-9_]+$/.test(value)) {
    throw new HttpError(400, 'Identificador de pago inválido.');
  }
  return value;
};

