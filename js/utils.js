// ==========================================
// 📁 utils.js
// 职责：全局通用工具函数（Toast、错误提示等）
// ==========================================

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

window.showError = function(id, msg) {
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = msg; el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
};

// ==========================================
// 🌟 全局毛玻璃确认弹窗 (替换原生 confirm)
// ==========================================
window.showGlassConfirm = function(title, message, onConfirm) {
    const existing = document.getElementById('glassConfirmModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'glassConfirmModal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:99999; opacity:0; transition:opacity 0.2s;';

    modal.innerHTML = `
        <div style="background:rgba(20,20,25,0.85); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:24px; width:90%; max-width:320px; box-shadow:0 10px 30px rgba(0,0,0,0.5); transform:scale(0.95); transition:transform 0.2s;">
            <h3 style="color:#fff; font-size:18px; font-weight:600; margin-top:0; margin-bottom:12px;">${title}</h3>
            <p style="color:#8b949e; font-size:14px; margin-bottom:24px; line-height:1.5;">${message}</p>
            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button id="glassCancelBtn" class="btn" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:#c9d1d9; padding:8px 16px; border-radius:8px; cursor:pointer;">取消</button>
                <button id="glassConfirmBtn" class="btn btn-danger" style="background:#f85149; border:none; color:#fff; padding:8px 16px; border-radius:8px; cursor:pointer;">确认</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    // 动画
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    });

    const close = () => {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.95)';
        setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector('#glassCancelBtn').onclick = close;
    modal.querySelector('#glassConfirmBtn').onclick = () => {
        close();
        onConfirm();
    };
};
