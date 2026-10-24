import { Hono } from 'hono';
import { getSupabaseUser, getSupabaseAdmin } from '../lib/supabase.js';

const trialRoute = new Hono();

trialRoute.post('/claim-trial', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);

  const token = authHeader.split(' ')[1];
  const supabase = getSupabaseUser(c.env, token);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return c.json({ error: 'Invalid token' }, 401);

  const supabaseAdmin = getSupabaseAdmin(c.env);

  try {
    // 1. 检查用户当前状态
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tier, trial_ends_at, subscription_ends_at')
      .eq('id', user.id)
      .single();

    // 2. 如果已经是付费用户，或者已经在试用期，或者领过，直接拒绝
    if (profile.tier !== 'free' || profile.trial_ends_at || profile.subscription_ends_at) {
      return c.json({ error: 'ALREADY_CLAIMED', message: 'Trial already claimed or not eligible.' }, 400);
    }

    // 3. 写入 30 天试用
    const trialEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ tier: 'pro', trial_ends_at: trialEnd })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    // 4. 记录到 trial_claims 表（如果你的表结构有的话）
    await supabaseAdmin.from('trial_claims').insert({
      user_id: user.id,
      email: user.email,
      claimed_at: new Date().toISOString()
    }).select().maybeSingle();

    return c.json({ success: true, trial_ends_at: trialEnd });
  } catch (err) {
    console.error('❌ [claim-trial] 报错:', err.message);
    return c.json({ error: 'Failed to claim trial' }, 500);
  }
});

export default trialRoute;
