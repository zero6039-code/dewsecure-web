// js/auth-nav.js
const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
const supabaseGlobal = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  // 1. 注入强制 CSS，修复换行问题
  const style = document.createElement('style');
  style.textContent = `
    header { 
      display: flex !important; 
      flex-wrap: nowrap !important; 
      align-items: center !important; 
      justify-content: space-between !important; 
    }
    header nav { 
      flex-shrink: 1; 
      overflow-x: auto; 
      white-space: nowrap; 
      scrollbar-width: none; /* 隐藏滚动条 */
    }
    header nav::-webkit-scrollbar { display: none; }
    .lang-switch { flex-shrink: 0 !important; }
  `;
  document.head.appendChild(style);

  // 2. 准备右侧用户区域
  const langSwitch = document.querySelector('.lang-switch');
  if (!langSwitch) return;

  let authArea = document.getElementById('global-auth-area');
  if (!authArea) {
    authArea = document.createElement('div');
    authArea.id = 'global-auth-area';
    authArea.style.cssText = 'display: flex; align-items: center; gap: 12px; flex-shrink: 0; margin-left: 20px;';
    // 插在语言切换器前面
    langSwitch.parentNode.insertBefore(authArea, langSwitch);
  }

  // 3. 隐藏原本写死的“登录”导航项 (如果有)
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(a => {
    if (a.href.includes('/login') || a.getAttribute('data-i18n') === 'nav_login') {
      a.style.display = 'none';
    }
  });

  // 4. 监听状态并渲染
  supabaseGlobal.auth.onAuthStateChange((event, session) => {
    if (session) {
      const rawEmail = session.user.email;
      // 邮箱过长截断
      const displayEmail = rawEmail.length > 15 ? rawEmail.substring(0, 12) + '...' : rawEmail;

      authArea.innerHTML = `
        <span title="${rawEmail}" style="color: #8b949e; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${displayEmail}</span>
        <a href="/dashboard.html" style="color: #58a6ff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">控制台</a>
        <button id="global-logout-btn" style="background: rgba(248, 81, 73, 0.1); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; white-space: nowrap; transition: 0.2s;">退出</button>
      `;
      
      document.getElementById('global-logout-btn').onclick = async () => {
        await supabaseGlobal.auth.signOut();
        window.location.href = '/'; // 退出后跳回首页
      };
    } else {
      authArea.innerHTML = `
        <a href="/login.html" style="color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">登录</a>
      `;
    }
  });
});
