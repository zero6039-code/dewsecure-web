// js/auth-nav.js
const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
const supabaseGlobal = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector('header');
  if (!header) return;

  // 1. 注入全局 Header 布局样式
  const style = document.createElement('style');
  style.textContent = `
    /* 锁定 Header 为 Flex 布局，禁止整体换行 */
    header {
      display: flex !important;
      flex-wrap: nowrap !important;
      justify-content: space-between !important;
      align-items: center !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    /* 左侧 Logo 不压缩 */
    header .logo {
      display: flex !important;
      flex-shrink: 0 !important;
      align-items: center !important;
    }

    /* 中间导航区：不隐藏，允许横向滚动 */
    header nav {
      display: flex !important;
      align-items: center !important;
      gap: 20px !important;
      flex-shrink: 1 !important;
      overflow-x: auto !important;      /* 关键：内容过多时允许横向滑动 */
      white-space: nowrap !important;
      scrollbar-width: none !important;
      margin: 0 auto !important;
    }
    header nav::-webkit-scrollbar { display: none !important; }
    header nav a { white-space: nowrap !important; }

    /* 右侧用户区：固定在最右，永不压缩 */
    header .header-right {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      flex-shrink: 0 !important;
      margin-left: 15px !important;
    }

    /* 仅在小屏幕上适当缩小间距，确保不换行，但导航依然可见 */
    @media (max-width: 768px) {
      header nav { gap: 12px !important; }
      header .header-right { gap: 8px !important; }
    }
  `;
  document.head.appendChild(style);

  // 2. 将语言切换器移动到统一的右侧容器
  let headerRight = header.querySelector('.header-right');
  if (!headerRight) {
    headerRight = document.createElement('div');
    headerRight.className = 'header-right';
    header.appendChild(headerRight);
    
    const langSwitch = header.querySelector('.lang-switch');
    if (langSwitch) headerRight.appendChild(langSwitch);
  }

  // 3. 准备用户状态区域（插入到地球图标左侧）
  let authArea = document.getElementById('global-auth-area');
  if (!authArea) {
    authArea = document.createElement('div');
    authArea.id = 'global-auth-area';
    authArea.style.cssText = 'display: flex; align-items: center; gap: 12px; flex-shrink: 0;';
    
    const langSwitch = headerRight.querySelector('.lang-switch');
    if (langSwitch) {
      headerRight.insertBefore(authArea, langSwitch);
    } else {
      headerRight.appendChild(authArea);
    }
  }

  // 4. 隐藏静态 HTML 中写死的“登录”链接
  header.querySelectorAll('nav a').forEach(a => {
    if (a.href.includes('/login') || a.getAttribute('data-i18n') === 'nav_login') {
      a.style.display = 'none';
    }
  });

  // 5. 渲染登录状态
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
      authArea.innerHTML = `<a href="/login.html" style="color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">登录</a>`;
    }
  });
});
