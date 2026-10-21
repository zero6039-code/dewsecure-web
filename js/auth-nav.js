// js/auth-nav.js
const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
const supabaseGlobal = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  // 只负责隐藏静态 HTML 里的“登录”按钮
  document.querySelectorAll('nav a').forEach(a => {
    if (a.href.includes('/login') || a.getAttribute('data-i18n') === 'nav_login') {
      a.style.display = 'none';
    }
  });

  // 找到需要插入状态的容器（主页会自动创建，dashboard 会写死）
  let authArea = document.getElementById('global-auth-area');
  if (!authArea) {
    // 其他页面的备用方案
    const langSwitch = document.querySelector('.lang-switch');
    if (langSwitch) {
      authArea = document.createElement('div');
      authArea.id = 'global-auth-area';
      authArea.style.cssText = 'display: flex; align-items: center; gap: 12px; flex-shrink: 0; margin-right: 20px;';
      langSwitch.parentNode.insertBefore(authArea, langSwitch);
    }
  }

  if (!authArea) return;

  // 监听并渲染状态
  supabaseGlobal.auth.onAuthStateChange((event, session) => {
    if (session) {
      const rawEmail = session.user.email;
      const displayEmail = rawEmail.length > 12 ? rawEmail.substring(0, 10) + '...' : rawEmail;

      authArea.innerHTML = `
        <span title="${rawEmail}" style="color: #8b949e; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;">${displayEmail}</span>
        <a href="/dashboard.html" style="color: #58a6ff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">控制台</a>
        <button id="global-logout-btn" style="background: rgba(248, 81, 73, 0.1); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3); padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; white-space: nowrap; transition: 0.2s;">退出</button>
      `;
      
      document.getElementById('global-logout-btn').onclick = async () => {
        await supabaseGlobal.auth.signOut();
        window.location.href = '/'; 
      };
    } else {
      authArea.innerHTML = `
        <a href="/login.html" style="color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">登录</a>
      `;
    }
  });
});
