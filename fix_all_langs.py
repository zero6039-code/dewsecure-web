import os, json, re

# --- 第一部分：生成 6 国语言包 ---
with open('locales/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

# 日语
ja = en.copy()
ja.update({
    "nav_home": "ホーム", "nav_pricing": "価格", "nav_update": "更新履歴", "nav_pentest": "セキュリティ監査", "nav_login": "ログイン",
    "hero_title": "あなたのデバイス、あなたのルール。", "hero_desc": "AIを搭載したコンテンツ最適化とセキュリティエンジン。悪意のあるトラッカーやフィッシングを深くブロックし、高速な読み込みでクリーンで安全なブラウジング体験を実現します。",
    "hero_btn_download": "Chrome拡張機能をダウンロード", "hero_btn_pricing": "価格を見る",
    "confirm_cancel": "キャンセル", "confirm_ok": "確認", "dash_tier_free": "無料", "dash_tier_pro": "Pro", "dash_tier_family": "ファミリー"
})
# 韩语
ko = en.copy()
ko.update({
    "nav_home": "홈", "nav_pricing": "가격", "nav_update": "업데이트", "nav_pentest": "보안 감사", "nav_login": "로그인",
    "hero_title": "당신의 기기, 당신의 규칙.", "hero_desc": "AI 기반 콘텐츠 최적화 및 보안 엔진. 악성 트래커와 피싱을 심층 차단하고 빠른 로딩으로 깨끗한 브라우징 경험을 제공합니다.",
    "hero_btn_download": "Chrome 확장 프로그램 다운로드", "hero_btn_pricing": "가격 보기",
    "confirm_cancel": "취소", "confirm_ok": "확인", "dash_tier_free": "무료", "dash_tier_pro": "Pro", "dash_tier_family": "패밀리"
})
# 西班牙语
es = en.copy()
es.update({
    "nav_home": "Inicio", "nav_pricing": "Precios", "nav_update": "Novedades", "nav_pentest": "Auditoría", "nav_login": "Iniciar sesión",
    "hero_title": "Tu dispositivo, tus reglas.", "hero_desc": "Motor de seguridad y optimización con IA. Bloquea rastreadores y phishing con carga ultrarrápida para una experiencia limpia y segura.",
    "hero_btn_download": "Descargar Extensión Chrome", "hero_btn_pricing": "Ver Precios",
    "confirm_cancel": "Cancelar", "confirm_ok": "Confirmar", "dash_tier_free": "Gratis", "dash_tier_pro": "Pro", "dash_tier_family": "Familiar"
})
# 葡萄牙语
pt = en.copy()
pt.update({
    "nav_home": "Início", "nav_pricing": "Preços", "nav_update": "Atualizações", "nav_pentest": "Auditoria", "nav_login": "Entrar",
    "hero_title": "Seu dispositivo, suas regras.", "hero_desc": "Motor de segurança e otimização com IA. Bloqueia rastreadores e phishing com carregamento ultrarrápido.",
    "hero_btn_download": "Baixar Extensão Chrome", "hero_btn_pricing": "Ver Preços",
    "confirm_cancel": "Cancelar", "confirm_ok": "Confirmar", "dash_tier_free": "Grátis", "dash_tier_pro": "Pro", "dash_tier_family": "Família"
})
# 德语
de = en.copy()
de.update({
    "nav_home": "Startseite", "nav_pricing": "Preise", "nav_update": "Änderungen", "nav_pentest": "Sicherheitsaudit", "nav_login": "Anmelden",
    "hero_title": "Dein Gerät, deine Regeln.", "hero_desc": "KI-gestützte Content-Optimierung und Sicherheits-Engine. Blockiert Tracker und Phishing mit blitzschnellem Laden.",
    "hero_btn_download": "Chrome-Erweiterung herunterladen", "hero_btn_pricing": "Preise ansehen",
    "confirm_cancel": "Abbrechen", "confirm_ok": "Bestätigen", "dash_tier_free": "Kostenlos", "dash_tier_pro": "Pro", "dash_tier_family": "Familie"
})
# 法语
fr = en.copy()
fr.update({
    "nav_home": "Accueil", "nav_pricing": "Tarifs", "nav_update": "Mises à jour", "nav_pentest": "Audit de sécurité", "nav_login": "Connexion",
    "hero_title": "Votre appareil, vos règles.", "hero_desc": "Moteur de sécurité et d'optimisation IA. Bloque les trackers et le phishing avec un chargement ultra-rapide.",
    "hero_btn_download": "Télécharger l'extension Chrome", "hero_btn_pricing": "Voir les tarifs",
    "confirm_cancel": "Annuler", "confirm_ok": "Confirmer", "dash_tier_free": "Gratuit", "dash_tier_pro": "Pro", "dash_tier_family": "Famille"
})

for lang_name, data in [('ja', ja), ('ko', ko), ('es', es), ('pt', pt), ('de', de), ('fr', fr)]:
    with open(f'locales/{lang_name}.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# --- 第二部分：修改 i18n.js ---
with open('js/i18n.js', 'r', encoding='utf-8') as f:
    i18n_content = f.read()
i18n_content = i18n_content.replace("if (!['zh', 'en', 'ms'].includes(lang)) {", "if (false) {")
with open('js/i18n.js', 'w', encoding='utf-8') as f:
    f.write(i18n_content)

# --- 第三部分：批量替换 HTML 菜单 ---
new_dropdown = """<ul class="lang-dropdown">
                <li data-lang="zh" class="lang-option">中文 (简体)</li>
                <li data-lang="en" class="lang-option">English</li>
                <li data-lang="ms" class="lang-option">Bahasa Melayu</li>
                <li data-lang="ja" class="lang-option">日本語</li>
                <li data-lang="ko" class="lang-option">한국어</li>
                <li data-lang="es" class="lang-option">Español</li>
                <li data-lang="pt" class="lang-option">Português</li>
                <li data-lang="de" class="lang-option">Deutsch</li>
                <li data-lang="fr" class="lang-option">Français</li>
            </ul>"""

html_files = ["index.html", "pricing.html", "dashboard.html", "about/index.html", "guide/index.html", "login/index.html", "update/index.html"]
for file in html_files:
    if os.path.exists(file):
        with open(file, 'r', encoding='utf-8') as f:
            html = f.read()
        html = re.sub(r'<ul class="lang-dropdown">.*?</ul>', new_dropdown, html, flags=re.DOTALL)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"✅ 已更新 {file} 的语言菜单")

print("✅ 全部完成！")
