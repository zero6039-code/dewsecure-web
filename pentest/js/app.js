// DewSecure 最终版（抖动验证 + 防滥用 + 倒计时 + Formspree + 多语言 + 二进制跳动 + 安全扫描 + 持久化冷却 + reCAPTCHA）
document.addEventListener('DOMContentLoaded', () => {
    triggerStatsCounter();
    initQuoteModal();
    initBinaryStream();
    initQuickScanner();
    initPolicyModal();
    renderServiceDetailTable();
    initServiceDetailColumnHighlight();
    window.addEventListener('resize', triggerStatsCounter);

    const heroAction = document.querySelector('.hero-action.delayed-btn');
    if (heroAction) {
        setTimeout(() => heroAction.classList.add('show'), 1000);
    }

    const scanner = document.querySelector('.quick-scanner.delayed-scanner');
    if (scanner) {
        setTimeout(() => scanner.classList.add('show'), 2000);
    }
});

window.addEventListener('load', () => {
    document.body.classList.add('is-ready');
});

function t(key) {
    return (window.fallbackTranslations && window.fallbackTranslations[key]) || key;
}

/* ========== 数字滚动 ========== */
function animateCounter(targetNumber) {
    const c = document.getElementById("stats-counter");
    if (!c) return;
    c.innerHTML = "";
    const digits = targetNumber.toString().split("");
    const slots = digits.map(() => {
        const slot = document.createElement("div");
        slot.className = "counter-digit-slot";
        for (let i = 0; i <= 9; i++) {
            const span = document.createElement("span");
            span.innerText = i;
            slot.appendChild(span);
        }
        c.appendChild(slot);
        return slot;
    });
    const h = slots[0]?.querySelector('span')?.offsetHeight || 0;
    digits.forEach((d, i) => {
        setTimeout(() => {
            slots[i].style.transform = `translateY(-${parseInt(d) * h}px)`;
        }, i * 60);
    });
}

function triggerStatsCounter() {
    const container = document.getElementById("stats-counter");
    if (container) {
        const target = parseInt(container.getAttribute("data-target")) || 69;
        animateCounter(target);
    }
}

/* ========== 二进制矩阵 ========== */
function initBinaryStream() {
    const rows = document.querySelectorAll('.binary-matrix-stream .matrix-row');
    if (!rows.length) return;

    const initialData = [
        "11100011", "01100001", "01101100", "10101011",
        "00001111", "01011100", "00011100", "01101010",
        "10111001", "10100000", "00010111", "11100001",
        "01110101", "01101011", "11110000", "00011011",
        "11101011", "10110011", "00010111", "10101000",
        "01011001", "00100111", "00010101", "01110011",
        "01110110", "00100100", "01100100", "11000110",
        "10001010", "10000100", "00100101", "01011101",
        "00011010", "10101101", "10010001", "11100011",
        "11010101", "10001010", "11001110", "00001111"
    ];

    rows.forEach((row, index) => {
        row.innerHTML = '';
        const startIdx = index * 4;
        for (let col = 0; col < 4; col++) {
            const span = document.createElement('span');
            span.textContent = initialData[startIdx + col];
            row.appendChild(span);
        }
    });

    setInterval(() => {
        const allSpans = document.querySelectorAll('.binary-matrix-stream .matrix-row span');
        if (allSpans.length === 0) return;

        const mutationCount = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < mutationCount; i++) {
            const randomSpan = allSpans[Math.floor(Math.random() * allSpans.length)];
            const bits = randomSpan.textContent.split('');
            const flipIdx = Math.floor(Math.random() * bits.length);
            bits[flipIdx] = bits[flipIdx] === '0' ? '1' : '0';
            randomSpan.textContent = bits.join('');
        }
    }, 45);
}

/* ========== 弹窗 + Formspree + 多语言 + 防滥用 + 倒计时 + 抖动验证 + reCAPTCHA ========== */
function initQuoteModal() {
    const overlay = document.getElementById("quote-modal");
    if (!overlay) return;
    const closeBtn = document.getElementById("modal-close-btn");
    const form = document.getElementById("quote-form");
    const textarea = document.getElementById("form-info");

    function shakeElement(el) {
        if (!el) return;
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = 'shake-error 0.4s ease-in-out';
        el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
    }

    let isSubmitting = false;
    const COOLDOWN_SECONDS = 30;
    const MAX_SUBMISSIONS = 5;
    const STORAGE_KEY = 'dewsecure_submissions';

    const submitBtn = form?.querySelector('.btn-submit-quote');
    const submitBtnTextSpan = submitBtn?.querySelector('span[data-i18n="hero_btn_quote"]');
    let originalBtnText = '咨询专家';
    let countdownTimer = null;

    function updateOriginalBtnText() {
        if (submitBtnTextSpan) originalBtnText = submitBtnTextSpan.textContent || '咨询专家';
    }
    updateOriginalBtnText();

    function getSubmissionCount() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return 0;
        try {
            const records = JSON.parse(raw);
            const now = Date.now();
            const valid = records.filter(time => now - time < 3600000);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
            return valid.length;
        } catch (e) { return 0; }
    }

    function recordSubmission() {
        const raw = localStorage.getItem(STORAGE_KEY);
        const records = raw ? JSON.parse(raw) : [];
        records.push(Date.now());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    function startCooldown(seconds) {
        let remaining = seconds;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            submitBtn.style.cursor = 'not-allowed';
        }
        const template = '请稍候 ({seconds}s)';
        function updateBtnText() {
            if (submitBtnTextSpan) submitBtnTextSpan.textContent = template.replace('{seconds}', remaining);
        }
        updateBtnText();

        countdownTimer = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(countdownTimer);
                countdownTimer = null;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                }
                if (submitBtnTextSpan) submitBtnTextSpan.textContent = originalBtnText;
                isSubmitting = false;
            } else {
                updateBtnText();
            }
        }, 1000);
    }

    document.addEventListener("click", (e) => {
        if (e.target.closest(".btn-cyber-red") || e.target.closest('[data-i18n="hero_btn_quote"]')) {
            if (!e.target.closest("#quote-form")) {
                e.preventDefault();
                overlay.classList.add("is-open");
            }
        }
    });

    function close() {
        overlay.classList.remove("is-open");
        if (form) {
            form.querySelectorAll(".has-error").forEach(el => el.classList.remove("has-error"));
            form.reset();
        }
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
            }
            if (submitBtnTextSpan) submitBtnTextSpan.textContent = originalBtnText;
            isSubmitting = false;
        }
    }

    closeBtn?.addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
    });

    textarea?.addEventListener("input", () => {
        if (textarea.value.length > 2000) textarea.value = textarea.value.substring(0, 2000);
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        form.querySelectorAll(".has-error").forEach(el => el.classList.remove("has-error"));

        if (isSubmitting) { alert('请稍等，您的请求正在处理中...'); return; }

        const count = getSubmissionCount();
        if (count >= MAX_SUBMISSIONS) {
            alert('提交次数已超过每小时限制，请稍后再试。感谢您的关注！');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; submitBtn.style.cursor = 'not-allowed'; }
            return;
        }

        const honeypot = document.getElementById('fax');
        if (honeypot && honeypot.value.trim() !== '') {
            alert(document.getElementById('alert-success')?.textContent || '提交成功！');
            close();
            return;
        }

        let ok = true;
        const company = document.getElementById("form-company");
        if (!company?.value.trim()) { company?.closest(".form-group")?.classList.add("has-error"); shakeElement(company); ok = false; }

        const email = document.getElementById("form-email");
        const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email?.value.trim() || !emailReg.test(email.value.trim())) { email?.closest(".form-group")?.classList.add("has-error"); shakeElement(email); ok = false; }

        const contact = document.getElementById("form-contact-val");
        if (!contact?.value.trim()) { contact?.closest(".form-group")?.classList.add("has-error"); shakeElement(contact?.closest(".custom-single-channel")); ok = false; }

        if (!ok) return;

        // ---------- reCAPTCHA token 获取 ----------
        let recaptchaToken = '';
        try {
            // 等待 grecaptcha 就绪
            await new Promise((resolve, reject) => {
                const checkReady = () => {
                    if (window.grecaptcha && typeof window.grecaptcha.execute === 'function') {
                        resolve();
                    } else {
                        setTimeout(checkReady, 100);
                    }
                };
                checkReady();
                // 超时保护
                setTimeout(() => reject(new Error('reCAPTCHA 加载超时')), 10000);
            });

            // 获取 token
            recaptchaToken = await grecaptcha.execute('6LdTVK4tAAAAAJJBFHQKn_uK004O62nX_uHItzgV', { action: 'submit' });
            document.getElementById('g-recaptcha-response').value = recaptchaToken;
            console.log('Token 获取成功:', recaptchaToken);
        } catch (error) {
            console.error('reCAPTCHA 失败:', error);
            alert('人机验证组件加载失败，请刷新页面后重试。');
            return;
        }
        // -------------------------------------

        isSubmitting = true;
        if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.6'; submitBtn.style.cursor = 'wait'; }

        const formData = new FormData();
        formData.append('email', email.value.trim());
        formData.append('company', company.value.trim());
        formData.append('contact', contact.value.trim());
        formData.append('fullname', document.getElementById("form-name")?.value || '');
        formData.append('role', document.getElementById("form-role")?.value || '');
        formData.append('service', document.getElementById("form-service")?.value || '');
        formData.append('message', document.getElementById("form-info")?.value || '');
        formData.append('_subject', '新的咨询报价请求');
        // 添加 reCAPTCHA token
        formData.append('g-recaptcha-response', recaptchaToken);

        const msgSuccess = document.getElementById('alert-success')?.textContent || '提交成功！';
        const msgEmailError = document.getElementById('alert-email-error')?.textContent || '请检查邮箱地址';
        const msgNetworkError = document.getElementById('alert-network-error')?.textContent || '网络错误';

        try {
            const response = await fetch('https://formspree.io/f/xojojwrq', {
                method: 'POST', headers: { 'Accept': 'application/json' }, body: formData
            });
            if (response.ok) {
                recordSubmission();
                alert(msgSuccess);
                close();
            } else {
                const data = await response.json();
                alert(data.errors ? msgEmailError : msgNetworkError);
                isSubmitting = false;
                if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; submitBtn.style.cursor = 'pointer'; }
            }
        } catch (error) {
            alert(msgNetworkError);
            isSubmitting = false;
            if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; submitBtn.style.cursor = 'pointer'; }
        }

        if (!countdownTimer) startCooldown(COOLDOWN_SECONDS);
    });
}

/* ========== 服务条款弹窗（支持三语） ========== */
function initPolicyModal() {
    const policyModal = document.getElementById('policy-modal');
    const showPolicyLink = document.getElementById('show-policy');
    if (!policyModal || !showPolicyLink) return;

    showPolicyLink.addEventListener('click', (e) => {
        e.preventDefault();
        const lang = window.currentLang || 'en';
        policyModal.querySelectorAll('.policy-content-lang').forEach(el => {
            el.style.display = el.getAttribute('data-lang-policy') === lang ? 'block' : 'none';
        });
        policyModal.classList.add('is-open');
    });

    const closeBtn = policyModal.querySelector('.policy-modal-close');
    closeBtn?.addEventListener('click', () => policyModal.classList.remove('is-open'));
    policyModal.addEventListener('click', (e) => { if (e.target === policyModal) policyModal.classList.remove('is-open'); });
}

/* ========== 免费网站安全扫描工具（带修复按钮 + 推销文案 + 自动重渲染 + 持久化冷却） ========== */
function initQuickScanner() {
    const scanInput = document.getElementById('scan-url-input');
    const scanBtn = document.getElementById('scan-btn');
    const complianceCheck = document.getElementById('compliance-check');
    const resultBox = document.getElementById('scan-result');
    const scanStatus = document.getElementById('scan-status');
    const scanModal = document.getElementById('scan-modal');
    const scanModalContent = document.getElementById('scan-modal-content');

    if (!scanBtn || !scanInput || !resultBox || !scanStatus || !scanModal || !scanModalContent) return;

    let lastScanData = null;
    let scanCooldownTimer = null;
    const SCAN_COOLDOWN_SECONDS = 60;
    const COOLDOWN_STORAGE_KEY = 'scan_cooldown_end';

    function getCooldownEnd() {
        const stored = localStorage.getItem(COOLDOWN_STORAGE_KEY);
        return stored ? parseInt(stored, 10) : 0;
    }

    function setCooldownEnd(endTime) {
        localStorage.setItem(COOLDOWN_STORAGE_KEY, endTime.toString());
    }

    function clearCooldownEnd() {
        localStorage.removeItem(COOLDOWN_STORAGE_KEY);
    }

    function updateScanButtonState() {
        const isCooldown = scanCooldownTimer !== null || getCooldownEnd() > Date.now();
        scanBtn.disabled = !complianceCheck.checked || isCooldown;
    }

    if (complianceCheck) {
        complianceCheck.addEventListener('change', updateScanButtonState);
    }

    function closeScanModal() {
        scanModal.classList.remove('is-open');
    }

    const closeScanBtn = scanModal.querySelector('.scan-modal-close');
    closeScanBtn?.addEventListener('click', closeScanModal);
    scanModal.addEventListener('click', (e) => { if (e.target === scanModal) closeScanModal(); });

    function updateCooldownDisplay(remaining) {
        if (!scanStatus) return;
        scanStatus.style.display = 'inline';
        const template = t('cooldown_msg') || '{seconds}s cooldown';
        scanStatus.textContent = template.replace('{seconds}', remaining);
    }

    function startScanCooldownByEndTime(endTime) {
        if (scanCooldownTimer) clearInterval(scanCooldownTimer);

        function tick() {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
            if (remaining <= 0) {
                clearInterval(scanCooldownTimer);
                scanCooldownTimer = null;
                scanStatus.style.display = 'none';
                scanStatus.textContent = '';
                clearCooldownEnd();
                updateScanButtonState();
                return;
            }
            updateCooldownDisplay(remaining);
        }

        tick();
        scanCooldownTimer = setInterval(tick, 1000);
        scanBtn.disabled = true;
    }

    function startScanCooldown() {
        const endTime = Date.now() + SCAN_COOLDOWN_SECONDS * 1000;
        setCooldownEnd(endTime);
        startScanCooldownByEndTime(endTime);
    }

    (function checkPersistedCooldown() {
        const cooldownEnd = getCooldownEnd();
        if (cooldownEnd > Date.now()) {
            startScanCooldownByEndTime(cooldownEnd);
        } else if (cooldownEnd) {
            clearCooldownEnd();
        }
        updateScanButtonState();
    })();

    function renderScanResult(data) {
        let html = `<div class="score-line">${t('scan_score_prefix')}${data.score}</div>`;
        html += `<table class="scan-result-table"><tbody>`;

        for (const [key, check] of Object.entries(data.checks)) {
            const checkId = check.id || key;
            let statusIcon = check.passed ? '✅' : '❌';
            let statusClass = check.passed ? 'pass' : 'fail';

            const labelTranslated = t('scan_check_label_' + checkId) || check.label;
            let recTranslated = '';
            if (checkId === 'csp') {
                if (!check.passed) {
                    recTranslated = t('scan_check_rec_csp_missing');
                } else {
                    const sub = check.sub || '';
                    if (sub.includes('unsafe_inline') || sub.includes('unsafe_eval')) {
                        recTranslated = t('scan_check_rec_csp_present_unsafe');
                    } else {
                        recTranslated = t('scan_check_rec_csp_present_safe');
                    }
                }
            } else if (checkId === 'server_info_leak') {
                if (check.sub && check.sub.includes('cloudflare')) {
                    recTranslated = t('scan_check_rec_server_info_leak_cdnty');
                } else {
                    recTranslated = t('scan_check_rec_server_info_leak_generic');
                }
            } else {
                recTranslated = t('scan_check_rec_' + checkId) || check.recommendation;
            }

            let analysisText = '';
            if (check.sub) {
                const subKey = 'scan_sub_' + check.sub.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                analysisText = t(subKey) || check.sub;
            } else if (check.passed) {
                if (checkId === 'https') {
                    analysisText = t('scan_analysis_enabled');
                } else if (checkId === 'server_info_leak') {
                    analysisText = t('scan_analysis_not_found');
                } else {
                    const val = check.current_value || '';
                    analysisText = val.length > 40 ? val.substring(0, 40) + '…' : val;
                }
            } else {
                if (checkId === 'server_info_leak') {
                    analysisText = t('scan_analysis_leak');
                } else {
                    analysisText = t('scan_analysis_not_set');
                }
            }

            if (checkId === 'csp' && check.sub && check.passed) {
                statusIcon = '⚠️';
                statusClass = 'warn';
            }

            const needFix = !check.passed || (checkId === 'csp' && check.sub);
            const fixButton = needFix ? `<button class="fix-btn">${t('fix_btn')}</button>` : '';

            html += `<tr class="scan-row ${statusClass}">
                <td class="scan-label">${escapeHtml(labelTranslated)}</td>
                <td class="scan-status">${statusIcon}</td>
                <td class="scan-analysis">${escapeHtml(analysisText)}</td>
                <td class="scan-action">${fixButton}</td>
            </tr>`;

            if (needFix) {
                html += `<tr class="scan-fix-row" style="display:none;">
                    <td colspan="4" class="scan-fix-text">💡 ${escapeHtml(recTranslated)}</td>
                </tr>`;
            }
        }

        html += `</tbody></table>`;
        html += `<div class="scan-upsell">${escapeHtml(t('scan_upsell'))}</div>`;

        scanModalContent.innerHTML = html;
        scanModalContent.querySelectorAll('.fix-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const row = this.closest('tr');
                const fixRow = row.nextElementSibling;
                if (fixRow && fixRow.classList.contains('scan-fix-row')) {
                    fixRow.style.display = fixRow.style.display === 'none' ? 'table-row' : 'none';
                }
            });
        });
    }

    window.addEventListener('languageChanged', () => {
        if (scanModal.classList.contains('is-open') && lastScanData) {
            renderScanResult(lastScanData);
        }
        if (scanCooldownTimer !== null || getCooldownEnd() > Date.now()) {
            const cooldownEnd = getCooldownEnd();
            if (cooldownEnd > Date.now()) {
                const remaining = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
                if (remaining > 0) {
                    updateCooldownDisplay(remaining);
                }
            }
        }
    });

    scanBtn.addEventListener('click', async () => {
        if (scanCooldownTimer !== null || getCooldownEnd() > Date.now() || !complianceCheck.checked) return;

        let url = scanInput.value.trim();
        if (!url) return;

        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
            scanInput.value = url;
        }

        scanStatus.style.display = 'inline';
        scanStatus.textContent = t('scan_loading');
        resultBox.style.display = 'none';

        try {
            const apiEndpoint = '/api/scan?url=' + encodeURIComponent(url);
            const response = await fetch(apiEndpoint);
            const data = await response.json();

            scanStatus.style.display = 'none';

            if (data.error) {
                resultBox.style.display = 'block';
                resultBox.innerHTML = `<div style="color:#ef4444;">${t('scan_error_prefix')}${escapeHtml(data.error)}</div>`;
                return;
            }

            startScanCooldown();

            lastScanData = data;
            renderScanResult(data);
            scanModal.classList.add('is-open');

        } catch (err) {
            scanStatus.style.display = 'none';
            resultBox.style.display = 'block';
            resultBox.innerHTML = `<div style="color:#ef4444;">${t('scan_network_error')}</div>`;
        }
    });
}

/* ========== 服务详情表格列高亮 ========== */
function initServiceDetailColumnHighlight() {
    const table = document.querySelector('.nav-item.service-detail table');
    if (!table) return;

    const headers = table.querySelectorAll('th[data-col]');
    if (!headers.length) return;

    headers.forEach(th => {
        th.addEventListener('mouseenter', function() {
            const colIndex = this.getAttribute('data-col');
            this.classList.add('col-highlight');
            const tds = table.querySelectorAll(`tbody td:nth-child(${colIndex})`);
            tds.forEach(td => td.classList.add('col-highlight'));
        });

        th.addEventListener('mouseleave', function() {
            const colIndex = this.getAttribute('data-col');
            this.classList.remove('col-highlight');
            const tds = table.querySelectorAll(`tbody td:nth-child(${colIndex})`);
            tds.forEach(td => td.classList.remove('col-highlight'));
        });
    });
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function renderServiceDetailTable() {
    const container = document.getElementById('service-detail-table-container');
    if (!container || !window.fallbackTranslations) return;

    const t = (key) => window.fallbackTranslations[key] || key;

    const headers = [
        t('sd_th1'),
        t('sd_th2'),
        t('sd_th3'),
        t('sd_th4'),
        t('sd_th5')
    ];

    const rows = [];
    for (let i = 1; i <= 10; i++) {
        const label = t(`sd_row${i}_label`);
        const cells = [];
        for (let j = 1; j <= 4; j++) {
            cells.push(t(`sd_row${i}_c${j}`));
        }
        rows.push({ label, cells });
    }

    let html = `<table>`;
    html += `<thead><tr>`;
    headers.forEach((header, index) => {
        html += `<th style="width: ${index === 0 ? '12%' : '22%'};" data-col="${index + 1}">${escapeHtml(header)}</th>`;
    });
    html += `</tr></thead><tbody>`;

    rows.forEach(row => {
        html += `<tr>`;
        html += `<td>${escapeHtml(row.label)}</td>`;
        row.cells.forEach(cell => {
            html += `<td>${escapeHtml(cell)}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    html += `<p style="margin-top: 12px; color: #cbd5e1; line-height: 1.5; font-size: 0.85rem;">${escapeHtml(t('sd_footer_note'))}</p>`;

    container.innerHTML = html;
    initServiceDetailColumnHighlight();
}
