import { Hono } from 'hono';
import { getStripe } from '../lib/stripe.js';
import { getSupabaseUser, getSupabaseAdmin } from '../lib/supabase.js';

const resumeRoute = new Hono();

resumeRoute.post('/resume', async (c) => {
  const stripe = getStripe(c.env);
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);

  const token = authHeader.split(' ')[1];
  const supabase = getSupabaseUser(c.env, token);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return c.json({ error: 'Invalid token' }, 401);

  const supabaseAdmin = getSupabaseAdmin(c.env);

  try {
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (!subs || subs.length === 0) return c.json({ error: 'No active subscription found' }, 404);

    const subId = subs[0].stripe_subscription_id;

    // 恢复订阅（取消到期不续费）
    await stripe.subscriptions.update(subId, {
      cancel_at_period_end: false
    });

    await supabaseAdmin.from('subscriptions').update({
      cancel_at_period_end: false,
      cancel_reason: null,
      canceled_at: null
    }).eq('stripe_subscription_id', subId);

    return c.json({ success: true });
  } catch (err) {
    console.error('❌ [resume] Stripe API failed:', err.message);
    return c.json({ error: 'Failed to resume subscription' }, 500);
  }
});

export default resumeRoute;
