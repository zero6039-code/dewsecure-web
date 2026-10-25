import Stripe from 'stripe';

export function getStripe(env) {
  // 🌟 自定义 Fetch：拦截所有向 api.stripe.com 的请求，转交给内网代理
  const customFetch = (url, options) => {
    const parsedUrl = new URL(url);
    // 构造一个假的域名通过 Service Binding 发送
    const targetUrl = `https://stripe-proxy${parsedUrl.pathname}${parsedUrl.search}`;
    return env.STRIPE_PROXY.fetch(targetUrl, options);
  };

  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(customFetch),
    maxNetworkRetries: 2,
  });
}
