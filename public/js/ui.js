(function () {
  function tr(key, vars) {
    return window.i18n ? window.i18n.t(key, vars) : key;
  }

  function label(key) {
    if (!key) return '-';
    const translated = tr(`enum.${key}`);
    return translated !== `enum.${key}` ? translated : key;
  }

  function formatDate(dateStr) {
    const locale = window.i18n?.getLang?.() === 'en' ? 'en-GB' : 'zh-HK';
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }

  function formatMoney(amount, currency = 'jpy') {
    const locale = window.i18n?.getLang?.() === 'en' ? 'en-GB' : 'ja-JP';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function resortLabel(id, region) {
    const r = (resorts || []).find((x) => x.id === id);
    if (!r) {
      const regionLabel = region ? label(region) : label(id);
      return regionLabel;
    }
    const lang = window.i18n?.getLang?.() || 'zh';
    return lang === 'en' && r.nameEn ? r.nameEn : r.name;
  }

  function statusBadge(status) {
    const colors = {
      pending: 'bg-amber-100 text-amber-800',
      confirmed: 'bg-blue-100 text-blue-800',
      assigned: 'bg-green-100 text-green-800',
      completed: 'bg-slate-100 text-slate-800',
      cancelled: 'bg-red-100 text-red-800',
      needs_attention: 'bg-orange-100 text-orange-800',
    };
    return `<span class="px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}">${label(status)}</span>`;
  }

  let resorts = [];

  function setResortConfig(list) {
    resorts = list || [];
  }

  window.ui = { t: tr, label, formatDate, formatMoney, resortLabel, statusBadge, setResortConfig };
})();
