// 用 mock supabaseAdmin 模拟三种场景，验证 rollbackClaim 的调用时机
// 不 import 原文件（依赖 Hono），而是复刻其核心分支逻辑做行为对照
import assert from 'node:assert/strict';

function makeMockSupabase({ updateErr = null, granted = [{ id: 'u1' }], notifErr = null } = {}) {
  const calls = { delete: [], insert: [], update: [] };
  const chain = {
    _table: null,
    from(t) { this._table = t; return this; },
    insert(row) { calls.insert.push({ table: this._table, row }); return Promise.resolve({ error: notifErr && this._table === 'notifications' ? notifErr : null }); },
    delete() { const self = this; const q = { _f: null, _u: null, eq(k, v) { if (k === 'fingerprint') q._f = v; if (k === 'user_id') q._u = v; return q; }, then(res) { calls.delete.push({ table: self._table, fingerprint: q._f, user_id: q._u }); res({ error: null }); } }; return q; },
    update() { return { eq() { return this; }, is() { return this; }, select() { return Promise.resolve({ data: granted, error: updateErr }); } }; }
  };
  return { chain, calls };
}

async function runScenario(name, mockOpts) {
  const { chain, calls } = makeMockSupabase(mockOpts);
  const supabaseAdmin = chain;
  const fingerprint = 'fp_aaaaaaaaaa';
  const user = { id: 'u1' };
  const trialEnd = 'x';

  // —— 复刻 trial.js 第 62–108 行的分支结构 ——
  const { error: claimErr } = await supabaseAdmin.from('trial_claims').insert({ fingerprint, user_id: user.id });
  if (claimErr) throw new Error('unexpected');

  const { data: granted, error: updateErr } = await supabaseAdmin.from('profiles')
    .update({}).eq('id', user.id).eq('tier', 'free').is('trial_ends_at', null).is('subscription_ends_at', null).select('id');

  const rollbackClaim = () => supabaseAdmin.from('trial_claims').delete().eq('fingerprint', fingerprint).eq('user_id', user.id);

  let outcome;
  if (updateErr) { await rollbackClaim(); outcome = 'threw'; }
  else if (!granted || granted.length === 0) { await rollbackClaim(); outcome = 'not_eligible'; }
  else { outcome = 'granted'; }

  if (outcome === 'granted') {
    const { error: notifErr } = await supabaseAdmin.from('notifications').insert({ user_id: user.id });
    if (notifErr) console.log(`  [${name}] 通知失败已记录（不阻断）`);
  }

  return { outcome, calls };
}

const scenarios = [
  { name: '正常领取',       opts: {},                                  expect: { outcome: 'granted',      rollbacks: 0 } },
  { name: 'update 报错',    opts: { updateErr: new Error('db down') }, expect: { outcome: 'threw',        rollbacks: 1 } },
  { name: '未命中行',       opts: { granted: [] },                     expect: { outcome: 'not_eligible', rollbacks: 1 } },
  { name: '通知写入失败',   opts: { notifErr: { message: 'rls' } },    expect: { outcome: 'granted',      rollbacks: 0, warn: true } },
];

let failed = 0;
for (const s of scenarios) {
  const r = await runScenario(s.name, s.opts);
  const rollbacks = r.calls.delete.filter(d => d.fingerprint && d.user_id === 'u1').length;
  const dualKey = r.calls.delete.every(d => d.fingerprint && d.user_id);
  try {
    assert.equal(r.outcome, s.expect.outcome);
    assert.equal(rollbacks, s.expect.rollbacks);
    assert.ok(dualKey, '回滚未带双条件');
    console.log(`✅ ${s.name}：outcome=${r.outcome}, rollback=${rollbacks}, 双条件=${dualKey}`);
  } catch (e) {
    failed++;
    console.error(`❌ ${s.name}：${e.message}`);
  }
}
console.log(`\n${scenarios.length - failed}/${scenarios.length} 场景通过`);
process.exit(failed === 0 ? 0 : 1);
