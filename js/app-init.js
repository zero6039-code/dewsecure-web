// js/app-init.js

let dashboardData = null;

function initPage() {
    const path = window.location.pathname;
    document.querySelectorAll('header nav a').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === path || (path === '/' && href === '/index.html') || (path.includes(href.replace('.html', '')) && href !== '/')) {
            link.classList.add('active');
        }
    });

    // 登录页逻辑
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

        emailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); btnSendOtp.click(); } });
        otpInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); btnVerifyOtp.click(); } });

        btnBack.addEventListener('click', () => {
            stepOtp.classList.add('hidden'); stepEmail.classList.remove('hidden'); otpInput.value = '';
            btnSendOtp.disabled = false; 
            btnSendOtp.textContent = (window.fallbackTranslations || {})['login_btn'] || '使用邮箱登录 (OTP)';
        });
    }

    // 首页逻辑
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

    // 指南页手风琴
    document.querySelectorAll('.accordion-header').forEach(header => {
        if (header.dataset.bound) return;
        header.dataset.bound = "true"; 
        header.addEventListener('click', () => header.parentElement.classList.toggle('active'));
    });

    // Dashboard 逻辑
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

function renderDashboardTexts() {
    if (!dashboardData) return;
    const t = window.fallbackTranslations || {};
    const profile = dashboardData;

    const tierBadge = document.getElementById('tierBadge');
    const daysLeftEl = document.getElementById('daysLeft');
    const expireDateEl = document.getElementById('expireDate');
    const btnCancel = document.getElementById('btnCancelSub');
    const btnUpgrade = document.getElementById('btnUpgrade');

    document.getElementById('inviteCount').textContent = profile.invite_success_count || 0;
    
    tierBadge.classList.remove('skeleton-text');
    let expireDate = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const now = new Date();
    
    if (profile.tier === 'free') {
        tierBadge.textContent = t['dash_tier_free'] || '免费版 (Free)'; 
        tierBadge.className = 'status-badge'; 
        daysLeftEl.textContent = t['dash_forever'] || '永久有效'; 
        expireDateEl.textContent = '-';
        btnCancel.classList.add('hidden'); 
        btnUpgrade.classList.remove('hidden');
        if(btnUpgrade) btnUpgrade.textContent = t['dash_btn_upgrade'] || '升级/续费高级版';
    } else {
        tierBadge.textContent = profile.tier === 'pro' ? (t['dash_tier_pro'] || '高级版 (Pro)') : (t['dash_tier_family'] || '家庭版 (Family)');
        tierBadge.className = 'status-badge status-pro';
        if (expireDate && expireDate > now) {
            const diffDays = Math.ceil(Math.abs(expireDate - now) / (1000 * 60 * 60 * 24)); 
            daysLeftEl.textContent = `${diffDays} ${t['dash_days'] || '天'}`; 
            expireDateEl.textContent = expireDate.toLocaleDateString('zh-CN');
            btnCancel.classList.remove('hidden'); 
            if(btnUpgrade) btnUpgrade.textContent = t['dash_btn_renew'] || '续费 / 延长订阅';
            if(btnCancel) btnCancel.textContent = t['dash_btn_cancel'] || '取消订阅';
        } else {
            daysLeftEl.textContent = t['dash_expired'] || '已过期'; 
            btnCancel.classList.add('hidden'); 
            btnUpgrade.classList.remove('hidden');
            if(btnUpgrade) btnUpgrade.textContent = t['dash_btn_upgrade'] || '升级/续费高级版';
        }
    }
}

window.addEventListener('languageChanged', renderDashboardTexts);

async function initDashboardLogic() {
    const client = window.supabaseClient;
    if (!client) return;
    try {
        const { data: { session } } = await client.auth.getSession();
        // 🌟 如果没登录，直接踢回登录页（此时页面是 hidden 的，用户绝对看不到任何闪烁）
        if (!session) { 
            window.location.href = '/login.html';
            return; 
        }
        // 🌟 核心修复：验证通过，立刻让页面显形！
        document.querySelector('main').style.display = 'block';
            
        const currentUser = session.user;
        const { data: profile } = await client.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
        
        dashboardData = profile || { id: currentUser.id, tier: 'free', trial_ends_at: null, invite_success_count: 0 };
        renderDashboardTexts();

        // 防白嫖指纹领取逻辑
        async function getFingerprint() {
            const raw = navigator.userAgent + navigator.language + screen.width + 'x' + screen.height + new Date().getTimezoneOffset();
            const msgBuffer = new TextEncoder().encode(raw);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        if (dashboardData.tier === 'free' && !dashboardData.trial_ends_at) {
            const card = document.getElementById('inviteCard');
            const claimBtn = document.createElement('button');
            claimBtn.className = 'btn btn-primary';
            claimBtn.style = 'width: 100%; margin-top: 20px; background: #58a6ff; color: #fff;';
            claimBtn.textContent = '🎁 免费领取 30 天高级版体验';
            card.appendChild(claimBtn);

            claimBtn.onclick = async () => {
                claimBtn.disabled = true;
                claimBtn.textContent = '正在验证设备...';
                try {
                    const fp = await getFingerprint();
                    const { data, error } = await client.rpc('claim_free_trial', { p_fingerprint: fp });
                    if (error) throw error;
                    if (data.success) {
                        alert(data.message);
                        window.location.reload(); 
                    } else {
                        alert(data.message);
                        claimBtn.classList.add('hidden');
                    }
                } catch (err) {
                    alert('领取失败: ' + err.message);
                    claimBtn.disabled = false;
                    claimBtn.textContent = '🎁 重新领取 30 天';
                }
            };
        }

        // 🌟 核心修改：生成并显示专属推广链接
        const { data: inviteCode } = await client.from('invitations').select('code').eq('inviter_id', dashboardData.id).eq('status', 'pending').limit(1).maybeSingle();
        if (inviteCode?.code) {
            const refLink = window.location.origin + '/pricing.html?ref=' + inviteCode.code;
            document.getElementById('myInviteCode').textContent = refLink; // 直接显示链接
            document.getElementById('btnGenInvite').classList.add('hidden');
            const copyBtn = document.getElementById('btnCopyInvite');
            copyBtn.classList.remove('hidden');
            copyBtn.onclick = async () => { 
                await navigator.clipboard.writeText(refLink); // 复制链接
                const t = window.fallbackTranslations || {};
                copyBtn.textContent = t['dash_copied'] || '已复制!'; 
                setTimeout(() => copyBtn.textContent = t['dash_invite_copy'] || '复制', 2000); 
            };
        }

        // 绑定生成事件
        document.getElementById('btnGenInvite').onclick = async () => {
            const t = window.fallbackTranslations || {};
            const btn = document.getElementById('btnGenInvite');
            btn.disabled = true; btn.textContent = t['dash_gen_ing'] || '生成中...';
            const { data, error } = await client.rpc('generate_invitation_code');
            if (error) { alert((t['dash_gen_fail'] || '生成失败: ') + error.message); btn.disabled = false; btn.textContent = t['dash_invite_gen'] || '生成邀请码'; return; }
            
            const refLink = window.location.origin + '/pricing.html?ref=' + data;
            document.getElementById('myInviteCode').textContent = refLink;
            btn.classList.add('hidden');
            const copyBtn = document.getElementById('btnCopyInvite');
            copyBtn.classList.remove('hidden');
            copyBtn.onclick = async () => {
                await navigator.clipboard.writeText(refLink); 
                copyBtn.textContent = t['dash_copied'] || '已复制!'; 
                setTimeout(() => copyBtn.textContent = t['dash_invite_copy'] || '复制', 2000); 
            };
        };

        // 拉取通知
        const { data: notifs } = await client.from('notifications').select('*').order('created_at', { ascending: false });
        const list = document.getElementById('notificationList');
        if (notifs && notifs.length > 0) {
            list.innerHTML = '';
            const unreadIds = [];
            const t = window.fallbackTranslations || {};
            notifs.forEach(n => {
                if (!n.is_read) unreadIds.push(n.id);
                const li = document.createElement('li');
                li.className = `notification-item ${n.is_read ? '' : 'unread'}`;
                const title = document.createElement('div'); title.style.cssText = 'font-weight:600;color:#fff;margin-bottom:4px;'; title.textContent = n.title || '';
                const msg = document.createElement('div'); msg.style.cssText = 'color:#c9d1d9;line-height:1.4;'; msg.textContent = n.message || '';
                const time = document.createElement('div'); time.className = 'notification-time'; time.textContent = new Date(n.created_at).toLocaleString();
                li.append(title, msg, time);
                list.appendChild(li);
            });
            if (unreadIds.length > 0) await client.from('notifications').update({ is_read: true }).in('id', unreadIds);
        } else {
            const t = window.fallbackTranslations || {};
            list.innerHTML = `<li class="notification-item" style="text-align:center; color:#8b949e;">${t['dash_notif_empty'] || '暂无新通知'}</li>`;
        }

        // 取消订阅逻辑
        document.getElementById('btnCancelSub').onclick = () => document.getElementById('cancelModal').classList.add('active');
        document.getElementById('btnCloseModal').onclick = () => document.getElementById('cancelModal').classList.remove('active');
        document.getElementById('btnConfirmCancel').onclick = async () => {
            const btn = document.getElementById('btnConfirmCancel');
            const reason = document.getElementById('cancelReason').value.trim();
            btn.disabled = true; 
            const t = window.fallbackTranslations || {};
            btn.textContent = t['dash_cancel_processing'] || '处理中...';
            const { error } = await client.from('reports').insert({
                user_id: currentUser.id, reporter_email: currentUser.email, report_type: 'other', url: 'Cancel Sub', description: `[取消原因] ${reason || '未填写'}`
            });
            if (error) { alert('提交失败: ' + error.message); btn.disabled = false; btn.textContent = t['dash_cancel_yes'] || '确认取消'; return; }
            alert(t['dash_cancel_success'] || '您的取消请求已记录。'); 
            document.getElementById('cancelModal').classList.remove('active'); 
            document.getElementById('btnCancelSub').classList.add('hidden'); 
            document.getElementById('btnUpgrade').classList.remove('hidden');
            btn.disabled = false; btn.textContent = t['dash_cancel_yes'] || '确认取消';
        };

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
