// ==========================================
// 📁 page-dashboard.js (精简调度中心)
// 职责：调度数据获取、UI 渲染与插件同步
// ==========================================

import { initDevicesUI } from './page-devices.js';
import { initFamilyUI } from './page-family.js';
import { fetchDashboardData } from './dashboard-fetcher.js';
import { pushAuthStateToExtension } from './dashboard-sync.js';

let dashboardData = null;
let currentDashboardClient = null;
let dashboardNotifs = [];

export async function initDashboardLogic() {
    const client = window.supabaseClient;
    if (!client) return;
    currentDashboardClient = client;

    const loader = document.getElementById('page-loader');
    
    try {
        const { data: { session } } = await client.auth.getSession();
        const urlParams = new URLSearchParams(window.location.search);
        const hasTokenInUrl = urlParams.get('token');
        
        if (!session && !hasTokenInUrl) { 
            window.location.href = '/login/'; 
            return; 
        }
        
        if (!session && hasTokenInUrl) {
            window.location.reload();
            return;
        }
        
        if (loader) {
            loader.style.transition = 'opacity 0.3s ease';
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        }
        
        const currentUser = session.user;
        
        // 1. 调用独立的 Fetcher 拉取数据
        const dataResult = await fetchDashboardData(client, currentUser);
        dashboardData = dataResult.dashboardData;
        dashboardNotifs = dataResult.dashboardNotifs;

        // 2. 渲染 UI
        renderDashboardTexts();
        bindDashboardButtons(currentUser);

        // 3. 同步给插件
        pushAuthStateToExtension(session, dashboardData);

    } catch (err) { 
        console.error("Dashboard 初始化失败:", err); 
        if (loader) loader.remove();
        window.showToast("加载数据失败，请刷新重试。", 'error');
    }
}

function bindDashboardButtons(currentUser) {
    const client = currentDashboardClient;
    const t = window.fallbackTranslations || {};
    
    // 🌟 1. 邀请好友逻辑
    if (!dashboardData.family_owner_id) {
        const btnGen = document.getElementById('btnGenInvite');
        if (btnGen) {
            btnGen.onclick = async () => {
                btnGen.disabled = true; btnGen.textContent = t['dash_gen_ing'] || '生成中...';
                const { data, error } = await client.rpc('generate_invitation_code');
                if (error) { window.showToast((t['dash_gen_fail'] || '生成失败: ') + error.message, 'error'); btnGen.disabled = false; btnGen.textContent = t['dash_invite_gen'] || '获取推广链接'; return; }
                
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

    // 🌟 2. 取消订阅逻辑 (主号/Pro)
    const btnCancelSub = document.getElementById('btnCancelSub');
    if (btnCancelSub) {
        btnCancelSub.onclick = () => {
            const expireDateStr = dashboardData.trial_ends_at ? new Date(dashboardData.trial_ends_at).toLocaleDateString() : '未知';
            const tip = (t['dash_cancel_tip'] || '您的权益将持续到 {date}。').replace('{date}', expireDateStr);
            document.getElementById('cancelTip').textContent = tip; // 在弹窗里显示
            document.getElementById('cancelModal').classList.add('active');
        };
        
        document.getElementById('btnCloseModal').onclick = () => document.getElementById('cancelModal').classList.remove('active');
        
        document.getElementById('btnConfirmCancel').onclick = async () => {
            const btn = document.getElementById('btnConfirmCancel');
            const reason = document.getElementById('cancelReason').value.trim();
            btn.disabled = true; 
            btn.textContent = t['dash_cancel_processing'] || '处理中...';
            
            const { error } = await client.from('reports').insert({
                user_id: currentUser.id, reporter_email: currentUser.email, report_type: 'other', url: 'Cancel Sub', description: `[取消原因] ${reason || '未填写'}`
            });
            
            if (error) { 
                window.showToast('提交失败: ' + error.message, 'error'); 
                btn.disabled = false; btn.textContent = t['dash_cancel_yes'] || '确认取消'; 
                return; 
            }
            
            window.showToast(t['dash_cancel_success'] || '您的取消请求已记录。'); 
            document.getElementById('cancelModal').classList.remove('active'); 
            btnCancelSub.classList.add('hidden'); 
            document.getElementById('btnUpgrade').classList.remove('hidden');
            btn.disabled = false; btn.textContent = t['dash_cancel_yes'] || '确认取消';
        };
    }

    // 🌟 3. 退出家庭组 (子号)
    const btnLeave = document.getElementById('btnLeaveFamily');
    if (btnLeave) {
        btnLeave.onclick = () => {
            window.showGlassConfirm(
                t['dash_leave_family_title'] || '退出家庭组', 
                t['dash_leave_family_desc'] || '退出后您将失去高级版权益，确定吗？', 
                async () => {
                    const { error } = await client.rpc('remove_family_member', { p_invitee_email: currentUser.email });
                    if (!error) {
                        window.showToast(t['dash_leave_success'] || '已退出家庭组');
                        window.location.reload();
                    } else {
                        window.showToast('Error: ' + error.message, 'error');
                    }
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

    document.getElementById('inviteCount').textContent = profile.invite_success_count || 0;
    tierBadge.classList.remove('skeleton-text');
    let expireDate = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    // 🌟 兜底：如果是付费版但没有过期时间，默认给从今天起算 365 天
    if (!expireDate && (profile.tier === 'pro' || profile.tier === 'family' || profile.tier === 'sub-family')) {
        expireDate = new Date();
        expireDate.setDate(expireDate.getDate() + 365);
    }
    const now = new Date();
    
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

    // 默认隐藏所有按钮
    if (btnCancel) btnCancel.classList.add('hidden');
    if (btnUpgrade) btnUpgrade.classList.add('hidden');
    if (btnLeaveFamily) btnLeaveFamily.classList.add('hidden');

    if (profile.tier === 'free') {
        // 免费版
        tierBadge.textContent = t['dash_tier_free'] || '免费版 (Free)'; 
        tierBadge.className = 'status-badge'; 
        daysLeftEl.textContent = t['dash_forever'] || '永久有效'; 
        expireDateEl.textContent = '-';
        
        if(btnUpgrade) {
            btnUpgrade.classList.remove('hidden');
            btnUpgrade.textContent = t['dash_btn_upgrade'] || '升级/续费高级版';
        }
    } else {
        // 付费版 (Pro / Family 主号 / Family 子号)
        tierBadge.textContent = profile.tier === 'pro' ? (t['dash_tier_pro'] || '高级版 (Pro)') : (t['dash_tier_family'] || '家庭版 (Family)');
        tierBadge.className = 'status-badge status-pro';
        
        if (expireDate && expireDate > now) {
            const diffDays = Math.ceil(Math.abs(expireDate - now) / (1000 * 60 * 60 * 24)); 
            daysLeftEl.textContent = `${diffDays} ${t['dash_days'] || '天'}`; 
            expireDateEl.textContent = expireDate.toLocaleDateString('zh-CN');
            
            if (isSubAccount) {
                // 🌟 子号：只显示退出按钮
                if (btnLeaveFamily) btnLeaveFamily.classList.remove('hidden');
            } else {
                // 🌟 主号/Pro：显示续费和取消
                if(btnCancel) {
                    btnCancel.classList.remove('hidden'); 
                    btnCancel.textContent = t['dash_btn_cancel'] || '取消订阅';
                }
                if(btnUpgrade) {
                    btnUpgrade.classList.remove('hidden');
                    btnUpgrade.textContent = t['dash_btn_renew'] || '续费 / 延长订阅';
                }
            }
        } else {
            // 已过期
            daysLeftEl.textContent = t['dash_expired'] || '已过期'; 
            if(btnUpgrade) {
                btnUpgrade.classList.remove('hidden');
                btnUpgrade.textContent = t['dash_btn_upgrade'] || '升级/续费高级版';
            }
        }
    }

    renderNotifications();

    if (dashboardData) {
        if (dashboardData.tier !== 'free') {
            initDevicesUI(currentDashboardClient, dashboardData);
        }
        if (dashboardData.tier === 'family') {
            initFamilyUI(currentDashboardClient, dashboardData);
        }
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

// 🌟 监听全局语言切换事件，重绘动态数据（如账户等级、剩余天数等）
window.addEventListener('languageChanged', () => {
    if (dashboardData && typeof renderDashboardTexts === 'function') {
        renderDashboardTexts();
    }
});
