// js/i18n.js
window.currentLang = 'en'; 
window.fallbackTranslations = {};

// 🌟 暴露全局单键翻译函数，供其他脚本使用
window.t = function(key) {
    const translations = window.fallbackTranslations;
    return (translations && translations[key]) ? translations[key] : key;
};


window.loadLanguage = async function(lang) {
    if (false) {
        alert("该语言正在开发中，目前仅支持中文、英文和马来文。");
        return;
    }

    try {
        const response = await fetch(`/locales/${lang}.json?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`无法加载语言文件: ${lang}`);
        const translations = await response.json();

        window.fallbackTranslations = translations;
        window.currentLang = lang;
        
        // 🌟 调用全局翻译方法
        window.translatePage();

        localStorage.setItem("preferred_lang", lang);
        updateDropdownUI(lang);
        
        // 解锁全站透明度护盾
        document.documentElement.classList.remove("i18n-loading");
        document.documentElement.setAttribute("data-i18n-ready", "true");

        window.dispatchEvent(new Event('languageChanged'));

    } catch (error) {
        console.error("国际化加载失败:", error);
        document.documentElement.classList.remove("i18n-loading");
        document.documentElement.setAttribute("data-i18n-ready", "true");
    }
}

// 🌟 暴露全局翻译函数，供 Swup 和 auth-nav 调用
window.translatePage = function() {
    const translations = window.fallbackTranslations;
    if (!translations) return;
    
    // 翻译普通文本
    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.getAttribute("data-i18n");
        let targetText = translations[key];
        if (targetText !== undefined && targetText !== null) {
            // 🌟 核心修复：严格检查是否声明了 HTML 渲染权限，否则一律只当纯文本
            if (element.hasAttribute("data-i18n-html")) {
                element.innerHTML = targetText;
            } else {
                element.textContent = targetText;
            }
        }
    });

    // 翻译 Placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
        const key = element.getAttribute("data-i18n-placeholder");
        if (translations[key]) element.setAttribute("placeholder", translations[key]);
    });
};

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
    let defaultLang = localStorage.getItem("preferred_lang") || 'en';
    
    await loadLanguage(defaultLang);

    document.addEventListener('click', (e) => {
        const option = e.target.closest('.lang-option');
        if (option) {
            e.preventDefault();
            e.stopPropagation();
            loadLanguage(option.getAttribute('data-lang'));
        }
    });
})();
