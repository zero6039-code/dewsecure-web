import Stripe from 'stripe';

export function getStripe(env) {
  if (!env.STRIPE_SECRET_KEY) {
    console.error('❌ [Stripe Lib] 缺少 STRIPE_SECRET_KEY 环境变量！');
    throw new Error('Stripe Secret Key is missing from environment variables.');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
}
