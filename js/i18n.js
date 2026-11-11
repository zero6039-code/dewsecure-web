// js/i18n.js
window.currentLang = 'en';
window.fallbackTranslations = {};

window.loadLanguage = async function(lang) {
    if (false) {
        alert("该语言正在开发中，目前仅支持中文、英文和马来文。");
        return;
    }

    try {
        // 1. 决定当前页面需要加载哪些模块
        const path = window.location.pathname;
        let modules = ['common']; // 全局必载
        
        if (path.includes('/pricing') || path === '/pricing.html') modules.push('pricing');
        if (path.includes('/guide') || path === '/guide.html') modules.push('guide');

        // 2. 并发拉取所有需要的语言包
        const fetchPromises = modules.map(mod => {
            // 决定路径：common 在 /locales/common/，其他的在对应页面目录下
            const url = mod === 'common' 
                ? `/locales/common/${lang}.json?v=${Date.now()}`
                : `/${mod}/locales/${lang}.json?v=${Date.now()}`;
                
            return fetch(url)
                .then(res => res.ok ? res.json() : {})
                .catch(() => ({}));
        });

        const dicts = await Promise.all(fetchPromises);
        
        // 3. 合并所有字典 (后面的会覆盖前面的，通常无冲突)
        const mergedTranslations = Object.assign({}, ...dicts);

        window.fallbackTranslations = mergedTranslations;
        window.currentLang = lang;

        // 🌟 调用全局翻译方法
        if (window.translatePage) window.translatePage();

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

// 🌟 暴露全局翻译函数
window.translatePage = function() {
    const translations = window.fallbackTranslations;
    if (!translations) return;

    // 翻译普通文本
    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.getAttribute("data-i18n");
        let targetText = translations[key];
        if (targetText !== undefined && targetText !== null) {
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

// 🌟 暴露全局单键翻译函数
window.t = function(key) {
    const translations = window.fallbackTranslations;
    return (translations && translations[key]) ? translations[key] : key;
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
