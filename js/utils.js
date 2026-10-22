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
