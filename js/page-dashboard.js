// ==========================================
// 📁 page-dashboard.js (最终容错版)
// ==========================================

import { initDevicesUI } from './page-devices.js';
import { initFamilyUI } from './page-family.js';
import { fetchDashboardData } from './dashboard-fetcher.js';
import { pushAuthStateToExtension } from './dashboard-sync.js';

let dashboardData = null;
let currentDashboardClient = null;
let dashboardNotifs = [];

const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') ? 'http://127.0.0.1:8787' : '';

export async function initDashboardLogic() {
    const client = window.supabaseClient;
    if (!client) return;
    currentDashboardClient = client;

    const loader = document.getElementById('page-loader');
    
    try {
        let session = null;
        const { data } = await client.auth.getSession();
        session = data.session;

        if (!session) {
            await new Promise((resolve) => {
                const { data: { subscription } } = client.auth.onAuthStateChange((event, newSession) => {
                    if (newSession) {
                        session = newSession;
                        subscription.unsubscribe();
                        resolve();
                    }
                });
                setTimeout(() => { subscription.unsubscribe(); resolve(); }, 2000);
            });
        }

        const urlParams = new URLSearchParams(window.location.search);
        const hasTokenInUrl = urlParams.get('token');
        const isCheckoutSuccess = urlParams.get('checkout') === 'success';
        
        if (!session && !hasTokenInUrl) { window.location.href = '/login/'; return; }
        if (!session && hasTokenInUrl) { window.location.reload(); return; }
        
        if (isCheckoutSuccess) {
            const t = window.fallbackTranslations || {};
            if (window.showToast) window.showToast(t['dash_syncing'] || 'Syncing payment status...', 'success');
            await new Promise(r => setTimeout(r, 2500));
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        if (loader) {
            loader.style.transition = 'opacity 0.3s ease';
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        }
        
        const currentUser = session.user;
        const dataResult = await fetchDashboardData(client, currentUser);
        dashboardData = dataResult.dashboardData;
        dashboardNotifs = dataResult.dashboardNotifs;

        renderDashboardTexts();
        bindDashboardButtons(currentUser);
        pushAuthStateToExtension(session, dashboardData);

    } catch (err) { 
        console.error("Dashboard 初始化失败:", err); 
        if (loader) loader.remove();
        window.showToast("加载数据失败，请刷新重试。", 'error');
    }
}

function bindDashboardButtons(currentUser) {
    const client = currentDashboardClient;
    const getT = () => window.fallbackTranslations || {};
    
    // 1. 邀请好友
    if (!dashboardData.family_owner_id) {
        const btnGen = document.getElementById('btnGenInvite');
        if (btnGen) {
            btnGen.onclick = async () => {
                const t = getT();
                btnGen.disabled = true; btnGen.textContent = t['dash_gen_ing'] || '生成中...';
                const { data, error } = await client.rpc('generate_invitation_code');
                if (error) { window.showToast((t['dash_gen_fail'] || '生成失败: ') + error.message, 'error'); btnGen.disabled = false; btnGen.textContent = t['dash_invite_gen'] || '获取我的专属推广链接'; return; }
                
                const refLink = window.location.origin + '/pricing.html?ref=' + data;
                document.getElementById('myInviteCode').textContent = refLink;
                btnGen.classList.add('hidden');
                const copyBtn = document.getElementById('btnCopyInvite');
                copyBtn.classList.remove('hidden');
                copyBtn.onclick = async () => {
                    await navigator.clipboard.writeText(refLink); 
                    copyBtn.textContent = t['dash_copied'] || '已复制!'; 
                    setTimeout(() => copyBtn.textContent = t['dash_invite_copy'] || '复制', 2000); 
                };
            };
        }
    }

    // 2. 领取 30 天试用
    const btnClaimTrial = document.getElementById('btnClaimTrial');
    if (btnClaimTrial) {
        btnClaimTrial.onclick = async () => {
            const t = getT();
            btnClaimTrial.disabled = true;
            btnClaimTrial.textContent = t['dash_cancel_processing'] || '处理中...';
            try {
                const { data: { session } } = await client.auth.getSession();
                const res = await fetch(API_BASE + '/api/claim-trial', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }
                });
                if (!res.ok) throw new Error('Failed');
                window.showToast(t['dash_trial_success'] || '领取成功！', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (e) {
                window.showToast(t['dash_trial_fail'] || '领取失败，请重试', 'error');
                btnClaimTrial.disabled = false;
                btnClaimTrial.textContent = t['dash_btn_claim_trial'] || '领取试用';
            }
        };
    }

    // 3. 管理订阅
    const btnManageSub = document.getElementById('btnManageSub');
    if (btnManageSub) {
        btnManageSub.onclick = async () => {
            const t = getT();
            if (!dashboardData.stripe_customer_id) {
                window.location.href = '/pricing.html';
                return;
            }

            btnManageSub.disabled = true;
            btnManageSub.textContent = t['dash_cancel_processing'] || '处理中...';
            try {
                const { data: { session } } = await client.auth.getSession();
                const res = await fetch(API_BASE + '/api/portal', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
                else throw new Error('No portal URL');
            } catch (err) {
                window.showToast('无法打开管理页面', 'error');
                btnManageSub.disabled = false;
                btnManageSub.textContent = t['dash_btn_manage'] || '管理订阅';
            }
        };
    }

    // 4. 取消订阅
    const btnCancelSub = document.getElementById('btnCancelSub');
    if (btnCancelSub) {
        btnCancelSub.onclick = () => {
            const t = getT();
            const expireDateStr = dashboardData.subscription_ends_at ? new Date(dashboardData.subscription_ends_at).toLocaleDateString() : '未知';
            const tip = (t['dash_cancel_tip'] || '您的权益将持续到 {date}。').replace('{date}', expireDateStr);
            document.getElementById('cancelTip').textContent = tip;
            document.getElementById('cancelModal').classList.add('active');
        };
        
        document.getElementById('btnCloseModal').onclick = () => document.getElementById('cancelModal').classList.remove('active');
        
        document.getElementById('btnConfirmCancel').onclick = async () => {
            const t = getT();
            const btn = document.getElementById('btnConfirmCancel');
            const reason = document.getElementById('cancelReason').value.trim();
            btn.disabled = true; 
            btn.textContent = t['dash_cancel_processing'] || '处理中...';
            
            try {
                const { data: { session } } = await client.auth.getSession();
                const res = await fetch(API_BASE + '/api/cancel', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason })
                });
                
                if (!res.ok) throw new Error('Failed to cancel');
                
                window.showToast(t['dash_cancel_success'] || '您的取消请求已成功记录。'); 
                document.getElementById('cancelModal').classList.remove('active'); 
                btnCancelSub.classList.add('hidden'); 
                document.getElementById('btnUpgrade').classList.remove('hidden');
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                window.showToast(t['dash_cancel_fail'] || '取消失败，请稍后再试。', 'error');
                btn.disabled = false; btn.textContent = t['dash_cancel_yes'] || '确认取消'; 
            }
        };
    }

    // 5. 恢复自动续费
    const btnUpgrade = document.getElementById('btnUpgrade');
    if (btnUpgrade && dashboardData.cancel_at_period_end) {
        btnUpgrade.onclick = async () => {
            const t = getT();
            btnUpgrade.disabled = true;
            btnUpgrade.textContent = t['dash_cancel_processing'] || '处理中...';
            try {
                const { data: { session } } = await client.auth.getSession();
                const res = await fetch(API_BASE + '/api/resume', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }
                });
                if (!res.ok) throw new Error('Failed');
                window.showToast(t['dash_resume_success'] || '恢复成功！', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (e) {
                window.showToast(t['dash_resume_fail'] || '操作失败，请重试', 'error');
                btnUpgrade.disabled = false;
                btnUpgrade.textContent = t['dash_btn_resume'] || '恢复自动续费';
            }
        };
    }

    // 6. 退出家庭组
    const btnLeave = document.getElementById('btnLeaveFamily');
    if (btnLeave) {
        btnLeave.onclick = () => {
            const t = getT();
            window.showGlassConfirm(
                t['dash_leave_family_title'] || '退出家庭组', 
                t['dash_leave_family_desc'] || '退出后您将失去高级版权益，确定吗？', 
                async () => {
                    const { error } = await client.rpc('remove_family_member', { p_invitee_email: currentUser.email });
                    if (!error) { window.showToast(t['dash_leave_success'] || '已退出家庭组'); window.location.reload(); } 
                    else { window.showToast('Error: ' + error.message, 'error'); }
                }
            );
        };
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
    const btnManageSub = document.getElementById('btnManageSub');
    const btnClaimTrial = document.getElementById('btnClaimTrial');

    document.getElementById('inviteCount').textContent = profile.invite_success_count || 0;
    tierBadge.classList.remove('skeleton-text');
    
    const now = new Date();
    const balance = profile.referral_days_balance || 0;
    
    let baseTime = now.getTime();
    if (profile.subscription_ends_at && new Date(profile.subscription_ends_at).getTime() > baseTime) {
        baseTime = new Date(profile.subscription_ends_at).getTime();
    } else if (profile.trial_ends_at && new Date(profile.trial_ends_at).getTime() > baseTime) {
        baseTime = new Date(profile.trial_ends_at).getTime();
    }

    let expireDate = null;
    if (profile.subscription_ends_at || profile.trial_ends_at || balance > 0) {
        expireDate = new Date(baseTime + (balance * 86400000));
    }

    const isPremium = (expireDate && expireDate > now);

    let ownerEmailRow = document.getElementById('ownerEmailRow');
    if (profile.family_owner_id && profile.owner_email) {
        if (!ownerEmailRow) {
            ownerEmailRow = document.createElement('div');
            ownerEmailRow.id = 'ownerEmailRow';
            ownerEmailRow.className = 'data-row';
            tierBadge.parentNode.parentNode.insertBefore(ownerEmailRow, tierBadge.parentNode.nextSibling);
        }
        ownerEmailRow.innerHTML = `<span class="data-label">${t['dash_bound_to'] || '所属家庭组'}</span><span class="data-value" style="color:#58a6ff;">${profile.owner_email}</span>`;
    } else if (ownerEmailRow) {
        ownerEmailRow.remove();
    }

    const btnLeaveFamily = document.getElementById('btnLeaveFamily');
    const isSubAccount = !!profile.family_owner_id;

    if (btnCancel) btnCancel.classList.add('hidden');
    if (btnUpgrade) btnUpgrade.classList.add('hidden');
    if (btnManageSub) btnManageSub.classList.add('hidden');
    if (btnLeaveFamily) btnLeaveFamily.classList.add('hidden');
    if (btnClaimTrial) btnClaimTrial.classList.add('hidden');

    let displayTier = profile.tier;
    if (displayTier === 'free' && balance > 0) displayTier = 'pro';

    if (!isPremium && profile.tier === 'free') {
        tierBadge.textContent = t['dash_tier_free'] || '免费版 (Free)'; 
        tierBadge.className = 'status-badge'; 
        daysLeftEl.textContent = t['dash_forever'] || '永久有效'; 
        expireDateEl.textContent = '-';
        
        if(btnUpgrade) {
            btnUpgrade.classList.remove('hidden');
            btnUpgrade.textContent = t['dash_btn_upgrade'] || '升级/续费高级版';
        }
        if(btnClaimTrial && !profile.trial_ends_at) {
            btnClaimTrial.classList.remove('hidden');
        }
    } else {
        if (displayTier === 'pro') {
            tierBadge.textContent = (profile.trial_ends_at && !profile.stripe_customer_id) ? (t['dash_tier_trial'] || 'Pro 试用版') : (t['dash_tier_pro'] || '高级版 (Pro)');
        } else {
            tierBadge.textContent = t['dash_tier_family'] || '家庭版 (Family)';
        }
        tierBadge.className = 'status-badge status-pro';
        
        if (expireDate) {
            const diffDays = Math.ceil(Math.abs(expireDate - now) / (1000 * 60 * 60 * 24)); 
            daysLeftEl.textContent = `${diffDays} ${t['dash_days'] || '天'}`; 
            expireDateEl.textContent = expireDate.toLocaleDateString();
        }
        
        if (isSubAccount) {
            if (btnLeaveFamily) btnLeaveFamily.classList.remove('hidden');
        } else {
            if (profile.cancel_at_period_end) {
                if(btnUpgrade) {
                    btnUpgrade.classList.remove('hidden');
                    btnUpgrade.textContent = t['dash_btn_resume'] || '恢复自动续费';
                }
            } else {
                if (profile.stripe_customer_id) {
                    if(btnManageSub) { 
                        btnManageSub.classList.remove('hidden'); 
                        btnManageSub.textContent = t['dash_btn_manage'] || '管理订阅'; 
                    }
                    if(btnCancel) { btnCancel.classList.remove('hidden'); btnCancel.textContent = t['dash_btn_cancel'] || '取消订阅'; }
                } else if (balance > 0) {
                    if(btnUpgrade) {
                        btnUpgrade.classList.remove('hidden');
                        btnUpgrade.textContent = t['dash_btn_upgrade'] || '升级/续费高级版';
                    }
                } else {
                    if(btnManageSub) { 
                        btnManageSub.classList.remove('hidden'); 
                        btnManageSub.textContent = t['dash_btn_upgrade_full'] || '升级到正式版'; 
                    }
                }
            }
        }
    }

    renderNotifications();

    // 🌟 核心修复：将组件渲染包裹在 try-catch 中，避免局部报错导致全局崩溃
    if (displayTier !== 'free') {
        try { initDevicesUI(currentDashboardClient, dashboardData); } 
        catch (e) { console.warn("Device UI render warning:", e); }
    }
    if (displayTier === 'family') {
        try { initFamilyUI(currentDashboardClient, dashboardData); } 
        catch (e) { console.warn("Family UI render warning:", e); }
    }
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

window.addEventListener('languageChanged', () => {
    if (dashboardData && typeof renderDashboardTexts === 'function') {
        renderDashboardTexts();
    }
});
