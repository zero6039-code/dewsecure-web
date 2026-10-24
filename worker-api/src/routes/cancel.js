import { Hono } from 'hono';
import { getStripe } from '../lib/stripe.js';
import { getSupabaseUser, getSupabaseAdmin } from '../lib/supabase.js';

const cancelRoute = new Hono();

cancelRoute.post('/cancel', async (c) => {
  const stripe = getStripe(c.env);
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);

  const token = authHeader.split(' ')[1];
  const { reason } = await c.req.json();

  const supabase = getSupabaseUser(c.env, token);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return c.json({ error: 'Invalid token' }, 401);

  const supabaseAdmin = getSupabaseAdmin(c.env);

  try {
    // 1. 查找用户活跃的订阅记录
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (!subs || subs.length === 0) {
      return c.json({ error: 'No active subscription found' }, 404);
    }

    const subId = subs[0].stripe_subscription_id;

    // 2. 调用 Stripe API，标记为到期取消
    await stripe.subscriptions.update(subId, {
      cancel_at_period_end: true,
      metadata: { cancel_reason: reason || 'Not provided' }
    });

    // 3. 同步更新本地数据库
    await supabaseAdmin.from('subscriptions').update({
      cancel_at_period_end: true,
      cancel_reason: reason || 'User requested',
      canceled_at: new Date().toISOString()
    }).eq('stripe_subscription_id', subId);

    // （可选）记录取消原因到 reports 表作为历史日志
    await supabaseAdmin.from('reports').insert({
      user_id: user.id, reporter_email: user.email, report_type: 'other', 
      url: 'Cancel Sub', description: `[取消原因] ${reason || '未填写'}`
    });

    return c.json({ success: true });
  } catch (err) {
    console.error('❌ [cancel] Stripe API failed:', err.message);
    return c.json({ error: 'Failed to cancel subscription' }, 500);
  }
});

export default cancelRoute;
