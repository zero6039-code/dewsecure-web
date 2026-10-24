import { Hono } from 'hono';
import { getStripe } from '../lib/stripe.js';
import { getSupabaseUser, getSupabaseAdmin } from '../lib/supabase.js';

const checkoutRoute = new Hono();

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

  // 🌟 新增：检查用户是否已有有效订阅
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
    // 如果用户已经是同一个套餐，直接拦截
    if (currentSub.price_id === price_id) {
      return c.json({ error: 'ALREADY_SUBSCRIBED', message: 'You already have an active subscription.' }, 400);
    }
    // 如果是不同套餐（如 Pro 升 Family），暂时也拦截，引导去 Dashboard（后续接 Customer Portal 升级）
    return c.json({ error: 'UPGRADE_REQUIRED', message: 'Please go to your dashboard to change your plan.' }, 400);
  }

  // 如果没有活跃订阅，才创建 Checkout Session
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
    console.error('❌ [checkout] Stripe session creation failed:', err.message);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

export default checkoutRoute;
