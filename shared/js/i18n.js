(function () {
  const STORAGE_KEY = 'sc_lang';
  let lang = 'zh';
  let dict = {};

  function resolve(key, locale) {
    const locales = window.I18N_LOCALES || {};
    return locales[locale]?.[key] ?? locales.zh?.[key] ?? key;
  }

  function t(key, vars = {}) {
    let str = dict[key] ?? resolve(key, 'zh');
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replaceAll(`{${k}}`, String(v));
    });
    return str;
  }

  function styleLangButtons(containerId, options = {}) {
    const dark = options.dark;
    document.querySelectorAll(`#${containerId} [data-lang]`).forEach((btn) => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle('bg-brand-500', active);
      btn.classList.toggle('text-white', active);
      if (dark) {
        btn.classList.toggle('bg-ink-700', !active);
        btn.classList.toggle('text-ink-200', !active);
      } else {
        btn.classList.toggle('bg-slate-200', !active);
        btn.classList.toggle('text-slate-700', !active);
      }
    });
  }

  function setLocale(locale, options = {}) {
    if (!window.I18N_LOCALES?.[locale]) return;
    lang = locale;
    dict = window.I18N_LOCALES[locale];
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale === 'zh' ? 'zh-Hant' : 'en';
    document.querySelectorAll('[data-lang]').forEach((btn) => {
      const active = btn.dataset.lang === locale;
      const container = btn.closest('#langSwitcher, #loginLangSwitcher, #adminLangSwitcher');
      const onDark =
        container?.classList.contains('bg-ink-800') ||
        Boolean(btn.closest('.bg-ink-900, #loginGate'));
      btn.classList.toggle('bg-brand-500', active);
      btn.classList.toggle('text-white', active);
      if (onDark) {
        btn.classList.toggle('bg-ink-700', !active);
        btn.classList.toggle('text-ink-200', !active);
        btn.classList.toggle('bg-slate-200', false);
        btn.classList.toggle('text-slate-700', false);
      } else {
        btn.classList.toggle('bg-slate-200', !active);
        btn.classList.toggle('text-slate-700', !active);
        btn.classList.toggle('bg-ink-700', false);
        btn.classList.toggle('text-ink-200', false);
      }
    });
  }

  function applyPage() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      document.title = t(el.dataset.i18nTitle);
    });
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  function setLang(locale) {
    setLocale(locale);
    applyPage();
  }

  function getLang() {
    return lang;
  }

  function init(defaultLang = 'zh') {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = window.I18N_LOCALES?.[saved] ? saved : defaultLang;
    setLocale(initial);
    applyPage();
  }

  function mountLangSwitcher(containerId, options = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
      <button type="button" data-lang="zh" class="px-2.5 py-1 rounded text-xs font-medium transition">中文</button>
      <button type="button" data-lang="en" class="px-2.5 py-1 rounded text-xs font-medium transition">EN</button>
    `;
    el.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
    styleLangButtons(containerId, options);
  }

  window.i18n = { init, t, setLang, getLang, applyPage, mountLangSwitcher };
})();
