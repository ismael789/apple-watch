import { getProduct } from '../_shared/catalog.ts';
import {
  handleError,
  HttpError,
  jsonResponse,
  preflightResponse,
  readJson,
  requirePost,
} from '../_shared/http.ts';
import {
  requireOperationId,
  requireWalletAccess,
} from '../_shared/security.ts';
import { getStripe } from '../_shared/stripe.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return preflightResponse();
  try {
    requirePost(request);
    await requireWalletAccess(request);
    const body = await readJson(request);
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const product = getProduct(productId);
    if (!product) throw new HttpError(400, 'Producto no válido.');
    const operationId = requireOperationId(body.operationId);
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create(
      {
        amount: product.amount,
        currency: product.currency,
        description: product.description,
        payment_method_types: ['card'],
        metadata: {
          environment: 'watch-home-test',
          operationId,
          productId,
        },
      },
      { idempotencyKey: `watch-home:${operationId}` },
    );
    if (!intent.client_secret) {
      throw new HttpError(502, 'Stripe no devolvió un secreto de cliente.');
    }
    return jsonResponse({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      description: intent.description,
      status: intent.status,
      operationId,
    });
  } catch (error) {
    return handleError(error);
  }
});

