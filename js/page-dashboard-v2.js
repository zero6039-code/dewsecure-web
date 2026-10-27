// ==========================================
// 📁 page-dashboard.js (极简托管版)
// ==========================================

import { initDevicesUI } from './page-devices-v2.js';
import { initFamilyUI } from './page-family.js';
import { fetchDashboardData } from './dashboard-fetcher.js';
import { pushAuthStateToExtension } from './dashboard-sync.js';

let dashboardData = null;
let currentDashboardClient = null;
let dashboardNotifs = [];

const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://127.0.0.1:8787' 
    : 'https://dewsecure-api.zero6039.workers.dev';

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
        
        // 🌟 防闪烁：先隐藏所有按钮
        ['btnUpgrade', 'btnManageSub', 'btnCancelSub', 'btnClaimTrial', 'btnLeaveFamily'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

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

    // 3. 唯一按钮：管理订阅 (Stripe Portal)
    const btnManageSub = document.getElementById('btnManageSub');
    if (btnManageSub) {
        btnManageSub.onclick = async () => {
            const t = getT();
            
            // 如果没有付费记录，直接去定价页
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

    // 4. 退出家庭组 (子号保留)
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
    const btnUpgrade = document.getElementById('btnUpgrade');
    const btnManageSub = document.getElementById('btnManageSub');
    const btnClaimTrial = document.getElementById('btnClaimTrial');
    const btnCancel = document.getElementById('btnCancelSub');

    // 🌟 彻底隐藏取消按钮
    if (btnCancel) btnCancel.classList.add('hidden');

    document.getElementById('inviteCount').textContent = profile.invite_success_count || 0;
    tierBadge.classList.remove('skeleton-text');
    
    const now = new Date();
    const balance = profile.referral_days_balance || 0;
    
    // ==========================================
    // 🌟 核心修复：计算正确的到期时间 (BaseTime)
    // ==========================================
    let expireDate = null;
    
    if (profile.subscription_ends_at) {
        // 1. 有真实订阅
        let subEnd = new Date(profile.subscription_ends_at);
        let baseTime = subEnd > now ? subEnd.getTime() : now.getTime(); 
        expireDate = new Date(baseTime + (balance * 86400000));
    } else if (profile.trial_ends_at) {
        // 2. 有试用期
        let trialEnd = new Date(profile.trial_ends_at);
        let baseTime = trialEnd > now ? trialEnd.getTime() : now.getTime();
        expireDate = new Date(baseTime + (balance * 86400000));
    } else if (balance > 0) {
        // 3. 纯返利用户（无订阅、无试用）
        // 修复点：不能从今天算，必须从注册时间(created_at)作为锚点起算
        const regTime = new Date(profile.created_at || now).getTime();
        let calculatedExpire = regTime + (balance * 86400000);
        
        // 如果算出来的时间已经过期（说明是很早以前注册的老用户，且刚拿了返利），则从今天开始算
        expireDate = new Date(calculatedExpire > now.getTime() ? calculatedExpire : now.getTime() + (balance * 86400000));
    }

    const isPremium = (expireDate && expireDate > now);

    // 默认隐藏所有按钮
    if (btnUpgrade) btnUpgrade.classList.add('hidden');
    if (btnManageSub) btnManageSub.classList.add('hidden');
    if (btnClaimTrial) btnClaimTrial.classList.add('hidden');
    const btnLeaveFamily = document.getElementById('btnLeaveFamily');
    if (btnLeaveFamily) btnLeaveFamily.classList.add('hidden');

    let displayTier = profile.tier;
    if (displayTier === 'free' && isPremium) displayTier = 'pro';

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
            let dateStr = expireDate.toLocaleDateString();
            if (profile.cancel_at_period_end) {
                dateStr += ` <span style="color:#f85149; font-size:12px; margin-left:5px;">(${t['dash_canceled_notice'] || '已取消自动续费'})</span>`;
            }
            expireDateEl.innerHTML = dateStr;
        }

        // 渲染锁定中天数 (14天未解锁的返利)
        let pendingEl = document.getElementById('pendingRewardsRow');
        if (profile.pending_referral_days > 0) {
            if (!pendingEl) {
                pendingEl = document.createElement('div');
                pendingEl.id = 'pendingRewardsRow';
                pendingEl.className = 'data-row';
                pendingEl.style.color = '#8b949e';
                pendingEl.style.fontSize = '13px';
                pendingEl.style.marginTop = '-5px';
                daysLeftEl.parentNode.parentNode.insertBefore(pendingEl, daysLeftEl.parentNode.nextSibling);
            }
            pendingEl.innerHTML = `<span class="data-label">${t['dash_pending_days'] || '待解锁返利'}</span><span class="data-value" style="color:#f1e05a;">+${profile.pending_referral_days} ${t['dash_days'] || '天'}</span>`;
        } else if (pendingEl) {
            pendingEl.remove();
        }
        
        if (profile.family_owner_id) {
            // 子号只能退出家庭组
            if (btnLeaveFamily) btnLeaveFamily.classList.remove('hidden');
        } else {
            // 🌟 全局唯一操作按钮
            if (profile.stripe_customer_id) {
                // 有真实付费记录，只显示“管理订阅”（不管是否已经点了取消）
                if(btnManageSub) { 
                    btnManageSub.classList.remove('hidden'); 
                    btnManageSub.textContent = t['dash_btn_manage'] || '管理订阅'; 
                }
            } else {
                // 纯试用 / 纯返利用户，显示“升级到正式版”
                if(btnManageSub) { 
                    btnManageSub.classList.remove('hidden'); 
                    btnManageSub.textContent = t['dash_btn_upgrade_full'] || '升级到正式版'; 
                }
            }
        }
    }

    renderNotifications();

    if (displayTier !== 'free') {
        try { initDevicesUI(currentDashboardClient, { ...dashboardData, tier: displayTier }); } 
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
