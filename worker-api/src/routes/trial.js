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
    // 🌟 修复 S-01 第一步：指纹格式校验 + 邮箱验证校验
    let fingerprint = c.req.header('X-Device-Fingerprint') || `user_${user.id}`;
    // 防止客户端随意传入超长或非法字符
    if (!/^[a-zA-Z0-9_-]{10,64}$/.test(fingerprint)) {
      return c.json({ error: 'INVALID_FINGERPRINT', message: 'Device fingerprint format is invalid.' }, 400);
    }

    if (!user.email_confirmed_at) {
      return c.json({ error: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email before claiming trial.' }, 400);
    }

    // 🌟 修复 S-01 第二步：邮箱归一化并计算哈希
    const email = user.email || '';
    const normalizedEmail = email.toLowerCase()
      .replace(/\+.*@/, '@') // 去掉 +tag
      .replace(/^([^@]+)@gmail\.com$/, (m, p1) => p1.replace(/\./g, '') + '@gmail.com'); // Gmail 去点

    const emailHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedEmail))
      .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // 🌟 修复 S-01 第三步：检查临时邮箱黑名单
    const emailDomain = email.split('@')[1]?.toLowerCase();
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

    // 🌟 修复 S-01 第四步：检查 devices 表，该指纹是否已绑定其他账号
    // devices.user_id 为 NOT NULL，唯一约束为 (user_id, fingerprint)，此判断安全
    const { data: existingDevices } = await supabaseAdmin
      .from('devices')
      .select('user_id')
      .eq('fingerprint', fingerprint);

    if (existingDevices && existingDevices.some(d => d.user_id !== user.id)) {
      return c.json({ error: 'ALREADY_CLAIMED', message: 'Device used by another account.' }, 400);
    }

    // 🌟 修复 S-01 第五步：先占位，再原子授予（核心修复）
    // 1. 尝试插入 trial_claims 占位，依赖数据库主键/唯一约束拦截并发
    const { error: claimErr } = await supabaseAdmin.from('trial_claims').insert({
      fingerprint: fingerprint,
      user_id: user.id,
      email_hash: emailHash,
      claimed_at: new Date().toISOString()
    });

    if (claimErr) {
      if (claimErr.code === '23505') { // 唯一约束冲突 (指纹或邮箱已存在)
        return c.json({ error: 'ALREADY_CLAIMED', message: 'Device or email already claimed trial.' }, 400);
      }
      throw claimErr;
    }

    // 2. 原子更新 profiles，条件严格限制为未使用过试用的 free 用户
    const trialEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    const { data: granted, error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ tier: 'trial', trial_ends_at: trialEnd })
      .eq('id', user.id)
      .eq('tier', 'free')
      .is('trial_ends_at', null)
      .is('subscription_ends_at', null)
      .select('id');

    // 🌟 修复 N-05②：回滚统一走 rollbackClaim，按 fingerprint + user_id 双条件限定
    const rollbackClaim = () => supabaseAdmin
      .from('trial_claims')
      .delete()
      .eq('fingerprint', fingerprint)
      .eq('user_id', user.id);

    if (updateErr) {
      // 修复 N-05①：更新报错时先回滚占位，避免用户永久被锁
      await rollbackClaim();
      throw updateErr;
    }

    if (!granted || granted.length === 0) {
      // 更新未命中行（用户状态已变），回滚占位
      await rollbackClaim();
      return c.json({ error: 'ALREADY_CLAIMED', message: 'Not eligible for trial.' }, 400);
    }

    // 3. 尝试写入通知，失败不阻断主流程
    // 修复 N-05③：supabase-js 的 insert 返回 { error }，不抛异常
    const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      type: 'billing',
      title_key: 'notif_trial_activated',
      message_key: 'notif_trial_activated',
      params: {}
    });
    if (notifErr) {
      console.warn('⚠️ [claim-trial] 通知写入失败:', notifErr.message);
    }

    return c.json({ success: true, trial_ends_at: trialEnd });
  } catch (err) {
    console.error('❌ [claim-trial] 报错:', err.message);
    return c.json({ error: 'Failed to claim trial' }, 500);
  }
});

export default trialRoute;
