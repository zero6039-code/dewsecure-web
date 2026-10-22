export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Authorization',
        'Access-Control-Expose-Headers': 'X-Model-Version, X-Model-Sha256, Content-Length, ETag',
      }});
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/download-model') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
          status: 401, headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];

      // 🌟 核心安全验证：请求 Supabase 校验 JWT 是否真实有效
      try {
        const supabaseVerify = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': env.SUPABASE_ANON_KEY
          }
        });

        if (!supabaseVerify.ok) {
          return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Token' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const user = await supabaseVerify.json();
        // Token 验证通过，可以在这里进一步校验用户的 tier 是否是 pro
        // 暂时仅校验登录状态，确保 model 只有真实用户能拉取

      } catch (err) {
        return new Response(JSON.stringify({ error: 'Auth Service Error' }), {
          status: 500, headers: { 'Content-Type': 'application/json' }
        });
      }

      // --- 以下是原有的 R2 下载逻辑 ---
      const [modelObj, metaObj] = await Promise.all([
        env.R2_BUCKET.get('latest/classifier_int8.onnx'),
        env.R2_BUCKET.get('latest/model_meta.json'),
      ]);

      if (modelObj === null) {
        return new Response(JSON.stringify({ error: 'Model not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }

      let modelVersion = '';
      let modelSha256 = '';
      if (metaObj !== null) {
        try {
          const meta = JSON.parse(await metaObj.text());
          modelVersion = meta.trainedAt || '';
          modelSha256 = meta.sha256 || '';
        } catch (e) {}
      }

      return new Response(modelObj.body, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="classifier_int8.onnx"',
          'Content-Length': modelObj.size,
          'ETag': modelObj.etag,
          'X-Model-Version': modelVersion,
          'X-Model-Sha256': modelSha256,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'X-Model-Version, X-Model-Sha256, Content-Length, ETag',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
