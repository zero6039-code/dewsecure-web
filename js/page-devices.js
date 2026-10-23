export async function initDevicesUI(client, profile) {
    const deviceCard = document.getElementById('deviceCard');
    const slotsDiv = document.getElementById('deviceSlots');
    const desc = document.getElementById('deviceDesc');
    if (!deviceCard) return;

    if (profile.tier === 'free' || profile.family_owner_id) {
        deviceCard.classList.add('hidden');
        return;
    }

    deviceCard.classList.remove('hidden');
    deviceCard.style.marginTop = '24px';

    const maxDevices = profile.tier === 'pro' ? 3 : 9;
    desc.textContent = `您的 ${profile.tier === 'pro' ? '高级版' : '家庭版'} 最多支持绑定 ${maxDevices} 台设备。`;

    let devices = [];
    let errorMsg = '';

    try {
        const { data, error } = await client.from('devices').select('*').eq('user_id', profile.id);
        if (error) throw error;
        devices = data || [];
    } catch (err) {
        errorMsg = err.message;
        devices = [];
    }

    const titleSpan = deviceCard.querySelector('h3 span');
    if (titleSpan) titleSpan.textContent = `设备管理 (${devices.length} / ${maxDevices})`;

    slotsDiv.innerHTML = '';
    if (errorMsg) {
        const errDiv = document.createElement('div');
        errDiv.style = 'color:#f85149; font-size:12px; margin-bottom:10px; background:rgba(248,81,73,0.1); padding:8px; border-radius:6px;';
        errDiv.textContent = `数据拉取失败: ${errorMsg}`;
        slotsDiv.appendChild(errDiv);
    }
    
    // SVG 图标库
    const icons = {
        windows: `<svg viewBox="0 0 24 24" width="20" height="20" fill="#00a4ef"><path d="M3 5.5l7.5-1v7H3v-6zm8.5-1.1L21 3v8.5h-9.5v-7.1zM3 12.5h7.5v7l-7.5-1v-6zm8.5 0H21V21l-9.5-1.3v-7.2z"/></svg>`,
        apple: `<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.85 3.59-.74 1.63.1 2.78.84 3.58 1.86-3.02 1.87-2.52 6.36.47 7.66-.55 1.42-1.45 2.81-2.72 4.39zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`,
        android: `<svg viewBox="0 0 24 24" width="20" height="20" fill="#3ddc84"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.18-.37.54-.22.83L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"/></svg>`,
        linux: `<svg viewBox="0 0 24 24" width="20" height="20" fill="#f0db4f"><path d="M12 2a5 5 0 00-5 5v2c0 1.1-.9 2-2 2H4v2h1c1.1 0 2 .9 2 2v2a5 5 0 005 5h.5v-2H12a3 3 0 01-3-3v-2a4 4 0 00-2-3.46V11c0-1.1.9-2 2-2h1V7a3 3 0 013-3h.5V2H12zm.5 0v2h.5a3 3 0 013 3v2h1c1.1 0 2 .9 2 2v.54A4 4 0 0017 13v2a3 3 0 01-3 3h-.5v2h.5a5 5 0 005-5v-2c0-1.1.9-2 2-2h1v-2h-1c-1.1 0-2-.9-2-2V7a5 5 0 00-5-5h-.5z"/></svg>`,
        unknown: `<svg viewBox="0 0 24 24" width="20" height="20" fill="#8b949e"><path d="M4 6h16v10H4zm0 12h16v2H4z"/></svg>`
    };

    // 解析 UA 的简易函数（真实环境需要更复杂的判断）
    function getDeviceInfo(ua) {
        if (!ua) return { os: 'unknown', browser: '未知浏览器', icon: icons.unknown };
        ua = ua.toLowerCase();
        let os = 'unknown', browser = '未知浏览器', icon = icons.unknown;
        
        if (ua.includes('windows')) { os = 'Windows'; icon = icons.windows; }
        else if (ua.includes('mac os') || ua.includes('macintosh')) { os = 'macOS'; icon = icons.apple; }
        else if (ua.includes('android')) { os = 'Android'; icon = icons.android; }
        else if (ua.includes('iphone') || ua.includes('ipad')) { os = 'iOS'; icon = icons.apple; }
        else if (ua.includes('linux')) { os = 'Linux'; icon = icons.linux; }

        if (ua.includes('edg/')) browser = 'Edge';
        else if (ua.includes('chrome')) browser = 'Chrome';
        else if (ua.includes('firefox')) browser = 'Firefox';
        else if (ua.includes('safari')) browser = 'Safari';

        return { os, browser, icon };
    }
    
    for (let i = 0; i < maxDevices; i++) {
        const row = document.createElement('div');
        row.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:12px 15px; border-radius:10px; border:1px solid rgba(255,255,255,0.05); margin-bottom: 8px;';
        
        const d = devices[i];
        if (d) {
            // 使用 user_agent 或默认值解析
            const ua = d.user_agent || d.device_name || navigator.userAgent; 
            const info = getDeviceInfo(ua);
            
            const lastActive = d.created_at ? new Date(d.created_at).toLocaleDateString() : '未知时间';
            
            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px;">
                    <div style="width:32px; height:32px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); border-radius:8px;">
                        ${info.icon}
                    </div>
                    <div>
                        <div style="color:#fff; font-weight:600; font-size:14px;">${info.browser} on ${info.os}</div>
                        <div style="color:#8b949e; font-size:12px; margin-top:4px;">激活时间: ${lastActive}</div>
                    </div>
                </div>
                <button class="btn btn-danger" style="padding: 6px 12px; font-size: 13px;" onclick="window.removeDevice('${d.id}')">解绑</button>
            `;
        } else {
            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px;">
                    <div style="width:32px; height:32px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.02); border-radius:8px;">
                        ${icons.unknown}
                    </div>
                    <div style="color:#8b949e; font-size:14px; font-style:italic;">空闲槽位</div>
                </div>
                
            `;
        }
        slotsDiv.appendChild(row);
    }
}

window.removeDevice = async function(deviceId) {
    window.showGlassConfirm('解绑设备', '确认解绑该设备？此设备将失去高级功能。', async () => {
        const client = window.supabaseClient;
        const { error } = await client.from('devices').delete().eq('id', deviceId);
        if (!error) {
            window.showToast('设备已解绑');
            const { data: { session } } = await client.auth.getSession();
            const { data: profile } = await client.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
            initDevicesUI(client, profile);
        } else {
            window.showToast('解绑失败: ' + error.message, 'error');
        }
    });
};
