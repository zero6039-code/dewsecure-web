// js/notifications.js
// DewSecure 通知中心模块 (v1.0.9 - 实时推送版)

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
    const btnDeleteAll = document.getElementById('btnDeleteAll');
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
    tryRender(listEl, badgeEl, btnDeleteAll);

    if (btnDeleteAll) {
        btnDeleteAll.onclick = () => {
            const t = window.fallbackTranslations || {};
            const title = t['dash_notif_delete_all'] || 'Delete All';
            
            if (cachedNotifications.length === 0) {
                if (typeof window.showGlassConfirm === 'function') {
                    window.showGlassConfirm(title, t['dash_notif_empty_click'] || 'There is no information left to delete.', () => {});
                } else {
                    window.alert(t['dash_notif_empty_click'] || 'There is no information left to delete.');
                }
                return;
            }

            const confirmMsg = t['dash_notif_delete_all_confirm'] || 'Are you sure you want to delete all notifications?';
            
            const executeDeleteAll = async () => {
                const allIds = cachedNotifications.map(n => n.id);
                const { error } = await window.supabaseClient.from('notifications').delete().in('id', allIds);
                if (!error) {
                    cachedNotifications = [];
                    renderEmptyState(listEl, badgeEl, btnDeleteAll);
                } else {
                    window.showToast(error.message, 'error');
                }
            };

            if (typeof window.showGlassConfirm === 'function') {
                window.showGlassConfirm(title, confirmMsg, executeDeleteAll);
            } else {
                if (window.confirm(confirmMsg)) executeDeleteAll();
            }
        };
    }

    // 🌟 核心新增：开启 Supabase Realtime 实时监听
    if (!window._notifChannelSubscribed && session) {
        window._notifChannelSubscribed = true; // 防重复订阅锁
        
        window.supabaseClient.channel('notifications_realtime')
            .on('postgres_changes', { 
                event: '*', // 监听增删改
                schema: 'public', 
                table: 'notifications', 
                filter: `user_id=eq.${session.user.id}` 
            }, (payload) => {
                console.log('⚡ [Realtime] 收到实时通知变动:', payload);
                // 收到变动后，直接重新跑一遍拉取逻辑，保证数据顺序绝对正确
                window.initNotifications();
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('📡 [Realtime] WebSocket 连接成功！正在等待新通知...');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ [Realtime] 连接失败，请检查 Supabase Realtime 是否开启或 RLS 策略', err);
                }
            });
    }
};

function tryRender(listEl, badgeEl, btnDeleteAll) {
    if (document.documentElement.getAttribute('data-i18n-ready') === 'true' && window.fallbackTranslations) {
        if (cachedNotifications.length === 0) {
            renderEmptyState(listEl, badgeEl, btnDeleteAll);
        } else {
            renderNotifications(cachedNotifications, listEl, badgeEl, btnDeleteAll);
        }
    } else {
        setTimeout(() => tryRender(listEl, badgeEl, btnDeleteAll), 100);
    }
}

// 🌟 切换语言时立刻重绘
window.addEventListener('languageChanged', () => {
    const listEl = document.getElementById('notificationList');
    const badgeEl = document.getElementById('unreadBadge');
    const btnDeleteAll = document.getElementById('btnDeleteAll');
    if (listEl) {
        setTimeout(() => {
            tryRender(listEl, badgeEl, btnDeleteAll);
        }, 50);
    }
});

function renderEmptyState(listEl, badgeEl, btnDeleteAll) {
    badgeEl.textContent = `${window.fallbackTranslations?.['dash_notif_unread'] || 'Unread'} (0)`;
    badgeEl.style.display = 'inline-block';
    badgeEl.style.background = '#30363d';
    badgeEl.style.color = '#8b949e';
    badgeEl.style.border = '1px solid rgba(255,255,255,0.1)';
    
    const emptyMsg = window.fallbackTranslations?.['dash_notif_empty'] || 'All clear! No new notifications.';
    listEl.innerHTML = `<li class="notification-item empty-state" style="text-align:center; color:#8b949e; padding: 30px 0; justify-content: center; display: block;">
        <div>
            <i class="fa-regular fa-bell-slash" style="font-size: 30px; margin-bottom: 10px; display: block; color: #30363d;"></i>
            ${emptyMsg}
        </div>
    </li>`;
}

function renderNotifications(data, listEl, badgeEl, btnDeleteAll) {
    listEl.innerHTML = '';
    const unreadCount = data.filter(n => !n.is_read).length;
    const t = window.fallbackTranslations || {};
    const currentLang = window.currentLang || 'en';

    badgeEl.textContent = `${t['dash_notif_unread'] || 'Unread'} (${unreadCount})`;
    badgeEl.style.display = 'inline-block';
    
    if (unreadCount > 0) {
        badgeEl.style.background = '#da3633';
        badgeEl.style.color = '#fff';
        badgeEl.style.border = '1px solid #da3633';
    } else {
        badgeEl.style.background = '#30363d';
        badgeEl.style.color = '#8b949e';
        badgeEl.style.border = '1px solid rgba(255,255,255,0.1)';
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

        // 点击条目标为已读
        li.addEventListener('click', async (e) => {
            if (e.target.closest('.notif-delete-btn') || e.target.closest('.notif-link')) return;
            if (!notif.is_read) {
                await window.supabaseClient.from('notifications').update({ is_read: true }).eq('id', notif.id);
                notif.is_read = true;
                renderNotifications(cachedNotifications, listEl, badgeEl, btnDeleteAll);
            }
        });

        // 点击垃圾桶删除单条
        li.querySelector('.notif-delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            const confirmMsg = t['notif_delete_confirm'] || 'Are you sure you want to delete this notification?';
            
            const executeDelete = async () => {
                const { data: deletedRows, error } = await window.supabaseClient.from('notifications').delete().eq('id', notif.id).select();
                
                if (error) {
                    console.error('删除通知失败:', error);
                    window.showToast(error.message || '删除失败，请检查网络', 'error');
                    return;
                }
                
                if (deletedRows !== null) {
                    const index = cachedNotifications.findIndex(n => n.id === notif.id);
                    if (index > -1) cachedNotifications.splice(index, 1);
                    
                    if (cachedNotifications.length === 0) {
                        renderEmptyState(listEl, badgeEl, btnDeleteAll);
                    } else {
                        renderNotifications(cachedNotifications, listEl, badgeEl, btnDeleteAll);
                    }
                }
            };

            if (typeof window.showGlassConfirm === 'function') {
                try {
                    window.showGlassConfirm(
                        t['confirm_cancel'] || '删除通知', 
                        confirmMsg, 
                        executeDelete
                    );
                } catch (err) {
                    console.error('毛玻璃弹窗异常，降级原生弹窗:', err);
                    if (window.confirm(confirmMsg)) await executeDelete();
                }
            } else {
                if (window.confirm(confirmMsg)) await executeDelete();
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
