import { Hono } from 'hono';

const intelRoute = new Hono();

// 🌟 提供恶意域名拦截规则下发（支持 ETag 304 缓存）
intelRoute.get('/intel/threat-rules', async (c) => {
  try {
    const obj = await c.env.R2_BUCKET.get('intel/threat-rules.json');

    if (!obj) {
      return c.json({ error: 'Threat intel not found yet. Run CI first.' }, 404);
    }

    // ETag 去重（304 命中时不传 body，省流量）
    const etag = obj.httpEtag;
    const clientEtag = c.req.header('If-None-Match');
    if (clientEtag === etag) {
      return new Response(null, { status: 304 });
    }

    return new Response(obj.body, {
      headers: {
        'Content-Type': 'application/json',
        'ETag': etag,
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch intel' }, 500);
  }
});

// 🔐 威胁情报签名下发（Ed25519 签名 + 版本 + sha256）
// 插件必须验签通过才注入 DNR 规则，防止 R2 泄露/误操作导致黑名单被投毒
intelRoute.get('/intel/threat-rules.sig', async (c) => {
  try {
    const obj = await c.env.R2_BUCKET.get('intel/threat-rules.json.sig');

    if (!obj) {
      return c.json({ error: 'Threat intel signature not found. Run CI first.' }, 404);
    }

    const etag = obj.httpEtag;
    const clientEtag = c.req.header('If-None-Match');
    if (clientEtag === etag) {
      return new Response(null, { status: 304 });
    }

    return new Response(obj.body, {
      headers: {
        'Content-Type': 'application/json',
        'ETag': etag,
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err) {
    return c.json({ error: 'Failed to fetch intel signature' }, 500);
  }
});

export default intelRoute;
