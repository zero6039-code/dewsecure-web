// js/notifications.js
// DewSecure 通知中心模块 (v1.0.6 - 多语言强制优先版)

const NOTIF_ICONS = {
    'system': 'fa-solid fa-bullhorn text-blue',
    'billing': 'fa-solid fa-credit-card text-green',
    'security': 'fa-solid fa-shield-halved text-red',
    'family': 'fa-solid fa-users text-purple',
    'referral': 'fa-solid fa-gift text-gold'
};

let cachedNotifications = [];

window.initNotifications = async function() {
    const listEl = document.getElementById('notificationList');
    const badgeEl = document.getElementById('unreadBadge');
    const markAllBtn = document.getElementById('btnMarkAllRead');
    if (!listEl) return;

    if (!window.supabaseClient) {
        setTimeout(window.initNotifications, 500);
        return;
    }

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) return;

    const { data: notifications, error } = await window.supabaseClient
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('拉取通知失败:', error);
        return;
    }

    cachedNotifications = notifications || [];
    tryRender(listEl, badgeEl, markAllBtn);

    if (markAllBtn) {
        markAllBtn.onclick = async () => {
            const unreadIds = cachedNotifications.filter(n => !n.is_read).map(n => n.id);
            if (unreadIds.length === 0) return;
            await window.supabaseClient.from('notifications').update({ is_read: true }).in('id', unreadIds);
            cachedNotifications.forEach(n => n.is_read = true);
            tryRender(listEl, badgeEl, markAllBtn);
        };
    }
};

function tryRender(listEl, badgeEl, markAllBtn) {
    if (document.documentElement.getAttribute('data-i18n-ready') === 'true' && window.fallbackTranslations) {
        if (cachedNotifications.length === 0) {
            renderEmptyState(listEl, badgeEl, markAllBtn);
        } else {
            renderNotifications(cachedNotifications, listEl, badgeEl, markAllBtn);
        }
    } else {
        setTimeout(() => tryRender(listEl, badgeEl, markAllBtn), 100);
    }
}

// 确保切换语言时立刻重绘
window.addEventListener('languageChanged', () => {
    const listEl = document.getElementById('notificationList');
    const badgeEl = document.getElementById('unreadBadge');
    const markAllBtn = document.getElementById('btnMarkAllRead');
    if (listEl && cachedNotifications.length > 0) {
        // 加个微小延迟，确保 fallbackTranslations 完全替换完毕
        setTimeout(() => {
            renderNotifications(cachedNotifications, listEl, badgeEl, markAllBtn);
        }, 10);
    }
});

function renderEmptyState(listEl, badgeEl, markAllBtn) {
    badgeEl.style.display = 'none';
    markAllBtn.classList.add('hidden');
    const emptyMsg = window.fallbackTranslations?.['dash_notif_empty'] || 'All clear! No new notifications.';
    listEl.innerHTML = `<li class="notification-item empty-state" style="text-align:center; color:#8b949e; padding: 30px 0; justify-content: center; display: block;">
        <div>
            <i class="fa-regular fa-bell-slash" style="font-size: 30px; margin-bottom: 10px; display: block; color: #30363d;"></i>
            ${emptyMsg}
        </div>
    </li>`;
}

function renderNotifications(data, listEl, badgeEl, markAllBtn) {
    listEl.innerHTML = '';
    const unreadCount = data.filter(n => !n.is_read).length;
    const t = window.fallbackTranslations || {};
    const currentLang = window.currentLang || 'en';

    if (unreadCount > 0) {
        badgeEl.textContent = `${t['dash_notif_unread'] || 'Unread'} (${unreadCount})`;
        badgeEl.style.display = 'inline-block';
        markAllBtn.classList.remove('hidden');
    } else {
        badgeEl.style.display = 'none';
        markAllBtn.classList.add('hidden');
    }

    let lastDateStr = '';

    data.forEach(notif => {
        const notifDate = new Date(notif.created_at);
        const dateStr = notifDate.toDateString();
        
        if (dateStr !== lastDateStr) {
            const divider = document.createElement('li');
            divider.className = 'notif-date-divider';
            divider.style.textAlign = 'center';
            divider.style.margin = '15px 0 10px 0';
            divider.style.color = '#8b949e';
            divider.style.fontSize = '12px';
            divider.style.position = 'relative';
            
            let dateTitle = '';
            const now = new Date();
            const todayStr = now.toDateString();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();

            if (dateStr === todayStr) {
                dateTitle = t['notif_today'] || 'Today';
            } else if (dateStr === yesterdayStr) {
                dateTitle = t['notif_yesterday'] || 'Yesterday';
            } else {
                dateTitle = notifDate.toLocaleDateString(currentLang, {
                    year: 'numeric', month: 'short', day: 'numeric'
                });
            }
            
            divider.innerHTML = `<span style="background: #161b22; padding: 0 10px; position: relative; z-index: 1;">${dateTitle}</span>
                                 <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.05); z-index: 0;"></div>`;
            listEl.appendChild(divider);
            lastDateStr = dateStr;
        }

        const li = document.createElement('li');
        li.className = `notification-item ${notif.is_read ? 'read' : 'unread'}`;
        
        const titleKey = notif.title_key || 'notif_welcome_title';
        const msgKey = notif.message_key || 'notif_welcome_desc';
        
        // 强制优先取翻译包里的 Key
        let titleText = t[titleKey] || notif.title || 'Untitled';
        let msgText = t[msgKey] || notif.message || 'No details.';
        
        if (notif.params && typeof notif.params === 'object') {
            Object.keys(notif.params).forEach(k => {
                const regex = new RegExp(`\\{${k}\\}`, 'g');
                const highlight = `<span class="notif-highlight">${notif.params[k]}</span>`;
                titleText = titleText.replace(regex, highlight);
                msgText = msgText.replace(regex, highlight);
            });
        }

        const isDuplicate = titleText.replace(/<[^>]+>/g, '') === msgText.replace(/<[^>]+>/g, '');
        const msgHtml = isDuplicate ? '' : `<div class="notif-desc">${msgText}</div>`;

        const timeStr = formatTime(notif.created_at, t);
        const iconClass = NOTIF_ICONS[notif.type] || NOTIF_ICONS['system'];
        const viewDetailsText = t['notif_view_details'] || 'View Details';
        const actionHtml = notif.action_url ? `<a href="${notif.action_url}" class="notif-link" style="display:inline-block; margin-top:8px; font-size:13px; color:#58a6ff;">${viewDetailsText} <i class="fa-solid fa-arrow-right"></i></a>` : '';

        li.innerHTML = `
            <div class="notif-icon ${notif.type || 'system'}" style="flex-shrink: 0;">
                <i class="${iconClass}"></i>
            </div>
            <div class="notif-content" style="flex: 1; min-width: 0;">
                <div class="notif-header" style="display: flex; justify-content: space-between;">
                    <span class="notif-title">${titleText}</span>
                    <span class="notif-time" style="margin-left: 10px; white-space: nowrap;">${timeStr}</span>
                </div>
                ${msgHtml}
                ${actionHtml}
            </div>
            <button class="notif-delete-btn" title="${t['confirm_ok'] || 'Delete'}" style="flex-shrink: 0;"><i class="fa-solid fa-trash-can"></i></button>
        `;

        li.addEventListener('click', async (e) => {
            if (e.target.closest('.notif-delete-btn') || e.target.closest('.notif-link')) return;
            if (!notif.is_read) {
                await window.supabaseClient.from('notifications').update({ is_read: true }).eq('id', notif.id);
                notif.is_read = true;
                renderNotifications(cachedNotifications, listEl, badgeEl, markAllBtn);
            }
        });

        li.querySelector('.notif-delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(t['notif_delete_confirm'] || 'Are you sure you want to delete this notification?')) return;
            const { error } = await window.supabaseClient.from('notifications').delete().eq('id', notif.id);
            if (!error) {
                const index = cachedNotifications.findIndex(n => n.id === notif.id);
                if (index > -1) cachedNotifications.splice(index, 1);
                if (cachedNotifications.length === 0) renderEmptyState(listEl, badgeEl, markAllBtn);
                else renderNotifications(cachedNotifications, listEl, badgeEl, markAllBtn);
            }
        });

        listEl.appendChild(li);
    });
}

function formatTime(utcString, t) {
    const date = new Date(utcString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60 && diff >= 0) return t['notif_time_just_now'] || 'Just now';
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.documentElement.getAttribute('data-i18n-ready') === 'true') {
        window.initNotifications();
    } else {
        window.addEventListener('languageChanged', () => {
            if (!cachedNotifications.length) window.initNotifications();
        }, { once: true });
    }
});
