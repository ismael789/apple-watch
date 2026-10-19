import Stripe from 'npm:stripe@23.0.0';
import {
  handleError,
  HttpError,
  jsonResponse,
  requirePost,
} from '../_shared/http.ts';
import { getStripe } from '../_shared/stripe.ts';

const handledEvents = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
]);

Deno.serve(async request => {
  try {
    requirePost(request);
    const signature = request.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
    if (!signature || !webhookSecret.startsWith('whsec_')) {
      throw new HttpError(400, 'Firma de webhook no disponible.');
    }
    const rawBody = await request.text();
    let event: Stripe.Event;
    try {
      event = await getStripe().webhooks.constructEventAsync(
        rawBody,
        signature,
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch (_error) {
      throw new HttpError(400, 'Firma de webhook inválida.');
    }
    if (handledEvents.has(event.type)) {
      const intent = event.data.object as Stripe.PaymentIntent;
      console.log('stripe-webhook', {
        eventId: event.id,
        paymentIntentId: intent.id,
        status: intent.status,
        type: event.type,
      });
    }
    return jsonResponse({ received: true });
  } catch (error) {
    return handleError(error);
  }
});

