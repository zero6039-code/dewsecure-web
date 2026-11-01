import { Hono } from 'hono';
import { getSupabaseUser, getSupabaseAdmin } from '../lib/supabase.js';

const portalRoute = new Hono();

portalRoute.post('/portal', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);

  const token = authHeader.split(' ')[1];
  const supabase = getSupabaseUser(c.env, token);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return c.json({ error: 'Invalid token' }, 401);

  const supabaseAdmin = getSupabaseAdmin(c.env);
  const { data: profile } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();

  if (!profile?.stripe_customer_id) {
    return c.json({ error: 'No customer found' }, 404);
  }

  try {
    const params = new URLSearchParams();
    params.append('customer', profile.stripe_customer_id);
    params.append('return_url', `${c.env.FRONTEND_URL}/dashboard.html`);

    const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY.trim()}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!stripeRes.ok) {
      const errText = await stripeRes.text();
      console.error('❌ [portal] Stripe 原生报错:', errText);
      throw new Error(`Stripe API returned ${stripeRes.status}`);
    }

    const session = await stripeRes.json();
    return c.json({ url: session.url });
  } catch (err) {
    console.error('❌ [portal] 捕获异常:', err.message);
    return c.json({ error: 'Failed to create portal session' }, 500);
  }
});

export default portalRoute;
