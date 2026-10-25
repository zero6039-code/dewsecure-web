import Stripe from 'stripe';

export function getStripe(env) {
  // 不传 httpClient，使用默认的 fetch，同时在 Worker 中指定最新的 API 版本以兼容 embedded_page
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia', 
    maxNetworkRetries: 3,
  });
}
