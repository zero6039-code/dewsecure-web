import { Hono } from 'hono';
import { getSupabaseUser, getSupabaseAdmin } from '../lib/supabase.js';

const checkoutRoute = new Hono();

const ALLOWED_PRICE_IDS = new Set([
  'price_1UUF9SAB28DjNkOqrt3BX9Dr', // Family
  'price_1UUF86AB28DjNkOqNGl2YoBN'  // Pro
]);

checkoutRoute.post('/checkout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);

  const token = authHeader.split(' ')[1];
  
  // 🌟 修复 S-06：增加 JSON 解析兜底，防止非法格式导致 500 崩溃
  const body = await c.req.json().catch(() => ({}));
  const price_id = body.price_id;
  
  if (!price_id || !ALLOWED_PRICE_IDS.has(price_id)) {
    return c.json({ error: 'Invalid price_id' }, 400);
  }

  const supabase = getSupabaseUser(c.env, token);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return c.json({ error: 'Invalid token' }, 401);

  const supabaseAdmin = getSupabaseAdmin(c.env);
  const { data: existingSubs } = await supabaseAdmin
    .from('subscriptions')
    .select('status, price_id')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (existingSubs && existingSubs.length > 0) {
    const currentSub = existingSubs[0];
    if (currentSub.status === 'trialing') {
      console.log(`[checkout] 用户 ${user.id} 处于试用期，允许直接发起新订阅`);
    } else {
      if (currentSub.price_id === price_id) {
        return c.json({ error: 'ALREADY_SUBSCRIBED', message: 'You already have an active subscription.' }, 400);
      }
      return c.json({ error: 'UPGRADE_REQUIRED', message: 'Please go to your dashboard to change your plan.' }, 400);
    }
  }

  try {
    // 🌟 使用原生 fetch 替代 Stripe SDK，彻底规避 525 SSL 握手问题
    const params = new URLSearchParams();
    params.append('ui_mode', 'embedded_page');
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', price_id);
    params.append('line_items[0][quantity]', '1');
    params.append('client_reference_id', user.id);
    params.append('customer_email', user.email);
    params.append('subscription_data[metadata][user_id]', user.id);
    params.append('metadata[user_id]', user.id);
    params.append('return_url', `${c.env.FRONTEND_URL}/dashboard.html?checkout=success`);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY.trim()}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!stripeRes.ok) {
      const errText = await stripeRes.text();
      console.error('❌ [checkout] Stripe 原生报错:', errText);
      throw new Error(`Stripe API returned ${stripeRes.status}`);
    }

    const session = await stripeRes.json();
    return c.json({ clientSecret: session.client_secret });
  } catch (err) {
    // 🌟 修复 S-07：移除 detail 字段，避免内部错误详情泄露给客户端
    console.error('❌ [checkout] 捕获异常:', err.message);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

export default checkoutRoute;
