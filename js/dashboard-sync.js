const EXTENSION_ID = 'fgnijfomipmimnfocgofmmniglibgnak';

export function pushAuthStateToExtension(session, data) {
    if (!window.chrome?.runtime?.sendMessage) return;
    
    const payload = {
        token: session?.access_token,
        refreshToken: session?.refresh_token,
        email: data.email,
        tier: data.tier,
        expiresAt: data.trial_ends_at,
        ownerEmail: data.owner_email || null
    };

    window.chrome.runtime.sendMessage(EXTENSION_ID, {
        type: 'SYNC_AUTH',
        payload: payload
    }, (res) => {
        if (window.chrome.runtime.lastError) {
            console.warn('⚠️ 推送插件失败:', window.chrome.runtime.lastError.message);
        } else {
            console.log('✅ Dashboard 已推送最新状态到插件:', payload.tier);
        }
    });
}
