// js/app-init.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. 修复导航栏高亮
    const path = window.location.pathname;
    document.querySelectorAll('header nav a').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === path || 
            (path === '/' && href === '/index.html') || 
            (path.includes(href.replace('.html', '')) && href !== '/')) {
            link.classList.add('active');
        }
    });

    // 2. 首页专属逻辑
    if (document.getElementById('ds-title')) {
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

        if (btnEl) {
            btnEl.addEventListener('click', (e) => {
                if (btnEl.getAttribute('href') === '#') {
                    e.preventDefault();
                    alert("商店链接即将上线！");
                }
            });
        }

        window.addEventListener('languageChanged', () => {
            renderBrowserData(currentTarget);
        });
    }

    // 3. 指南页手风琴逻辑
    const accordions = document.querySelectorAll('.accordion-header');
    if (accordions.length > 0) {
        accordions.forEach(header => {
            if (header.dataset.bound) return;
            header.dataset.bound = "true"; 
            header.addEventListener('click', () => {
                const card = header.parentElement;
                card.classList.toggle('active');
            });
        });
    }

    // 4. Dashboard 专属逻辑
    if (document.getElementById('mainContent')) {
        initDashboardLogic();
    }
});

// Dashboard 业务逻辑
async function initDashboardLogic() {
    // 因为引入顺序，此处必定已存在
    const client = window.supabaseClient;
    if (!client) {
        alert('严重错误：Supabase 客户端未初始化。');
        return;
    }

    try {
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError || !session) {
            // 如果在 dashboard 没拿到 session，直接踹回登录页
            window.location.href = '/login.html';
            return;
        }

        const currentUser = session.user;
        
        const { data: profile, error: profileErr } = await client
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();
        
        if (profileErr) throw profileErr;

        const currentProfile = profile || { 
            id: currentUser.id, tier: 'free', trial_ends_at: null, invite_success_count: 0 
        };

        // 渲染订阅状态
        const tierBadge = document.getElementById('tierBadge');
        const daysLeftEl = document.getElementById('daysLeft');
        const expireDateEl = document.getElementById('expireDate');
        const btnCancel = document.getElementById('btnCancelSub');
        const btnUpgrade = document.getElementById('btnUpgrade');

        document.getElementById('inviteCount').textContent = currentProfile.invite_success_count || 0;
        if(tierBadge) tierBadge.classList.remove('skeleton-text');

        let expireDate = currentProfile.trial_ends_at ? new Date(currentProfile.trial_ends_at) : null;
        const now = new Date();
        
        if (currentProfile.tier === 'free') {
            tierBadge.textContent = '免费版 (Free)';
            tierBadge.className = 'status-badge';
            daysLeftEl.textContent = '永久有效';
            expireDateEl.textContent = '-';
            btnCancel.classList.add('hidden');
            btnUpgrade.classList.remove('hidden');
        } else {
            tierBadge.textContent = currentProfile.tier === 'pro' ? '高级版 (Pro)' : '家庭版 (Family)';
            tierBadge.className = 'status-badge status-pro';
            
            if (expireDate && expireDate > now) {
                const diffTime = Math.abs(expireDate - now);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                daysLeftEl.textContent = `${diffDays} 天`;
                daysLeftEl.style.color = diffDays <= 7 ? '#f85149' : '#fff';
                expireDateEl.textContent = expireDate.toLocaleDateString('zh-CN');
                document.getElementById('modalExpireDate').textContent = expireDate.toLocaleDateString('zh-CN');
                
                btnCancel.classList.remove('hidden');
                btnUpgrade.textContent = '续费 / 延长订阅';
            } else {
                daysLeftEl.textContent = '已过期';
                btnCancel.classList.add('hidden');
                btnUpgrade.classList.remove('hidden');
            }
        }

        // 拉取邀请码
        if (currentProfile.invite_success_count < 12) {
            const { data: inviteCode } = await client
                .from('invitations').select('code').eq('inviter_id', currentProfile.id).eq('status', 'pending').limit(1).maybeSingle();
            if (inviteCode?.code) {
                document.getElementById('myInviteCode').textContent = inviteCode.code;
                document.getElementById('btnGenInvite').classList.add('hidden');
                const copyBtn = document.getElementById('btnCopyInvite');
                copyBtn.classList.remove('hidden');
                copyBtn.onclick = async () => {
                    try {
                        await navigator.clipboard.writeText(inviteCode.code);
                        copyBtn.textContent = '已复制!';
                        setTimeout(() => copyBtn.textContent = '复制', 2000);
                    } catch (err) { alert('复制失败'); }
                };
            }
        } else {
            document.getElementById('inviteCard').classList.add('card-completed');
        }

        // 拉取通知
        const { data: notifs } = await client.from('notifications').select('*').order('created_at', { ascending: false });
        const list = document.getElementById('notificationList');
        if (notifs && notifs.length > 0) {
            list.innerHTML = '';
            const unreadIds = [];
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
            if (unreadIds.length > 0) {
                await client.from('notifications').update({ is_read: true }).in('id', unreadIds);
            }
        } else {
            list.innerHTML = '<li class="notification-item" style="text-align:center; color:#8b949e;">暂无新通知</li>';
        }

        // 绑定按钮
        document.getElementById('btnGenInvite').onclick = async () => {
            const btn = document.getElementById('btnGenInvite');
            btn.disabled = true; btn.textContent = '生成中...';
            const { data, error } = await client.rpc('generate_invitation_code');
            if (error) { alert('生成失败: ' + error.message); btn.disabled = false; btn.textContent = '生成邀请码'; return; }
            document.getElementById('myInviteCode').textContent = data;
            btn.classList.add('hidden');
            const copyBtn = document.getElementById('btnCopyInvite');
            copyBtn.classList.remove('hidden');
            copyBtn.onclick = async () => {
                try { await navigator.clipboard.writeText(data); copyBtn.textContent = '已复制!'; setTimeout(() => copyBtn.textContent = '复制', 2000); } catch (err) { alert('复制失败'); }
            };
        };

        document.getElementById('btnCancelSub').onclick = () => document.getElementById('cancelModal').classList.add('active');
        document.getElementById('btnCloseModal').onclick = () => document.getElementById('cancelModal').classList.remove('active');
        document.getElementById('btnConfirmCancel').onclick = async () => {
            const btn = document.getElementById('btnConfirmCancel');
            const reason = document.getElementById('cancelReason').value.trim();
            btn.disabled = true; btn.textContent = '处理中...';
            const { error } = await client.from('reports').insert({
                user_id: currentUser.id, reporter_email: currentUser.email, report_type: 'other', url: 'Cancel Sub', description: `[取消原因] ${reason || '未填写'}`
            });
            if (error) { alert('提交失败: ' + error.message); btn.disabled = false; btn.textContent = '确认取消'; return; }
            alert('取消请求已记录。'); document.getElementById('cancelModal').classList.remove('active'); document.getElementById('btnCancelSub').classList.add('hidden'); document.getElementById('btnUpgrade').classList.remove('hidden');
            btn.disabled = false; btn.textContent = '确认取消';
        };

    } catch (err) {
        console.error("Dashboard 初始化失败:", err);
        const tierBadge = document.getElementById('tierBadge');
        if(tierBadge) {
            tierBadge.textContent = '加载失败';
            tierBadge.style.color = '#f85149';
        }
    }
}
