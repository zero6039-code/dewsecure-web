// ==========================================
// 📁 page-auth.js
// 职责：登录页的 OTP 发送、验证、倒计时
// ==========================================

export function initAuthPage() {
    const btnSendOtp = document.getElementById('btnSendOtp');
    if (!btnSendOtp || btnSendOtp.dataset.bound) return;
    btnSendOtp.dataset.bound = "true";
    const supabaseClient = window.supabaseClient;
    
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            const pendingToken = sessionStorage.getItem('pending_family_token');
            if (pendingToken) {
                sessionStorage.removeItem('pending_family_token');
                window.location.href = '/accept-invite.html?token=' + pendingToken;
            } else {
                window.location.href = '/dashboard.html';
            }
        }
    });

    const stepEmail = document.getElementById('step-email');
    const stepOtp = document.getElementById('step-otp');
    const emailInput = document.getElementById('emailInput');
    const btnVerifyOtp = document.getElementById('btnVerifyOtp');
    const btnBack = document.getElementById('btnBack');
    const otpInput = document.getElementById('otpInput');
    let currentEmail = '';

    btnSendOtp.addEventListener('click', async () => {
        const t = window.fallbackTranslations || {};
        const email = emailInput.value.trim();
        if (!email || !email.includes('@')) { window.showError('emailError', t['login_error_email'] || '请输入有效的邮箱地址'); return; }
        btnSendOtp.disabled = true; btnSendOtp.textContent = t['login_sending'] || '正在发送...';
        try {
            const { error } = await supabaseClient.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
            if (error) throw error;
            currentEmail = email;
            document.getElementById('displayEmail').textContent = email;
            document.getElementById('otpInput').value = ''; 
            stepEmail.classList.add('hidden'); stepOtp.classList.remove('hidden');
            startCountdown(btnSendOtp);
        } catch (err) {
            window.showError('emailError', err.message || t['login_error_send'] || '发送失败'); 
            btnSendOtp.disabled = false; btnSendOtp.textContent = t['login_btn'] || '使用邮箱登录 (OTP)';
        }
    });

    btnVerifyOtp.addEventListener('click', async () => {
        const t = window.fallbackTranslations || {};
        const token = otpInput.value.trim();
        if (token.length !== 8) { window.showError('otpError', t['login_error_otp'] || '请输入 8 位验证码'); return; }
        btnVerifyOtp.disabled = true; btnVerifyOtp.textContent = t['login_verifying'] || '正在验证...';
        try {
            const { error } = await supabaseClient.auth.verifyOtp({ email: currentEmail, token, type: 'email' });
            if (error) throw error;
            const pendingToken = sessionStorage.getItem('pending_family_token');
            if (pendingToken) {
                sessionStorage.removeItem('pending_family_token');
                window.location.href = '/accept-invite.html?token=' + pendingToken;
            } else {
                window.location.href = '/dashboard.html';
            }
        } catch (err) {
            window.showError('otpError', t['login_error_otp_expired'] || '验证码错误或已过期'); 
            btnVerifyOtp.disabled = false; btnVerifyOtp.textContent = t['login_btn_verify'] || '验证并登录';
        }
    });

    emailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); btnSendOtp.click(); } });
    otpInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); btnVerifyOtp.click(); } });

    btnBack.addEventListener('click', () => {
        stepOtp.classList.add('hidden'); stepEmail.classList.remove('hidden'); otpInput.value = '';
        btnSendOtp.disabled = false; 
        btnSendOtp.textContent = (window.fallbackTranslations || {})['login_btn'] || '使用邮箱登录 (OTP)';
    });
}

function startCountdown(btn) {
    const t = window.fallbackTranslations || {};
    let countdown = 60; btn.disabled = true;
    const interval = setInterval(() => {
        if (countdown <= 0) { 
            clearInterval(interval); 
            btn.disabled = false; 
            btn.textContent = t['login_btn_resend'] || '重新发送验证码'; 
        } else { 
            btn.textContent = `${t['login_btn_resend'] || '重新发送'} (${countdown}s)`; 
            countdown--; 
        }
    }, 1000);
}
