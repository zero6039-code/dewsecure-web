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
    const btnResendOtp = document.getElementById('btnResendOtp');
    let currentEmail = '';
    const otpInput = document.getElementById('otpInput');

    // 🚀 核心修复：防白嫖的发送逻辑
    btnSendOtp.addEventListener('click', async () => {
        const t = window.fallbackTranslations || {};
        const email = emailInput.value.trim().toLowerCase();
        if (!email || !email.includes('@')) { window.showError('emailError', t['login_error_email'] || '请输入有效的邮箱地址'); return; }
        
        btnSendOtp.disabled = true; 
        btnSendOtp.textContent = t['login_sending'] || '正在发送...';
        
        try {
            // 1. 先尝试作为已有用户登录 (不创建新用户)
            let { error } = await supabaseClient.auth.signInWithOtp({ 
                email, 
                options: { shouldCreateUser: false } 
            });

            // 2. 如果报错说用户不存在，再自动走注册流程
            if (error && (error.message.includes('not found') || error.message.includes('User not found') || error.status === 400)) {
                console.log("用户不存在，自动切换至注册模式...");
                const { error: signUpError } = await supabaseClient.auth.signInWithOtp({ 
                    email, 
                    options: { shouldCreateUser: true } 
                });
                if (signUpError) throw signUpError;
            } else if (error) {
                throw error;
            }

            // 3. 进入验证码输入界面
            currentEmail = email;
            document.getElementById('displayEmail').textContent = email;
            document.getElementById('otpInput').value = ''; 
            stepEmail.classList.add('hidden'); 
            stepOtp.classList.remove('hidden');
            
            startCountdown(btnSendOtp, t['login_btn'] || '使用邮箱登录 (OTP)');
            if (btnResendOtp) startCountdown(btnResendOtp, t['login_btn_resend'] || '重新发送验证码');

        } catch (err) {
            window.showError('emailError', err.message || t['login_error_send'] || '发送失败'); 
            btnSendOtp.disabled = false; 
            btnSendOtp.textContent = t['login_btn'] || '使用邮箱登录 (OTP)';
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

    if (btnResendOtp) {
        btnResendOtp.addEventListener('click', async () => {
            if (btnResendOtp.disabled) return;
            const t = window.fallbackTranslations || {};
            btnResendOtp.disabled = true;
            btnResendOtp.textContent = t['login_sending'] || '正在发送...';
            
            try {
                // 重新发送就不需要判断了，直接用 true
                const { error } = await supabaseClient.auth.signInWithOtp({ email: currentEmail, options: { shouldCreateUser: true } });
                if (error) throw error;
                window.showToast('验证码已重新发送', 'success');
                startCountdown(btnResendOtp, t['login_btn_resend'] || '重新发送验证码');
            } catch (err) {
                window.showToast(err.message || '发送失败', 'error');
                btnResendOtp.disabled = false;
                btnResendOtp.textContent = t['login_btn_resend'] || '重新发送验证码';
            }
        });
    }

    btnBack.addEventListener('click', () => {
        stepOtp.classList.add('hidden'); stepEmail.classList.remove('hidden'); otpInput.value = '';
        btnSendOtp.disabled = false; 
        btnSendOtp.textContent = (window.fallbackTranslations || {})['login_btn'] || '使用邮箱登录 (OTP)';
    });
}

function startCountdown(btn, originalText, seconds = 60) {
    let countdown = seconds; 
    btn.disabled = true;
    const interval = setInterval(() => {
        if (countdown <= 0) { 
            clearInterval(interval); 
            btn.disabled = false; 
            btn.textContent = originalText; 
        } else { 
            btn.textContent = `未收到？${countdown}s 后可重发`; 
            countdown--; 
        }
    }, 1000);
}
