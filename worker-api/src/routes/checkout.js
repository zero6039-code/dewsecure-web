import { Hono } from 'hono';
import { getStripe } from '../lib/stripe.js';
import { getSupabaseUser, getSupabaseAdmin } from '../lib/supabase.js';

const checkoutRoute = new Hono();

// ==========================================
// 🌟 诊断端点：测试 Worker 原生 fetch 能否连通 Stripe
// ==========================================
checkoutRoute.get('/test-stripe-connection', async (c) => {
  try {
    const res = await fetch('https://api.stripe.com/v1/account', {
      headers: {
        'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    const text = await res.text();
    return c.json({ 
      status: res.status, 
      ok: res.ok, 
      body: text.slice(0, 200) 
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ==========================================
// 核心业务：创建 Checkout Session
// ==========================================
checkoutRoute.post('/checkout', async (c) => {
  const stripe = getStripe(c.env);
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);

  const token = authHeader.split(' ')[1];
  const { price_id } = await c.req.json();
  if (!price_id) return c.json({ error: 'Missing price_id' }, 400);

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
    if (currentSub.price_id === price_id) {
      return c.json({ error: 'ALREADY_SUBSCRIBED', message: 'You already have an active subscription.' }, 400);
    }
    return c.json({ error: 'UPGRADE_REQUIRED', message: 'Please go to your dashboard to change your plan.' }, 400);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email,
      subscription_data: { metadata: { user_id: user.id } },
      metadata: { user_id: user.id },
      return_url: `${c.env.FRONTEND_URL}/dashboard.html?checkout=success`,
    });

    return c.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('❌ [checkout] 捕获到 Stripe 报错！');
    console.error('❌ Message:', err.message);
    console.error('❌ StatusCode:', err.statusCode);
    if (err.raw) {
      console.error('❌ Raw Response:', typeof err.raw === 'string' ? err.raw : JSON.stringify(err.raw, null, 2));
    }
    return c.json({ error: 'Failed to create checkout session', detail: err.message }, 500);
  }
});

export default checkoutRoute;
