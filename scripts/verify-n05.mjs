import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const raw = readFileSync('worker-api/src/routes/trial.js', 'utf8');

// 剥离注释后再做结构匹配，避免注释插入导致正则误报（N-05① 的前车之鉴）
// 注意：只剥离整行 // 注释和 /* */ 块注释，不碰字符串内的 // （本项目无此场景）
const src = raw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter(line => !/^\s*\/\//.test(line))
  .join('\n');

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); passed++; console.log(`✅ ${name}`); }
  catch (e) { failed++; console.error(`❌ ${name}\n   ${e.message}`); }
};

// —— 正向断言：三处修复都已就位 ——
check('N-05② rollbackClaim 为双条件', () => {
  const m = src.match(/const rollbackClaim = \(\) => supabaseAdmin[\s\S]*?\.eq\('fingerprint', fingerprint\)[\s\S]*?\.eq\('user_id', user\.id\)/);
  assert.ok(m, '未找到 rollbackClaim 双条件定义');
});

check('N-05① updateErr 分支先 await rollbackClaim 再 throw', () => {
  const m = src.match(/if \(updateErr\) \{\s*await rollbackClaim\(\);\s*throw updateErr;/);
  assert.ok(m, 'updateErr 分支缺少 rollbackClaim 或顺序不对');
});

check('N-05① updateErr 分支之前 rollbackClaim 已定义', () => {
  const idxDef = src.indexOf('const rollbackClaim = () =>');
  const idxUse = src.indexOf('if (updateErr) {');
  assert.ok(idxDef > -1 && idxUse > -1 && idxDef < idxUse, 'rollbackClaim 定义位置晚于使用位置');
});

check('N-05② 未命中行分支也走 rollbackClaim', () => {
  const m = src.match(/if \(!granted \|\| granted\.length === 0\) \{[\s\S]*?await rollbackClaim\(\);[\s\S]*?return c\.json\(\{ error: 'ALREADY_CLAIMED'/);
  assert.ok(m, '未命中行分支未调用 rollbackClaim');
});

check('N-05③ 通知写入解构 { error }', () => {
  const m = src.match(/const \{ error: notifErr \} = await supabaseAdmin\.from\('notifications'\)\.insert/);
  assert.ok(m, '通知写入未解构 error');
});

check('N-05③ 通知失败走 console.warn', () => {
  const m = src.match(/if \(notifErr\) \{\s*console\.warn\('⚠️ \[claim-trial\] 通知写入失败:'/);
  assert.ok(m, '通知错误未被记录');
});

// —— 反向断言：旧代码已被移除 ——
check('旧回滚语句已删除', () => {
  assert.doesNotMatch(src, /await supabaseAdmin\.from\('trial_claims'\)\.delete\(\)\.eq\('fingerprint', fingerprint\);/,
    '仍存在只按 fingerprint 删除的旧回滚');
});

check('旧通知 try/catch 已删除', () => {
  assert.doesNotMatch(src, /try \{\s*await supabaseAdmin\.from\('notifications'\)\.insert/,
    '仍存在旧的 try/catch 包裹通知写入');
});

// —— 不变性断言：S-01 主逻辑未被破坏 ——
check('S-01 指纹格式校验仍在', () => assert.match(src, /\/\^\[a-zA-Z0-9_-\]\{10,64\}\$\//));
check('S-01 邮箱已验证检查仍在', () => assert.match(src, /if \(!user\.email_confirmed_at\)/));
check('S-01 SHA-256 归一化仍在', () => assert.match(src, /crypto\.subtle\.digest\('SHA-256'/));
check('S-01 23505 冲突捕获仍在', () => assert.match(src, /claimErr\.code === '23505'/));
check('S-01 原子更新条件完整', () => {
  const m = src.match(/\.eq\('tier', 'free'\)[\s\S]*?\.is\('trial_ends_at', null\)[\s\S]*?\.is\('subscription_ends_at', null\)/);
  assert.ok(m, '原子更新条件缺失');
});

// —— 行数对比（用原始文本，注释也算行）——
const rawLines = raw.split('\n').length;
check(`文件行数合理（原始 ${rawLines} 行，基线 117 + 修复约 10 行）`, () => {
  assert.ok(rawLines >= 120 && rawLines <= 140, `行数异常：${rawLines}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
