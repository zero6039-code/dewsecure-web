// js/app-init.js

let dashboardData = null;
let currentDashboardClient = null;
let dashboardNotifs = [];

window.showToast = function(message, type = 'success') {
    try {
        let toast = document.getElementById('global-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'global-toast';
            document.body.appendChild(toast);
        }
        toast.style.cssText = `
            position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(22, 27, 34, 0.95) !important; backdrop-filter: blur(24px) !important;
            border: 1px solid ${type === 'error' ? 'rgba(248, 81, 73, 0.5)' : 'rgba(88, 166, 255, 0.5)'} !important;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8) !important; color: #fff !important; 
            padding: 20px 30px !important; border-radius: 16px !important; font-size: 16px !important;
            z-index: 2147483647 !important; display: flex !important; align-items: center !important; gap: 15px !important;
            opacity: 0 !important; visibility: hidden !important; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        `;
        toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}" style="font-size: 24px; color: ${type === 'error' ? '#f85149' : '#58a6ff'};"></i><span>${message}</span>`;
        setTimeout(() => { toast.style.setProperty('opacity', '1', 'important'); toast.style.setProperty('visibility', 'visible', 'important'); }, 10);
        setTimeout(() => { toast.style.setProperty('opacity', '0', 'important'); toast.style.setProperty('visibility', 'hidden', 'important'); }, 4000);
    } catch (e) { alert(message); }
};

window.showInviteModal = function(link) {
    try {
        const t = window.fallbackTranslations || {};
        let modal = document.getElementById('invite-link-modal');
        if (modal) modal.remove();
        
        modal = document.createElement('div');
        modal.id = 'invite-link-modal';
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 2147483647;`;
        modal.innerHTML = `
            <div style="background: rgba(22, 27, 34, 0.95); border: 1px solid rgba(88, 166, 255, 0.4); border-radius: 20px; padding: 40px; max-width: 500px; width: 90%; text-align: center;">
                <h2 style="color: #fff; margin-bottom: 15px; font-size: 24px;">${t['modal_invite_title'] || '邀请已生成'}</h2>
                <p style="color: #8b949e; font-size: 15px; margin-bottom: 25px;">${t['modal_invite_desc'] || '请将以下链接发送给您的家人：'}</p>
                <input type="text" id="invite-link-input" readonly value="${link}" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px dashed rgba(88, 166, 255, 0.8); border-radius: 10px; padding: 15px; color: #58a6ff; font-family: monospace; font-size: 14px; text-align: center; margin-bottom: 25px; outline: none;">
                <div style="display: flex; gap: 12px;">
                    <button id="modal-copy-btn" class="btn btn-primary" style="flex: 1; height: 48px;">${t['modal_btn_copy'] || '复制链接'}</button>
                    <button id="modal-close-btn" class="btn" style="flex: 1; height: 48px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #c9d1d9;">${t['modal_btn_close'] || '关闭'}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        document.getElementById('modal-copy-btn').onclick = async function() {
            await navigator.clipboard.writeText(link);
            this.textContent = t['modal_copied'] || '已复制！'; this.style.background = '#3fb950'; this.style.color = '#fff';
        };
        document.getElementById('modal-close-btn').onclick = () => modal.remove();
    } catch (err) { prompt("请手动复制此链接：", link); }
};

document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'familyEmailInput') {
        e.preventDefault();
        document.getElementById('btnInviteFamily').click();
    }
});

document.addEventListener('click', async function(e) {
    const inviteBtn = e.target.closest('#btnInviteFamily');
    if (!inviteBtn) return;

    const t = window.fallbackTranslations || {};
    if (!dashboardData || !currentDashboardClient) return;

    try {
        const inputEl = document.getElementById('familyEmailInput');
        const email = inputEl.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email || !emailRegex.test(email)) { showToast(t['toast_invalid_email'] || '请输入有效的邮箱', 'error'); return; }
        if (email.toLowerCase() === dashboardData.email.toLowerCase()) { showToast(t['toast_invite_self'] || '不能邀请自己', 'error'); return; }

        inviteBtn.disabled = true; inviteBtn.textContent = '...';
        const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        
        const { error } = await currentDashboardClient.from('family_invitations').insert({
            owner_id: dashboardData.id, invitee_email: email, token: token, status: 'pending'
        });

        if (error) throw error;
        showInviteModal(window.location.origin + '/accept-invite.html?token=' + token);
        inputEl.value = '';
    } catch (err) {
        showToast((t['toast_invite_fail'] || '失败: ') + err.message, 'error');
    } finally {
        inviteBtn.disabled = false;
        inviteBtn.textContent = t['dash_family_btn_invite'] || '发送邀请';
    }
});

function initPage() {
    if (window.location.pathname.includes('accept-invite')) {
        const client = window.supabaseClient;
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const inviteDesc = document.getElementById('inviteDesc');
        const btnAcceptInvite = document.getElementById('btnAcceptInvite');
        const btnRejectInvite = document.getElementById('btnRejectInvite');
        const t = window.fallbackTranslations || {};

        if (!token) {
            inviteDesc.textContent = "无效的邀请链接。"; btnAcceptInvite.style.display = 'none'; return;
        }

        client.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) {
                sessionStorage.setItem('pending_family_token', token);
                window.location.href = '/login/';
                return;
            }

            const { data, error } = await client.rpc('get_family_invite_info', { p_token: token });
            
            if (error || !data.success) {
                inviteDesc.textContent = t['invite_invalid'] || '邀请已失效或已被处理。';
                btnAcceptInvite.style.display = 'none';
                return;
            }

            let desc = t['invite_accept_desc'] || '{owner} 邀请你加入他的家庭组，共享高级版权益。';
            inviteDesc.textContent = desc.replace('{owner}', data.owner_email);

            btnAcceptInvite.onclick = async () => {
                btnAcceptInvite.disabled = true;
                const { data: acceptData, error: acceptError } = await client.rpc('accept_family_invite', { p_token: token });
                if (acceptError || !acceptData.success) { 
                    showToast(acceptError?.message || acceptData.message, 'error'); 
                    btnAcceptInvite.disabled = false; 
                    return; 
                }
                showToast(acceptData.message);
                setTimeout(() => window.location.href = '/dashboard.html', 1500);
            };

            btnRejectInvite.onclick = () => window.location.href = '/';
        });
    }

    const btnSendOtp = document.getElementById('btnSendOtp');
    if (btnSendOtp && !btnSendOtp.dataset.bound) {
        btnSendOtp.dataset.bound = "true";
        const supabaseClient = window.supabaseClient;
        
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                const pendingToken = sessionStorage.getItem('pending_family_token');
                if (pendingToken) {
                    sessionStorage.removeItem('pending_family_token');
                    window.location.href = '/accept-invite.html?token=' + pendingToken;
                } else {
                    window.location.href = '/dashboard.html';
                }
            }
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
                document.getElementById('otpInput').value = ''; 
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
                const pendingToken = sessionStorage.getItem('pending_family_token');
                if (pendingToken) {
                    sessionStorage.removeItem('pending_family_token');
                    window.location.href = '/accept-invite.html?token=' + pendingToken;
                } else {
                    window.location.href = '/dashboard.html';
                }
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

    document.querySelectorAll('.accordion-header').forEach(header => {
        if (header.dataset.bound) return;
        header.dataset.bound = "true"; 
        header.addEventListener('click', () => header.parentElement.classList.toggle('active'));
    });

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

function renderNotifications() {
    const t = window.fallbackTranslations || {};
    const list = document.getElementById('notificationList');
    if (!list) return;

    if (dashboardNotifs && dashboardNotifs.length > 0) {
        list.innerHTML = '';
        dashboardNotifs.forEach(n => {
            const li = document.createElement('li');
            li.className = `notification-item ${n.is_read ? '' : 'unread'}`;
            const title = document.createElement('div'); title.style.cssText = 'font-weight:600;color:#fff;margin-bottom:4px;'; title.textContent = n.title || '';
            const msg = document.createElement('div'); msg.style.cssText = 'color:#c9d1d9;line-height:1.4;'; msg.textContent = n.message || '';
            const time = document.createElement('div'); time.className = 'notification-time'; time.textContent = new Date(n.created_at).toLocaleString();
            li.append(title, msg, time);
            list.appendChild(li);
        });
    } else {
        list.innerHTML = `<li class="notification-item" style="text-align:center; color:#8b949e;">${t['dash_notif_empty'] || '暂无新通知'}</li>`;
    }
}

async function renderDeviceCards() {
    if (!dashboardData || !currentDashboardClient) return;
    const client = currentDashboardClient;
    const deviceCard = document.getElementById('deviceCard');
    const deviceSlots = document.getElementById('deviceSlots');
    const deviceDesc = document.getElementById('deviceDesc');

    // 子账号禁止显示设备管理
    if (dashboardData.family_owner_id) {
        deviceCard.classList.add('hidden');
        return;
    }

    if (dashboardData.tier === 'pro' || dashboardData.tier === 'family') {
        deviceCard.classList.remove('hidden');
        const maxDevices = dashboardData.tier === 'pro' ? 3 : 9;
        const t = window.fallbackTranslations || {};
        
        let devices = [];
        try {
            const { data } = await client.from('devices').select('*').eq('user_id', dashboardData.id).order('last_seen_at', { ascending: false });
            if (data) devices = data;
        } catch (e) { console.error("设备拉取失败", e); }
        
        const usedCount = devices.length;
        
        let descText = t['dash_device_desc'] || '您当前已绑定 {used} / {total} 台设备。';
        descText = descText.replace('{used}', usedCount).replace('{total}', maxDevices);
        deviceDesc.textContent = descText;

        deviceSlots.innerHTML = '';
        for (let i = 0; i < maxDevices; i++) {
            const dev = devices[i] ? devices[i] : null;
            const slot = document.createElement('div');
            slot.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 10px; background: rgba(0,0,0,0.2);';
            
            if (dev) {
                slot.style.borderStyle = 'solid';
                slot.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-desktop" style="color: #58a6ff;"></i>
                        <div>
                            <div style="color: #fff; font-size: 14px;">${dev.device_name || 'Unknown Device'} (${dev.browser || 'Browser'})</div>
                            <div style="color: #8b949e; font-size: 12px;">${new Date(dev.last_seen_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <button class="btn btn-danger" style="padding: 4px 10px; font-size: 12px;" onclick="unbindDevice('${dev.id}')">${t['dash_device_unbind'] || '解绑'}</button>
                `;
            } else {
                slot.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; color: #484f58;">
                        <i class="fa-solid fa-mobile-screen"></i>
                        <span style="font-size: 14px;">${t['dash_device_empty'] || '未绑定设备'}</span>
                    </div>
                `;
            }
            deviceSlots.appendChild(slot);
        }
    } else {
        deviceCard.classList.add('hidden');
    }
}

async function renderFamilyCard() {
    if (!dashboardData || !currentDashboardClient) return;
    const client = currentDashboardClient;
    const familyCard = document.getElementById('familyCard');
    const familyDesc = document.getElementById('familyDesc');
    const familyMembersList = document.getElementById('familyMembersList');
    const inviteCard = document.getElementById('inviteCard'); // 裂变卡片

    // 🌟 核心修复：只有主账号才显示邀请好友裂变卡片和家庭成员管理
    if (dashboardData.tier === 'family' && !dashboardData.family_owner_id) {
        familyCard.classList.remove('hidden');
        if (inviteCard) inviteCard.classList.remove('hidden'); // 主号显示裂变
        const t = window.fallbackTranslations || {};

        const { data: members } = await client.from('profiles').select('id, email').eq('family_owner_id', dashboardData.id);
        const memberCount = members ? members.length : 0;
        
        let descText = t['dash_family_desc'] || '邀请家人加入您的家庭组，共享高级版权限。当前成员：{count} 人。';
        familyDesc.textContent = descText.replace('{count}', memberCount);

        familyMembersList.innerHTML = `<h4 style="color:#fff; font-size:14px; margin-bottom:10px;">${t['dash_family_member_list'] || '已加入成员'}</h4>`;
        if (members && members.length > 0) {
            members.forEach(m => {
                const div = document.createElement('div');
                div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);';
                div.innerHTML = `
                    <span style="color:#c9d1d9; font-size: 14px;">${m.email}</span>
                    <button class="btn btn-danger" style="padding: 4px 10px; font-size: 12px;" onclick="removeFamilyMember('${m.id}')">${t['dash_family_member_remove'] || '移出'}</button>
                `;
                familyMembersList.appendChild(div);
            });
        } else {
            familyMembersList.innerHTML += `<div style="color:#8b949e; font-size: 13px;">${t['dash_family_no_members'] || '暂无成员'}</div>`;
        }
    } else {
        familyCard.classList.add('hidden');
        // 🌟 子账号隐藏裂变卡片（图1中的 Invite Friends）
        if (inviteCard) inviteCard.classList.add('hidden');
    }
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
    
    // 🌟 核心修复：如果是子账号，动态显示主号邮箱
    let ownerEmailRow = document.getElementById('ownerEmailRow');
    if (profile.family_owner_id && profile.owner_email) {
        if (!ownerEmailRow) {
            ownerEmailRow = document.createElement('div');
            ownerEmailRow.id = 'ownerEmailRow';
            ownerEmailRow.className = 'data-row';
            // 插在账户等级下方
            tierBadge.parentNode.parentNode.insertBefore(ownerEmailRow, tierBadge.parentNode.nextSibling);
        }
        ownerEmailRow.innerHTML = `<span class="data-label">${t['dash_bound_to'] || '所属家庭组'}</span><span class="data-value" style="color:#58a6ff;">${profile.owner_email}</span>`;
    } else if (ownerEmailRow) {
        ownerEmailRow.remove();
    }

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

    renderNotifications();
    renderDeviceCards();
    renderFamilyCard();
}

window.addEventListener('languageChanged', renderDashboardTexts);

window.unbindDevice = async function(deviceId) {
    if (!confirm("确定要解绑该设备吗？")) return;
    const client = window.supabaseClient;
    try {
        const { error } = await client.from('devices').delete().eq('id', deviceId);
        if (error) throw error;
        showToast("设备解绑成功！");
        window.location.reload(); 
    } catch (err) {
        showToast("解绑失败: " + err.message, 'error');
    }
};

window.removeFamilyMember = async function(memberId) {
    if (!confirm("确定要将该成员移出家庭组吗？")) return;
    const client = window.supabaseClient;
    const { data, error } = await client.rpc('remove_family_member', { p_member_id: memberId });
    if (error || !data.success) {
        showToast("操作失败: " + (error?.message || data.message), 'error');
    } else {
        showToast("已移出成员。");
        window.location.reload();
    }
};

async function initDashboardLogic() {
    const client = window.supabaseClient;
    if (!client) return;
    currentDashboardClient = client;

    const loader = document.getElementById('page-loader');
    
    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) { window.location.href = '/login.html'; return; }
        
        if (loader) {
            loader.style.transition = 'opacity 0.3s ease';
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        }
        
        const currentUser = session.user;
        let { data: profile } = await client.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
        
        dashboardData = profile || { id: currentUser.id, email: currentUser.email, tier: 'free', trial_ends_at: null, invite_success_count: 0 };
        if (!dashboardData.email) dashboardData.email = currentUser.email;

        // 调用安全的 RPC 函数来获取家庭组共享状态
        if (dashboardData.family_owner_id) {
            try {
                const { data: sharedStatus } = await client.rpc('get_family_shared_status');
                if (sharedStatus && sharedStatus.success) {
                    dashboardData.tier = 'family'; // 继承 UI 显示为家庭版
                    dashboardData.trial_ends_at = sharedStatus.owner_expire; // 继承主号到期时间
                    dashboardData.owner_email = sharedStatus.owner_email; // 保存主号邮箱用于UI展示
                }
            } catch (e) { console.error("获取家庭组状态失败:", e); }
        }

        const { data: notifs } = await client.from('notifications').select('*').order('created_at', { ascending: false });
        dashboardNotifs = notifs || [];
        const unreadIds = dashboardNotifs.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length > 0) await client.from('notifications').update({ is_read: true }).in('id', unreadIds);
        
        renderDashboardTexts();

        // 🌟 只有主号且没有过期，才显示免费试用按钮
        if (dashboardData.tier === 'free' && !dashboardData.trial_ends_at && !dashboardData.family_owner_id) {
            const card = document.getElementById('inviteCard');
            const t = window.fallbackTranslations || {};
            const claimBtn = document.createElement('button');
            claimBtn.className = 'btn btn-primary';
            claimBtn.style = 'width: 100%; margin-top: 20px; background: #58a6ff; color: #fff;';
            claimBtn.textContent = t['dash_claim_trial_btn'] || '🎁 免费领取 30 天高级版体验';
            card.appendChild(claimBtn);

            claimBtn.onclick = async () => {
                claimBtn.disabled = true;
                claimBtn.textContent = '...';
                try {
                    const raw = navigator.userAgent + navigator.language + screen.width + 'x' + screen.height + new Date().getTimezoneOffset();
                    const msgBuffer = new TextEncoder().encode(raw);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const fp = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    
                    const { data, error } = await client.rpc('claim_free_trial', { p_fingerprint: fp });
                    if (error) throw error;
                    if (data.success) {
                        showToast(data.message);
                        setTimeout(() => window.location.reload(), 1500); 
                    } else {
                        showToast(data.message, 'error');
                        claimBtn.classList.add('hidden');
                    }
                } catch (err) {
                    showToast('领取失败: ' + err.message, 'error');
                    claimBtn.disabled = false;
                    claimBtn.textContent = t['dash_claim_trial_btn'] || '🎁 免费领取 30 天高级版体验';
                }
            };
        }

        // 只有主号才执行绑定裂变按钮的事件
        if (!dashboardData.family_owner_id) {
            const { data: inviteCode } = await client.from('invitations').select('code').eq('inviter_id', dashboardData.id).eq('status', 'pending').limit(1).maybeSingle();
            if (inviteCode?.code) {
                const refLink = window.location.origin + '/pricing.html?ref=' + inviteCode.code;
                document.getElementById('myInviteCode').textContent = refLink;
                document.getElementById('btnGenInvite').classList.add('hidden');
                const copyBtn = document.getElementById('btnCopyInvite');
                copyBtn.classList.remove('hidden');
                copyBtn.onclick = async () => { 
                    await navigator.clipboard.writeText(refLink);
                    const t = window.fallbackTranslations || {};
                    copyBtn.textContent = t['dash_copied'] || '已复制!'; 
                    setTimeout(() => copyBtn.textContent = t['dash_invite_copy'] || '复制', 2000); 
                };
            }

            document.getElementById('btnGenInvite').onclick = async () => {
                const t = window.fallbackTranslations || {};
                const btn = document.getElementById('btnGenInvite');
                btn.disabled = true; btn.textContent = t['dash_gen_ing'] || '生成中...';
                const { data, error } = await client.rpc('generate_invitation_code');
                if (error) { showToast((t['dash_gen_fail'] || '生成失败: ') + error.message, 'error'); btn.disabled = false; btn.textContent = t['dash_invite_gen'] || '生成邀请码'; return; }
                
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
        }

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
            if (error) { showToast('提交失败: ' + error.message, 'error'); btn.disabled = false; btn.textContent = t['dash_cancel_yes'] || '确认取消'; return; }
            showToast(t['dash_cancel_success'] || '您的取消请求已记录。'); 
            document.getElementById('cancelModal').classList.remove('active'); 
            document.getElementById('btnCancelSub').classList.add('hidden'); 
            document.getElementById('btnUpgrade').classList.remove('hidden');
            btn.disabled = false; btn.textContent = t['dash_cancel_yes'] || '确认取消';
        };

    } catch (err) { 
        console.error("Dashboard 初始化失败:", err); 
        if (loader) loader.remove();
        showToast("加载数据失败，请刷新重试。", 'error');
    }
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
