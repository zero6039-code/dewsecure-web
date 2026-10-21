// js/app-init.js

function initPage() {
    // 1. 自动高亮导航栏
    const path = window.location.pathname;
    document.querySelectorAll('header nav a').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === path || (path === '/' && href === '/index.html') || (path.includes(href.replace('.html', '')) && href !== '/')) {
            link.classList.add('active');
        }
    });

    // 2. 登录页专属逻辑
    const btnSendOtp = document.getElementById('btnSendOtp');
    if (btnSendOtp && !btnSendOtp.dataset.bound) {
        btnSendOtp.dataset.bound = "true";
        const supabaseClient = window.supabaseClient;
        
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (session) window.location.href = '/dashboard.html';
        });

        const stepEmail = document.getElementById('step-email');
        const stepOtp = document.getElementById('step-otp');
        const emailInput = document.getElementById('emailInput');
        const btnVerifyOtp = document.getElementById('btnVerifyOtp');
        const btnBack = document.getElementById('btnBack');
        const otpInput = document.getElementById('otpInput');
        let currentEmail = '';

        btnSendOtp.addEventListener('click', async () => {
            const t = window.fallbackTranslations || {};
            const email = emailInput.value.trim();
            if (!email || !email.includes('@')) { showError('emailError', t['login_error_email'] || '请输入有效的邮箱地址'); return; }
            btnSendOtp.disabled = true; btnSendOtp.textContent = t['login_sending'] || '正在发送...';
            try {
                const { error } = await supabaseClient.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
                if (error) throw error;
                currentEmail = email;
                document.getElementById('displayEmail').textContent = email;
                stepEmail.classList.add('hidden'); stepOtp.classList.remove('hidden');
                startCountdown(btnSendOtp);
            } catch (err) {
                showError('emailError', err.message || t['login_error_send'] || '发送失败'); 
                btnSendOtp.disabled = false; btnSendOtp.textContent = t['login_btn'] || '使用邮箱登录 (OTP)';
            }
        });

        btnVerifyOtp.addEventListener('click', async () => {
            const t = window.fallbackTranslations || {};
            const token = otpInput.value.trim();
            if (token.length !== 8) { showError('otpError', t['login_error_otp'] || '请输入 8 位验证码'); return; }
            btnVerifyOtp.disabled = true; btnVerifyOtp.textContent = t['login_verifying'] || '正在验证...';
            try {
                const { error } = await supabaseClient.auth.verifyOtp({ email: currentEmail, token, type: 'email' });
                if (error) throw error;
                window.location.href = '/dashboard.html';
            } catch (err) {
                showError('otpError', t['login_error_otp_expired'] || '验证码错误或已过期'); 
                btnVerifyOtp.disabled = false; btnVerifyOtp.textContent = t['login_btn_verify'] || '验证并登录';
            }
        });

        btnBack.addEventListener('click', () => {
            stepOtp.classList.add('hidden'); stepEmail.classList.remove('hidden'); otpInput.value = '';
            btnSendOtp.disabled = false; 
            btnSendOtp.textContent = (window.fallbackTranslations || {})['login_btn'] || '使用邮箱登录 (OTP)';
        });
    }

    // 3. 首页专属逻辑
    if (document.getElementById('ds-title') && !document.getElementById('ds-title').dataset.bound) {
        document.getElementById('ds-title').dataset.bound = "true";
        const browserUrls = { chrome: 'https://chromewebstore.google.com/', edge: 'https://microsoftedge.microsoft.com/', firefox: 'https://addons.mozilla.org/', safari: '#', opera: '#', yandex: '#', android: '#' };
        const browserIcons = { chrome: 'fa-chrome', edge: 'fa-edge', firefox: 'fa-firefox-browser', safari: 'fa-safari', opera: 'fa-opera', yandex: 'fa-yandex', android: 'fa-android' };
        const icons = document.querySelectorAll('.ds-icon');
        const titleEl = document.getElementById('ds-title');
        const descEl = document.getElementById('ds-desc');
        const btnIconEl = document.getElementById('ds-btn-icon');
        const btnTextEl = document.getElementById('ds-btn-text');
        const btnEl = document.getElementById('ds-btn');
        let currentTarget = 'chrome';

        function renderBrowserData(target) {
            currentTarget = target;
            const t = window.fallbackTranslations || {};
            if (!t['dl_' + target + '_title']) return;
            titleEl.textContent = t['dl_' + target + '_title'];
            descEl.textContent = t['dl_' + target + '_desc'];
            descEl.style.opacity = '1'; 
            btnIconEl.innerHTML = '<i class="fa-brands ' + browserIcons[target] + '"></i>';
            btnTextEl.textContent = t['dl_btn_' + target] || ('Download for ' + target);
            btnEl.href = browserUrls[target];
        }

        icons.forEach(icon => {
            icon.addEventListener('click', () => {
                icons.forEach(l => l.classList.remove('active'));
                icon.classList.add('active');
                renderBrowserData(icon.getAttribute('data-target'));
            });
        });
        setTimeout(() => { if (icons.length > 0) icons[0].click(); }, 50);
        window.addEventListener('languageChanged', () => renderBrowserData(currentTarget));
    }

    // 4. 指南页手风琴
    document.querySelectorAll('.accordion-header').forEach(header => {
        if (header.dataset.bound) return;
        header.dataset.bound = "true"; 
        header.addEventListener('click', () => header.parentElement.classList.toggle('active'));
    });

    // 5. Dashboard 业务逻辑
    if (document.getElementById('mainContent') && !document.getElementById('mainContent').dataset.bound) {
        document.getElementById('mainContent').dataset.bound = "true";
        initDashboardLogic();
    }
}

function showError(id, msg) {
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = msg; el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function startCountdown(btn) {
    const t = window.fallbackTranslations || {};
    let countdown = 60; btn.disabled = true;
    const interval = setInterval(() => {
        if (countdown <= 0) { 
            clearInterval(interval); 
            btn.disabled = false; 
            btn.textContent = t['login_btn_resend'] || '重新发送验证码'; 
        } 
        else { 
            btn.textContent = `${t['login_btn_resend'] || '重新发送'} (${countdown}s)`; 
            countdown--; 
        }
    }, 1000);
}

async function initDashboardLogic() {
    const client = window.supabaseClient;
    if (!client) return;
    try {
        const t = window.fallbackTranslations || {};
        const { data: { session } } = await client.auth.getSession();
        if (!session) { window.location.href = '/login.html'; return; }
        const currentUser = session.user;
        const { data: profile } = await client.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
        const currentProfile = profile || { id: currentUser.id, tier: 'free', trial_ends_at: null, invite_success_count: 0 };

        const tierBadge = document.getElementById('tierBadge');
        const daysLeftEl = document.getElementById('daysLeft');
        const expireDateEl = document.getElementById('expireDate');
        const btnCancel = document.getElementById('btnCancelSub');
        const btnUpgrade = document.getElementById('btnUpgrade');
        document.getElementById('inviteCount').textContent = currentProfile.invite_success_count || 0;
        
        tierBadge.classList.remove('skeleton-text');
        let expireDate = currentProfile.trial_ends_at ? new Date(currentProfile.trial_ends_at) : null;
        const now = new Date();
        
        if (currentProfile.tier === 'free') {
            tierBadge.textContent = t['dash_tier_free'] || '免费版 (Free)'; 
            tierBadge.className = 'status-badge'; 
            daysLeftEl.textContent = t['dash_forever'] || '永久有效'; 
            expireDateEl.textContent = '-';
            btnCancel.classList.add('hidden'); btnUpgrade.classList.remove('hidden');
        } else {
            tierBadge.textContent = currentProfile.tier === 'pro' ? (t['dash_tier_pro'] || '高级版 (Pro)') : (t['dash_tier_family'] || '家庭版 (Family)');
            tierBadge.className = 'status-badge status-pro';
            if (expireDate && expireDate > now) {
                const diffDays = Math.ceil(Math.abs(expireDate - now) / (1000 * 60 * 60 * 24)); 
                daysLeftEl.textContent = `${diffDays} ${t['dash_days'] || '天'}`; 
                expireDateEl.textContent = expireDate.toLocaleDateString('zh-CN');
                btnCancel.classList.remove('hidden'); 
                btnUpgrade.textContent = t['dash_btn_renew'] || '续费 / 延长订阅';
            } else {
                daysLeftEl.textContent = t['dash_expired'] || '已过期'; 
                btnCancel.classList.add('hidden'); btnUpgrade.classList.remove('hidden');
            }
        }

        const { data: inviteCode } = await client.from('invitations').select('code').eq('inviter_id', currentProfile.id).eq('status', 'pending').limit(1).maybeSingle();
        if (inviteCode?.code) {
            document.getElementById('myInviteCode').textContent = inviteCode.code;
            document.getElementById('btnGenInvite').classList.add('hidden');
            const copyBtn = document.getElementById('btnCopyInvite');
            copyBtn.classList.remove('hidden');
            copyBtn.onclick = async () => { 
                await navigator.clipboard.writeText(inviteCode.code); 
                copyBtn.textContent = t['dash_copied'] || '已复制!'; 
                setTimeout(() => copyBtn.textContent = t['dash_invite_copy'] || '复制', 2000); 
            };
        }

        // 绑定按钮
        document.getElementById('btnGenInvite').onclick = async () => {
            const btn = document.getElementById('btnGenInvite');
            btn.disabled = true; btn.textContent = t['dash_gen_ing'] || '生成中...';
            const { data, error } = await client.rpc('generate_invitation_code');
            if (error) { alert((t['dash_gen_fail'] || '生成失败: ') + error.message); btn.disabled = false; btn.textContent = t['dash_invite_gen'] || '生成邀请码'; return; }
            document.getElementById('myInviteCode').textContent = data;
            btn.classList.add('hidden');
            const copyBtn = document.getElementById('btnCopyInvite');
            copyBtn.classList.remove('hidden');
            copyBtn.onclick = async () => {
                await navigator.clipboard.writeText(data); 
                copyBtn.textContent = t['dash_copied'] || '已复制!'; 
                setTimeout(() => copyBtn.textContent = t['dash_invite_copy'] || '复制', 2000); 
            };
        };

        // ... 省略弹窗绑定的部分（逻辑一样） ...
        
    } catch (err) { console.error("Dashboard 初始化失败:", err); }
}

document.addEventListener('DOMContentLoaded', () => {
    initPage();
    if (window.Swup) {
        window.swup = new Swup({ containers: ['#swup'] });
        window.swup.hooks.on('page:view', () => {
            initPage();
            if (window.translatePage) window.translatePage();
        });
    }
});
