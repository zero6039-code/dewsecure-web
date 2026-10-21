// js/auth-nav.js
const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
const supabaseGlobal = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 监听全局登录状态变化
supabaseGlobal.auth.onAuthStateChange((event, session) => {
  // 找到导航栏里的语言切换器，我们把登录状态插在它左边
  const langSwitch = document.querySelector('.lang-switch');
  if (!langSwitch) return;

  // 检查是否已经创建了用户状态区域
  let authArea = document.getElementById('global-auth-area');
  if (!authArea) {
    authArea = document.createElement('div');
    authArea.id = 'global-auth-area';
    authArea.style.cssText = 'display: flex; align-items: center; gap: 15px; margin-right: 15px; flex-shrink: 0;';
    langSwitch.parentNode.insertBefore(authArea, langSwitch);
  }

  if (session) {
    // 已登录状态
    authArea.innerHTML = `
      <span style="color: #8b949e; font-size: 14px; white-space: nowrap;">${session.user.email}</span>
      <a href="/dashboard.html" style="color: #58a6ff; text-decoration: none; font-size: 14px; white-space: nowrap;">控制台</a>
      <button id="global-logout-btn" style="background: rgba(248, 81, 73, 0.1); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; white-space: nowrap;">退出</button>
    `;
    // 绑定退出按钮事件
    document.getElementById('global-logout-btn').onclick = async () => {
      await supabaseGlobal.auth.signOut();
      window.location.reload(); // 刷新当前页面
    };
  } else {
    // 未登录状态
    authArea.innerHTML = `
      <a href="/login.html" style="color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">登录</a>
    `;
  }
});
