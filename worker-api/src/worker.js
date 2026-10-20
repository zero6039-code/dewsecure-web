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

    const mockAuthEnabled = env.MOCK_AUTH_ENABLED === 'true' || env.MOCK_AUTH_ENABLED === '1';
    const isMockAuthOk = (authHeader) => {
      if (!mockAuthEnabled) return false;
      const token = authHeader ? authHeader.split(' ')[1] : '';
      return typeof token === 'string' && token.startsWith('mock_jwt_');
    };

    if (url.pathname === '/api/download-model') {
      const authHeader = request.headers.get('Authorization');
      if (!isMockAuthOk(authHeader)) {
        if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== env.AUTH_TOKEN) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
          });
        }
      }

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
          const metaText = await metaObj.text();
          const meta = JSON.parse(metaText);
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
