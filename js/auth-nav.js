// js/auth-nav.js
const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
const supabaseGlobal = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector('header');
  if (!header) return;

  // 1. 注入最高优先级的 CSS，强行锁定导航栏布局
  const style = document.createElement('style');
  style.textContent = `
    /* 锁定整个 header，禁止换行，强制水平排列 */
    header {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: space-between !important;
      flex-wrap: nowrap !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    /* Logo 永远在最左边，不收缩 */
    header .logo {
      display: flex !important;
      flex-shrink: 0 !important;
      margin-right: 20px !important;
    }

    /* 中间导航区域允许适度收缩，防止撑破 */
    header nav {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 20px !important;
      flex-shrink: 1 !important;
      overflow-x: auto !important;
      white-space: nowrap !important;
      scrollbar-width: none !important;
      margin: 0 auto !important; /* 居中 */
    }
    header nav::-webkit-scrollbar { display: none !important; }
    header nav a { white-space: nowrap !important; }

    /* 右侧容器（用户状态 + 地球图标）强制定在最右侧 */
    header .header-right {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 15px !important;
      flex-shrink: 0 !important;
      margin-left: 20px !important;
    }

    /* 屏幕极窄时（手机端），自动隐藏中间的导航，防止挤压右侧 */
    @media (max-width: 950px) {
      header nav { display: none !important; }
    }
  `;
  document.head.appendChild(style);

  // 2. 把原本散落的 lang-switch 统一装进右侧容器
  let headerRight = header.querySelector('.header-right');
  if (!headerRight) {
    headerRight = document.createElement('div');
    headerRight.className = 'header-right';
    
    const langSwitch = header.querySelector('.lang-switch');
    if (langSwitch) {
      header.appendChild(headerRight); // 先加到 header 末尾
      headerRight.appendChild(langSwitch); // 再把地球图标挪进去
    } else {
      header.appendChild(headerRight);
    }
  }

  // 3. 准备用户状态区域
  let authArea = document.getElementById('global-auth-area');
  if (!authArea) {
    authArea = document.createElement('div');
    authArea.id = 'global-auth-area';
    authArea.style.cssText = 'display: flex; align-items: center; gap: 12px;';
    
    const langSwitch = headerRight.querySelector('.lang-switch');
    if (langSwitch) {
      headerRight.insertBefore(authArea, langSwitch); // 放在地球图标左侧
    } else {
      headerRight.appendChild(authArea);
    }
  }

  // 4. 隐藏原本写死的“登录”链接
  const navLinks = header.querySelectorAll('nav a');
  navLinks.forEach(a => {
    if (a.href.includes('/login') || a.getAttribute('data-i18n') === 'nav_login') {
      a.style.display = 'none';
    }
  });

  // 5. 渲染登录状态
  supabaseGlobal.auth.onAuthStateChange((event, session) => {
    if (session) {
      const rawEmail = session.user.email;
      const displayEmail = rawEmail.length > 15 ? rawEmail.substring(0, 12) + '...' : rawEmail;

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
      authArea.innerHTML = `
        <a href="/login.html" style="color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">登录</a>
      `;
    }
  });
});
