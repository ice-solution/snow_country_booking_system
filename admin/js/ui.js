(function () {
  function tr(key, vars) {
    return window.i18n ? window.i18n.t(key, vars) : key;
  }

  function label(key) {
    if (!key) return '-';
    const resort = resortMap[key];
    if (resort) {
      const lang = window.i18n?.getLang?.() || 'zh';
      return lang === 'en' && resort.nameEn ? resort.nameEn : resort.name;
    }
    const translated = tr(`enum.${key}`);
    return translated !== `enum.${key}` ? translated : key;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const locale = window.i18n?.getLang?.() === 'en' ? 'en-GB' : 'zh-HK';
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
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

  function toast(message, type = 'info') {
    const el = document.getElementById('toast');
    const colors = {
      info: 'bg-slate-800',
      success: 'bg-green-700',
      error: 'bg-red-700',
    };
    el.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg text-white shadow-lg z-50 ${colors[type]}`;
    el.textContent = message;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function formatMoney(amount, currency = 'jpy') {
    if (!amount) return '-';
    const locale = window.i18n?.getLang?.() === 'en' ? 'en-GB' : 'ja-JP';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount);
  }

  let resortMap = {};

  function setResortConfig(resorts) {
    resortMap = Object.fromEntries((resorts || []).map((r) => [r.id, r]));
    window.ui.resortMap = resortMap;
  }

  function resortLabel(resortId, regionId) {
    const r = resortMap[resortId];
    if (r) {
      const lang = window.i18n?.getLang?.() || 'zh';
      return lang === 'en' && r.nameEn ? r.nameEn : r.name;
    }
    return label(resortId) !== resortId ? label(resortId) : label(regionId);
  }

  function formatLessonDateRange(booking) {
    if (Array.isArray(booking.lessonSlots) && booking.lessonSlots.length) {
      const slots = booking.lessonSlots;
      if (slots.length === 1) {
        const s = slots[0];
        return `${formatDate(s.date)} ${s.startTime || booking.lessonStartTime || '09:00'} (${s.durationHours || booking.durationHours}h)`;
      }
      return slots
        .map((s) => `${formatDate(s.date)} ${s.startTime || '09:00'}`)
        .join(window.i18n?.getLang?.() === 'en' ? ', ' : '、') + ` (${slots.length} ${tr('public.slotsUnit')})`;
    }
    const from = booking.lessonDateFrom || booking.lessonDate;
    const to = booking.lessonDateTo || booking.lessonDateFrom || booking.lessonDate;
    if (!from) return '-';
    const fromStr = formatDate(from);
    const toStr = formatDate(to);
    if (fromStr === toStr) return fromStr;
    const dayCount = booking.lessonDayCount || Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
    return `${fromStr} – ${toStr} (${dayCount} ${tr('common.days')})`;
  }

  window.ui = {
    t: tr,
    label,
    resortLabel,
    setResortConfig,
    formatDate,
    formatLessonDateRange,
    statusBadge,
    toast,
    formatMoney,
    resortMap,
  };
})();
