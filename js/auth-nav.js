// js/auth-nav.js
const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
const supabaseGlobal = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  const langSwitch = document.querySelector('.lang-switch');
  if (!langSwitch) return;

  // 1. 隐藏原本写死的“登录”链接
  document.querySelectorAll('nav a').forEach(a => {
    if (a.href.includes('/login') || a.getAttribute('data-i18n') === 'nav_login') {
      a.style.display = 'none';
    }
  });

  // 2. 在地球图标前面创建一个用户状态容器
  let authArea = document.getElementById('global-auth-area');
  if (!authArea) {
    authArea = document.createElement('div');
    authArea.id = 'global-auth-area';
    authArea.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-right: 15px; flex-shrink: 0;';
    langSwitch.parentNode.insertBefore(authArea, langSwitch);
  }

  // 3. 渲染登录状态
  supabaseGlobal.auth.onAuthStateChange((event, session) => {
    if (session) {
      const rawEmail = session.user.email;
      const displayEmail = rawEmail.length > 15 ? rawEmail.substring(0, 12) + '...' : rawEmail;
      
      // 自动高亮控制台菜单（如果在 dashboard 页面）
      if (window.location.pathname.includes('dashboard')) {
        const navDash = document.querySelector('nav a[href="/dashboard.html"]');
        if (navDash) navDash.style.display = 'block';
      }

      authArea.innerHTML = `
        <span title="${rawEmail}" style="color: #8b949e; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${displayEmail}</span>
        <a href="/dashboard.html" style="color: #58a6ff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">控制台</a>
        <button id="global-logout-btn" style="background: rgba(248, 81, 73, 0.1); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; white-space: nowrap; transition: 0.2s;">退出</button>
      `;
      
      document.getElementById('global-logout-btn').onclick = async () => {
        await supabaseGlobal.auth.signOut();
        window.location.href = '/'; 
      };
    } else {
      authArea.innerHTML = `<a href="/login.html" style="color: #58a6ff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">登录</a>`;
    }
  });
});
