import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase.js';

const handoffRoute = new Hono();

handoffRoute.post('/handoff/verify', async (c) => {
  try {
    const { code } = await c.req.json();
    if (!code) return c.json({ error: 'Code required' }, 400);

    const supabase = getSupabaseAdmin(c.env);

    // 1. 查询有效且未使用的 code
    const { data: row, error } = await supabase
      .from('handoff_codes')
      .select('user_id')
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !row) {
      return c.json({ error: 'Invalid or expired code' }, 400);
    }

    // 2. 立即标记为已使用（防重放）
    await supabase.from('handoff_codes').update({ used: true }).eq('code', code);

    // 3. 获取用户邮箱
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(row.user_id);
    if (userError || !userData.user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // 4. 生成 MagicLink Token Hash
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
    });

    if (linkError) {
      return c.json({ error: 'Failed to generate session' }, 500);
    }

    return c.json({ token_hash: linkData.properties.token_hash });
  } catch (err) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

export default handoffRoute;
