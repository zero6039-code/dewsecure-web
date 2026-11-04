import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const intelRoute = new Hono();

const getSupabase = (env) => createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

intelRoute.post('/intel/contribute', async (c) => {
  try {
    const { reporterId, rules } = await c.req.json();
    if (!reporterId || !Array.isArray(rules) || rules.length === 0) {
      return c.json({ error: 'Invalid payload' }, 400);
    }

    const supabase = getSupabase(c.env);
    let updatedCount = 0;
    let errors = [];

    for (const rule of rules) {
      if (!rule.domain || typeof rule.score !== 'number') continue;

      const { data: existing, error: selectError } = await supabase
        .from('ai_candidates')
        .select('reporters, report_count')
        .eq('domain', rule.domain)
        .maybeSingle();

      if (selectError) {
          errors.push({ action: 'select', domain: rule.domain, error: selectError.message });
          continue;
      }

      if (existing) {
        if (!existing.reporters.includes(reporterId)) {
          const { error: updateError } = await supabase.from('ai_candidates').update({
            reporters: [...existing.reporters, reporterId],
            report_count: existing.report_count + 1,
            last_seen: new Date().toISOString()
          }).eq('domain', rule.domain);
          
          if (updateError) errors.push({ action: 'update', domain: rule.domain, error: updateError.message });
          else updatedCount++;
        }
      } else {
        const { error: insertError } = await supabase.from('ai_candidates').insert({
          domain: rule.domain,
          reporters: [reporterId],
          report_count: 1
        });
        
        if (insertError) errors.push({ action: 'insert', domain: rule.domain, error: insertError.message });
        else updatedCount++;
      }
    }

    if (errors.length > 0) {
        console.error('[Intel Contribute] DB Errors:', errors);
        return c.json({ ok: false, error: 'Database insertion failed', details: errors }, 500);
    }

    return c.json({ ok: true, processed: updatedCount });
  } catch (err) {
    console.error('[Intel Contribute] Exception:', err);
    return c.json({ error: 'Failed to process contribution' }, 500);
  }
});

// ... (保留原本的 4 个 GET 路由不变，直接粘贴之前的即可) ...
// 🌟 提供恶意域名拦截规则下发（支持 ETag 304 缓存）
intelRoute.get('/intel/threat-rules', async (c) => {
  try {
    const obj = await c.env.R2_BUCKET.get('intel/threat-rules.json');
    if (!obj) return c.json({ error: 'Threat intel not found yet. Run CI first.' }, 404);
    const etag = obj.httpEtag;
    if (c.req.header('If-None-Match') === etag) return new Response(null, { status: 304 });
    return new Response(obj.body, { headers: { 'Content-Type': 'application/json', 'ETag': etag, 'Cache-Control': 'public, max-age=3600' } });
  } catch (err) { return c.json({ error: 'Failed to fetch intel' }, 500); }
});

intelRoute.get('/intel/threat-rules.sig', async (c) => {
  try {
    const obj = await c.env.R2_BUCKET.get('intel/threat-rules.json.sig');
    if (!obj) return c.json({ error: 'Threat intel signature not found.' }, 404);
    const etag = obj.httpEtag;
    if (c.req.header('If-None-Match') === etag) return new Response(null, { status: 304 });
    return new Response(obj.body, { headers: { 'Content-Type': 'application/json', 'ETag': etag } });
  } catch (err) { return c.json({ error: 'Failed' }, 500); }
});

intelRoute.get('/intel/threat-filter.bin', async (c) => {
  try {
    const obj = await c.env.R2_BUCKET.get('intel/threat-filter.bin');
    if (!obj) return c.json({ error: 'Threat filter not found.' }, 404);
    const etag = obj.httpEtag;
    if (c.req.header('If-None-Match') === etag) return new Response(null, { status: 304 });
    return new Response(obj.body, { headers: { 'Content-Type': 'application/octet-stream', 'ETag': etag } });
  } catch (err) { return c.json({ error: 'Failed' }, 500); }
});

intelRoute.get('/intel/threat-filter.meta.json', async (c) => {
  try {
    const obj = await c.env.R2_BUCKET.get('intel/threat-filter.meta.json');
    if (!obj) return c.json({ error: 'Threat filter meta not found.' }, 404);
    const etag = obj.httpEtag;
    if (c.req.header('If-None-Match') === etag) return new Response(null, { status: 304 });
    return new Response(obj.body, { headers: { 'Content-Type': 'application/json', 'ETag': etag } });
  } catch (err) { return c.json({ error: 'Failed' }, 500); }
});

export default intelRoute;
