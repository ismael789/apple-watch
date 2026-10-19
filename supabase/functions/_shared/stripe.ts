import Stripe from 'npm:stripe@23.0.0';
import { HttpError } from './http.ts';

let stripeClient: Stripe | null = null;

export const getStripe = () => {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (!secretKey.startsWith('sk_test_')) {
    throw new HttpError(
      503,
      'Stripe Test Mode no está configurado en el servidor.',
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return stripeClient;
};

export const publicPaymentIntent = (intent: Stripe.PaymentIntent) => {
  const paymentMethod =
    intent.payment_method && typeof intent.payment_method !== 'string'
      ? intent.payment_method
      : null;
  const card = paymentMethod && paymentMethod.card;
  return {
    paymentIntentId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    description: intent.description,
    status: intent.status,
    paymentMethod: card
      ? `${card.brand || 'card'} •••• ${card.last4 || ''}`.trim()
      : null,
    created: intent.created,
  };
};

