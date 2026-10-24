import { Hono } from 'hono';
import { getStripe } from '../lib/stripe.js';
import { getSupabaseUser, getSupabaseAdmin } from '../lib/supabase.js';

const portalRoute = new Hono();

portalRoute.post('/portal', async (c) => {
  const stripe = getStripe(c.env);
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
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${c.env.FRONTEND_URL}/dashboard.html`,
    });
    return c.json({ url: session.url });
  } catch (err) {
    console.error('❌ [portal] Stripe API failed:', err.message);
    return c.json({ error: 'Failed to create portal session' }, 500);
  }
});

export default portalRoute;
