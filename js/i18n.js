// js/i18n.js
window.currentLang = 'zh';
window.fallbackTranslations = {};

// 预加载默认语言，防止页面加载完还没数据
async function initFallback() {
    try {
        const response = await fetch('/locales/zh.json');
        if (response.ok) {
            window.fallbackTranslations = await response.json();
        }
    } catch(e) {}
}

async function loadLanguage(lang) {
    if (!['zh', 'en', 'ms'].includes(lang)) {
        alert("该语言正在开发中，目前仅支持中文、英文和马来文。");
        return;
    }

    try {
        const response = await fetch(`/locales/${lang}.json`);
        if (!response.ok) throw new Error(`无法加载语言文件: ${lang}`);
        const translations = await response.json();

        window.fallbackTranslations = translations;
        
        // 静默替换，不隐藏元素，消除闪烁
        document.querySelectorAll("[data-i18n]").forEach(element => {
            const key = element.getAttribute("data-i18n");
            let targetText = translations[key];
            if (targetText !== undefined && targetText !== null) {
                if (/<[a-z="']/i.test(targetText)) {
                    element.innerHTML = targetText;
                } else {
                    element.textContent = targetText;
                }
            }
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
            const key = element.getAttribute("data-i18n-placeholder");
            let targetAttrText = translations[key];
            if (targetAttrText) {
                element.setAttribute("placeholder", targetAttrText);
            }
        });

        localStorage.setItem("preferred_lang", lang);
        window.currentLang = lang;
        updateDropdownUI(lang);
        
        // 移除加载状态
        document.documentElement.classList.remove("i18n-loading");
        document.documentElement.setAttribute("data-i18n-ready", "true");

        window.dispatchEvent(new Event('languageChanged'));

    } catch (error) {
        console.error("国际化加载失败:", error);
        document.documentElement.classList.remove("i18n-loading");
    }
}

function updateDropdownUI(activeLang) {
    document.querySelectorAll(".lang-option").forEach(option => {
        if (option.getAttribute("data-lang") === activeLang) {
            option.classList.add("active");
        } else {
            option.classList.remove("active");
        }
    });
}

(async () => {
    await initFallback();
    let defaultLang = localStorage.getItem("preferred_lang") || 'zh';
    if (!['zh', 'en', 'ms'].includes(defaultLang)) defaultLang = 'zh';
    
    await loadLanguage(defaultLang);

    // 绑定语言切换事件
    document.addEventListener('click', (e) => {
        const option = e.target.closest('.lang-option');
        if (option) {
            e.preventDefault();
            e.stopPropagation();
            loadLanguage(option.getAttribute('data-lang'));
        }
    });
})();
