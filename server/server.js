/* eslint-disable import/no-unresolved */

import { createServer } from 'node:http';
import { loadEnvFile } from 'node:process';
import Stripe from 'stripe';

loadEnvFile(new URL('.env', import.meta.url));

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey || !secretKey.startsWith('sk_test_')) {
  throw new Error('Configura una STRIPE_SECRET_KEY de prueba en server/.env');
}

const stripe = new Stripe(secretKey);
const port = Number(process.env.PORT || 4242);
const catalog = Object.freeze({
  school_material: {
    amount: 1000,
    currency: 'mxn',
    description: 'Material escolar de prueba',
  },
  watch_accessory: {
    amount: 1299,
    currency: 'mxn',
    description: 'Accesorio educativo de prueba',
  },
});

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
};

const readJson = request =>
  new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 10000) reject(new Error('Solicitud demasiado grande'));
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('JSON inválido'));
      }
    });
    request.on('error', reject);
  });

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (
      request.method === 'GET' &&
      (request.url === '/health' || request.url === '/api/health')
    ) {
      sendJson(response, 200, { ok: true, mode: 'test' });
      return;
    }

    if (request.method === 'POST' && request.url === '/payment-intents') {
      const body = await readJson(request);
      const product = catalog[body.productId];
      const idempotencyKey = request.headers['idempotency-key'];
      if (!product) {
        sendJson(response, 400, { error: 'Producto no válido' });
        return;
      }
      if (!idempotencyKey || String(idempotencyKey).length < 12) {
        sendJson(response, 400, { error: 'Falta la clave de idempotencia' });
        return;
      }
      const intent = await stripe.paymentIntents.create(
        {
          amount: product.amount,
          currency: product.currency,
          description: product.description,
          automatic_payment_methods: { enabled: true },
          metadata: {
            productId: body.productId,
            environment: 'watch-home-test',
          },
        },
        { idempotencyKey: String(idempotencyKey) },
      );
      sendJson(response, 200, {
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        amount: product.amount,
        currency: product.currency,
        description: product.description,
        status: intent.status,
      });
      return;
    }

    const match = request.url.match(/^\/payment-intents\/(pi_[A-Za-z0-9_]+)$/);
    if (request.method === 'GET' && match) {
      const intent = await stripe.paymentIntents.retrieve(match[1]);
      sendJson(response, 200, {
        paymentIntentId: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        description: intent.description,
        status: intent.status,
        paymentMethod: intent.payment_method
          ? String(intent.payment_method).slice(-8)
          : null,
        created: intent.created,
      });
      return;
    }

    sendJson(response, 404, { error: 'Ruta no encontrada' });
  } catch (error) {
    process.stderr.write(
      `Stripe server error: ${
        error && error.type ? error.type : 'internal'
      } · ${error && error.message ? error.message : 'unknown'}\n`,
    );
    const safeMessage =
      error && error.type && error.type.startsWith('Stripe')
        ? error.message
        : 'No se pudo procesar la solicitud';
    sendJson(response, 500, { error: safeMessage });
  }
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`Stripe test server listening on port ${port}\n`);
});

server.on('error', error => {
  process.stderr.write(
    `Stripe server startup error: ${
      error && error.code ? error.code : 'unknown'
    }\n`,
  );
  process.exitCode = 1;
});
