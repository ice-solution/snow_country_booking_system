const t = (key, vars) => i18n.t(key, vars);

function formatGuestDateRange(g) {
  const from = g.lessonDateFrom || g.lessonDate;
  const to = g.lessonDateTo || g.lessonDateFrom || g.lessonDate;
  const fromStr = ui.formatDate(from);
  const toStr = ui.formatDate(to);
  if (fromStr === toStr) return fromStr;
  const dayCount = g.lessonDayCount || Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  return `${fromStr} – ${toStr} (${dayCount} ${t('common.days')})`;
}

function field(label, value) {
  const display = value || '-';
  const href =
    label === 'Email' && value
      ? `mailto:${value}`
      : label === 'WhatsApp' && value
        ? `https://wa.me/${value.replace(/\D/g, '')}`
        : null;
  const inner = href
    ? `<a href="${href}" class="text-brand-600 hover:underline" target="_blank" rel="noopener">${display}</a>`
    : display;
  return `<p><span class="text-slate-500">${label}</span><br><span class="font-medium">${inner}</span></p>`;
}

function renderGuest(g) {
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="bg-white border rounded-xl shadow-sm p-6 space-y-6">
      <div>
        <h1 class="text-2xl font-bold">${g.guestName}</h1>
        <p class="text-sm text-slate-500 mt-1">${ui.statusBadge(g.status)} · ${ui.label(g.source)}</p>
      </div>

      <section>
        <h2 class="font-semibold text-lg mb-3">${t('guest.lessonInfo')}</h2>
        <div class="grid sm:grid-cols-2 gap-4 text-sm">
          ${field(t('admin.col.date'), `${formatGuestDateRange(g)} ${g.lessonStartTime} (${g.durationHours} ${t('common.hours')})`)}
          ${field(t('public.resort'), ui.resortLabel(g.resortLocation, g.region))}
          ${field(t('public.lessonType'), ui.label(g.lessonType))}
          ${field(t('public.languagePref'), ui.label(g.languagePref))}
          ${field(t('public.totalGuests'), `${g.totalGuests} ${t('common.people')}`)}
          ${field(t('public.childrenUnder6'), String(g.childrenUnder6))}
          ${field(t('public.coachesRequired'), String(g.coachesRequired))}
          ${g.assignedCoaches?.length ? field(t('admin.assignedCoaches'), g.assignedCoaches.join(', ')) : ''}
        </div>
      </section>

      <section>
        <h2 class="font-semibold text-lg mb-3">${t('guest.contactInfo')}</h2>
        <div class="grid sm:grid-cols-2 gap-4 text-sm">
          ${field(t('public.phone'), g.phone)}
          ${field('Email', g.email)}
        </div>
      </section>

      <section>
        <h2 class="font-semibold text-lg mb-3">${t('admin.socialContacts')}</h2>
        <div class="grid sm:grid-cols-2 gap-4 text-sm">
          ${field(t('admin.instagram'), g.instagram)}
          ${field(t('admin.facebook'), g.facebook)}
          ${field(t('admin.whatsapp'), g.whatsapp)}
          ${field(t('admin.line'), g.line)}
          ${field(t('admin.wechat'), g.wechat)}
        </div>
      </section>

      <section>
        <h2 class="font-semibold text-lg mb-3">${t('admin.specialRequests')}</h2>
        <p class="text-sm text-slate-700 whitespace-pre-wrap">${g.specialRequests || '-'}</p>
      </section>
    </div>
  `;
}

async function loadGuest() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const coachId = params.get('coachId');
  const el = document.getElementById('content');

  if (!id) {
    el.innerHTML = `<p class="text-red-600 text-center">${t('guest.missingId')}</p>`;
    return;
  }

  try {
    let res;
    if (coachId) {
      res = await fetch(`/api/v1/coach-view/bookings/${id}?coachId=${encodeURIComponent(coachId)}`);
    } else {
      const apiKey = localStorage.getItem('adminApiKey') || '';
      res = await fetch(`/api/v1/bookings/${id}/guest`, {
        headers: apiKey ? { 'X-API-Key': apiKey } : {},
      });
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || t('guest.loadFail'));

    try {
      const meta = await fetch('/api/v1/meta');
      const metaData = await meta.json();
      if (metaData.success) ui.setResortConfig(metaData.data.resortConfig);
    } catch {
      /* resort names optional */
    }

    window._guestData = data.data;
    renderGuest(data.data);
  } catch (err) {
    el.innerHTML = `<p class="text-red-600 text-center">${err.message}</p>`;
  }
}

function boot() {
  i18n.init('zh');
  i18n.mountLangSwitcher('langSwitcher', { dark: true });
  window.addEventListener('langchange', () => {
    i18n.applyPage();
    if (window._guestData) renderGuest(window._guestData);
    else loadGuest();
  });
  loadGuest();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
