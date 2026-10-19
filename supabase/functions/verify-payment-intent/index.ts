import {
  handleError,
  HttpError,
  jsonResponse,
  preflightResponse,
  readJson,
  requirePost,
} from '../_shared/http.ts';
import {
  requirePaymentIntentId,
  requireWalletAccess,
} from '../_shared/security.ts';
import { getStripe, publicPaymentIntent } from '../_shared/stripe.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return preflightResponse();
  try {
    requirePost(request);
    await requireWalletAccess(request);
    const body = await readJson(request);
    const paymentIntentId = requirePaymentIntentId(body.paymentIntentId);
    const intent = await getStripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ['payment_method'],
    });
    if (
      intent.livemode ||
      intent.metadata.environment !== 'watch-home-test' ||
      !intent.metadata.productId
    ) {
      throw new HttpError(404, 'El pago no pertenece a Watch Home Test Mode.');
    }
    return jsonResponse(publicPaymentIntent(intent));
  } catch (error) {
    return handleError(error);
  }
});

