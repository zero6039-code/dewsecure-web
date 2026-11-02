import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase.js';

const modelRoute = new Hono();

modelRoute.get('/download-model', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }
  const token = authHeader.split(' ')[1];

  const supabaseVerify = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': c.env.SUPABASE_ANON_KEY }
  });
  if (!supabaseVerify.ok) return c.json({ error: 'Unauthorized: Invalid Token' }, 401);

  const userData = await supabaseVerify.json();
  if (!userData?.id) return c.json({ error: 'Unauthorized: No user id' }, 401);

  const supabaseAdmin = getSupabaseAdmin(c.env);
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('tier, trial_ends_at, subscription_ends_at')
    .eq('id', userData.id)
    .single();

  if (profileErr || !profile) {
    return c.json({ error: 'Failed to verify user profile' }, 500);
  }

  const now = new Date();
  const isPro = profile.tier === 'pro' || profile.tier === 'family';
  const isActiveTrial = profile.tier === 'trial' && profile.trial_ends_at && new Date(profile.trial_ends_at) > now;
  const isActiveSub = profile.subscription_ends_at && new Date(profile.subscription_ends_at) > now;

  if (!isPro && !isActiveTrial && !isActiveSub) {
    return c.json({ error: 'Forbidden: Pro subscription or active trial required' }, 403);
  }

  const format = c.req.query('format') || 'onnx';
  const isJson = format === 'json';
  const modelFileName = isJson ? 'canary/weights.json' : 'canary/classifier_int8.onnx';

  const [modelObj, metaObj] = await Promise.all([
    c.env.R2_BUCKET.get(modelFileName),
    c.env.R2_BUCKET.get('canary/model_meta.json'),
  ]);
  
  if (!modelObj) return c.json({ error: 'Model not found' }, 404);

  const etag = modelObj.httpEtag;
  const clientEtag = c.req.header('If-None-Match');
  if (clientEtag === etag) {
    return new Response(null, { status: 304 });
  }

  let modelVersion = '', modelSha256 = '', modelSignature = '';
  if (metaObj) {
    try {
      const meta = JSON.parse(await metaObj.text());
      modelVersion = meta.trainedAt || '';
      // 🌟 核心修复：根据文件类型返回对应的哈希和签名
      if (isJson) {
        modelSha256 = meta.jsonSha256 || '';
        modelSignature = meta.jsonSignature || '';
      } else {
        modelSha256 = meta.sha256 || '';
        modelSignature = meta.signature || '';
      }
    } catch (_) {}
  }

  return new Response(modelObj.body, {
    headers: {
      'Content-Type': isJson ? 'application/json' : 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${isJson ? 'weights.json' : 'classifier_int8.onnx'}"`,
      'Content-Length': String(modelObj.size),
      'ETag': etag,
      'Cache-Control': 'public, max-age=3600',
      'X-Model-Version': modelVersion,
      'X-Model-Sha256': modelSha256,
      'X-Model-Signature': modelSignature,
      'X-Model-Channel': 'canary', // 修正前端显示的通道名
    },
  });
});

export default modelRoute;
