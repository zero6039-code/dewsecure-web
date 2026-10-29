import { initDevicesUI } from './page-devices.js';
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

        await renderDashboardTexts();
        bindDashboardButtons(currentUser);
        pushAuthStateToExtension(session, dashboardData);

    } catch (err) { 
        console.error("Dashboard 初始化失败:", err); 
        if (loader) loader.remove();
        window.showToast((window.fallbackTranslations || {})["dash_load_failed"] || "加载数据失败，请刷新重试。", "error");
    }
}

function bindDashboardButtons(currentUser) {
    const client = currentDashboardClient;
    const getT = () => window.fallbackTranslations || {};
    
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

async function renderDashboardTexts() {
    if (!dashboardData) return;
    const t = window.fallbackTranslations || {};
    const profile = dashboardData;

    // 🌟 核心修复：子号直接查主号的数据库记录（前置条件：RLS 策略必须开放）
    if (profile.family_owner_id) {
        profile.tier = 'family'; // 强制标志
        try {
            const { data: ownerProfile } = await currentDashboardClient
                .from('profiles')
                .select('email, subscription_ends_at')
                .eq('id', profile.family_owner_id)
                .maybeSingle();
            
            if (ownerProfile && ownerProfile.subscription_ends_at) {
                profile.subscription_ends_at = ownerProfile.subscription_ends_at; 
                profile.owner_email = ownerProfile.email;
            }
        } catch (e) {
            console.warn("获取主号订阅时间失败", e);
        }
    }

    const tierBadge = document.getElementById('tierBadge');
    const daysLeftEl = document.getElementById('daysLeft');
    const expireDateEl = document.getElementById('expireDate');
    const btnUpgrade = document.getElementById('btnUpgrade');
    const btnManageSub = document.getElementById('btnManageSub');
    const btnClaimTrial = document.getElementById('btnClaimTrial');
    const btnCancel = document.getElementById('btnCancelSub');

    if (btnCancel) btnCancel.classList.add('hidden');
    document.getElementById('inviteCount').textContent = profile.invite_success_count || 0;
    tierBadge.classList.remove('skeleton-text');
    
    const now = new Date();
    const balance = profile.referral_days_balance || 0;
    
    let expireDate = null;
    
    if (profile.subscription_ends_at) {
        let subEnd = new Date(profile.subscription_ends_at);
        let baseTime = subEnd > now ? subEnd.getTime() : now.getTime(); 
        expireDate = new Date(baseTime + (balance * 86400000));
    } else if (profile.trial_ends_at) {
        let trialEnd = new Date(profile.trial_ends_at);
        let baseTime = trialEnd > now ? trialEnd.getTime() : now.getTime();
        expireDate = new Date(baseTime + (balance * 86400000));
    } else if (balance > 0) {
        const regTime = new Date(profile.created_at || now).getTime();
        let calculatedExpire = regTime + (balance * 86400000);
        expireDate = new Date(calculatedExpire > now.getTime() ? calculatedExpire : now.getTime() + (balance * 86400000));
    }

    const isPremium = (expireDate && expireDate > now);

    if (btnUpgrade) btnUpgrade.classList.add('hidden');
    if (btnManageSub) btnManageSub.classList.add('hidden');
    if (btnClaimTrial) btnClaimTrial.classList.add('hidden');
    const btnLeaveFamily = document.getElementById('btnLeaveFamily');
    if (btnLeaveFamily) btnLeaveFamily.classList.add('hidden');

    let displayTier = profile.tier;
    if (displayTier === 'sub-family') displayTier = 'family';
    if (displayTier === 'free' && isPremium) displayTier = 'pro';

    if (!isPremium && displayTier === 'free') {
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
            tierBadge.textContent = t['dash_tier_pro'] || '高级版 (Pro)';
            tierBadge.className = 'status-badge status-pro';
            tierBadge.style.background = '';
            tierBadge.style.color = '';
            tierBadge.style.borderColor = '';
        } else if (displayTier === 'trial') {
            tierBadge.textContent = t['dash_tier_trial'] || 'Pro 试用版';
            tierBadge.className = 'status-badge';
            tierBadge.style.background = 'rgba(35, 134, 54, 0.15)';
            tierBadge.style.color = '#3fb950';
            tierBadge.style.borderColor = 'rgba(35, 134, 54, 0.4)';
        } else if (displayTier === 'family') {
            tierBadge.textContent = t['dash_tier_family'] || '家庭版 (Family)';
            tierBadge.className = 'status-badge status-pro';
            tierBadge.style.background = '';
            tierBadge.style.color = '';
            tierBadge.style.borderColor = '';
        } else {
            tierBadge.textContent = t['dash_tier_free'] || '免费版 (Free)';
            tierBadge.className = 'status-badge';
            tierBadge.style.background = '';
            tierBadge.style.color = '';
            tierBadge.style.borderColor = '';
        }
        
        if (expireDate) {
            // 强制按绝对毫秒数算，彻底解决差1-2天的 Bug
            const diffMs = Math.abs(expireDate.getTime() - now.getTime());
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            daysLeftEl.textContent = `${diffDays} ${t['dash_days'] || '天'}`; 
            
            // 强制使用 UTC 提取年月日
            const year = expireDate.getUTCFullYear();
            const month = String(expireDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(expireDate.getUTCDate()).padStart(2, '0');
            let dateStr = `${year}-${month}-${day}`;
            
            if (profile.cancel_at_period_end) {
                dateStr += ` <span style="color:#f85149; font-size:12px; margin-left:5px;">(${t['dash_canceled_notice'] || '已取消自动续费'})</span>`;
            }
            expireDateEl.innerHTML = dateStr;
        }

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
            if (btnLeaveFamily) btnLeaveFamily.classList.remove('hidden');
        } else {
            if (profile.stripe_customer_id) {
                if(btnManageSub) { 
                    btnManageSub.classList.remove('hidden'); 
                    btnManageSub.textContent = t['dash_btn_manage'] || '管理订阅'; 
                }
            } else {
                if(btnManageSub) { 
                    btnManageSub.classList.remove('hidden'); 
                    btnManageSub.textContent = t['dash_btn_upgrade_full'] || '升级到正式版'; 
                }
            }
        }
    }

    if (displayTier !== 'free') {
        const deviceTier = displayTier === 'trial' ? 'pro' : displayTier;
        try { initDevicesUI(currentDashboardClient, { ...dashboardData, tier: deviceTier }); } 
        catch (e) { console.warn("Device UI render warning:", e); }
    }
    if (displayTier === 'family') {
        try { initFamilyUI(currentDashboardClient, dashboardData); } 
        catch (e) { console.warn("Family UI render warning:", e); }
    }
}

window.addEventListener('languageChanged', async () => {
    if (dashboardData && typeof renderDashboardTexts === 'function') {
        await renderDashboardTexts();
    }
});
