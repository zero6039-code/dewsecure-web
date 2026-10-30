import { Hono } from 'hono';

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

  const [modelObj, metaObj] = await Promise.all([
    c.env.R2_BUCKET.get('latest/classifier_int8.onnx'),
    c.env.R2_BUCKET.get('latest/model_meta.json'),
  ]);
  if (!modelObj) return c.json({ error: 'Model not found' }, 404);

  let modelVersion = '', modelSha256 = '', modelSignature = '';
  if (metaObj) {
    try {
      const meta = JSON.parse(await metaObj.text());
      modelVersion = meta.trainedAt || '';
      modelSha256 = meta.sha256 || '';
        modelSignature = meta.signature || '';
    } catch (_) {}
  }

  return new Response(modelObj.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="classifier_int8.onnx"',
      'Content-Length': String(modelObj.size),
      'ETag': modelObj.etag,
      'X-Model-Version': modelVersion,
      'X-Model-Sha256': modelSha256,
        'X-Model-Signature': modelSignature,
    },
  });
});

export default modelRoute;
