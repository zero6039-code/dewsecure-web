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
    // 🌟 修复 M-7 第一步：提取指纹（提前到最开始，用于后续查重）
    const fingerprint = c.req.header('X-Device-Fingerprint') || `user_${user.id}`;

    // 🌟 修复 M-7 第二步：检查临时邮箱黑名单（直接查表）
    const emailDomain = (user.email || '').split('@')[1]?.toLowerCase();
    if (emailDomain) {
      const { data: blockedDomain } = await supabaseAdmin
        .from('disposable_email_domains')
        .select('domain')
        .eq('domain', emailDomain)
        .maybeSingle();

      if (blockedDomain) {
        return c.json({ error: 'DISPOSABLE_EMAIL', message: 'Temporary email is not allowed.' }, 400);
      }
    }

    // 🌟 修复 M-7 第三步：查询 trial_claims，该设备是否领过
    const { data: existingClaim } = await supabaseAdmin
      .from('trial_claims')
      .select('fingerprint')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    if (existingClaim) {
      return c.json({ error: 'ALREADY_CLAIMED', message: 'Device already claimed trial.' }, 400);
    }

    // 🌟 修复 M-7 第四步：查询 devices 表，该指纹是否已绑定其他账号
    const { data: existingDevices } = await supabaseAdmin
      .from('devices')
      .select('user_id')
      .eq('fingerprint', fingerprint);

    if (existingDevices && existingDevices.some(d => d.user_id !== user.id)) {
      return c.json({ error: 'ALREADY_CLAIMED', message: 'Device used by another account.' }, 400);
    }

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
      .update({ tier: 'trial', trial_ends_at: trialEnd })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    // 4. 插入试用激活通知
    await supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      type: 'billing',
      title_key: 'notif_trial_activated',
      message_key: 'notif_trial_activated',
      params: {}
    });

    // 5. 记录到 trial_claims 表
    const { error: claimErr } = await supabaseAdmin.from('trial_claims').insert({
      fingerprint: fingerprint,
      user_id: user.id,
      claimed_at: new Date().toISOString()
    });

    if (claimErr) {
      console.warn('⚠️ [claim-trial] 写入 trial_claims 失败:', claimErr.message);
      // 这里不 throw，防止因为统计日志写入失败导致用户拿不到试用
    }

    return c.json({ success: true, trial_ends_at: trialEnd });
  } catch (err) {
    console.error('❌ [claim-trial] 报错:', err.message);
    return c.json({ error: 'Failed to claim trial' }, 500);
  }
});

export default trialRoute;
