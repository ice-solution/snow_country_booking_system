let meta = null;
let pendingScheduleDate = null;
let currentPage = 'dashboard';
const t = (key, vars) => i18n.t(key, vars);

const PAGE_TITLE_KEYS = {
  dashboard: 'admin.nav.dashboard',
  bookings: 'admin.nav.bookings',
  'new-booking': 'admin.nav.newBooking',
  instructors: 'admin.nav.instructors',
  schedule: 'admin.nav.schedule',
  'head-schedule': 'admin.nav.headSchedule',
  pricing: 'admin.nav.pricing',
  klook: 'admin.nav.klook',
};

function leavePeriodLabel(period) {
  const labels = {
    full: 'admin.leaveFullDay',
    half_am: 'admin.leaveHalfAm',
    half_pm: 'admin.leaveHalfPm',
  };
  return t(labels[period] || labels.full);
}

function leavePeriodGanttLabel() {
  return t('admin.dayOff');
}

function guestPageLink(bookingId, guestName, className = 'text-brand-600 hover:underline') {
  if (!bookingId || !guestName) return guestName || '-';
  return `<a href="/guest.html?id=${bookingId}" target="_blank" rel="noopener" class="${className}">${guestName}</a>`;
}

function bookingDateIso(booking, field) {
  const val = booking[field] || booking.lessonDate;
  if (!val) return '';
  return new Date(val).toISOString().split('T')[0];
}

function bindLessonDateRange(form) {
  const fromInput = form.querySelector('[name=lessonDateFrom]');
  const toInput = form.querySelector('[name=lessonDateTo]');
  if (!fromInput || !toInput) return;
  const syncToMin = () => {
    toInput.min = fromInput.value;
    if (toInput.value && toInput.value < fromInput.value) {
      toInput.value = fromInput.value;
    }
  };
  fromInput.addEventListener('change', syncToMin);
  syncToMin();
}

function renderSocialContacts(b) {
  const fields = [
    ['admin.instagram', b.instagram],
    ['admin.facebook', b.facebook],
    ['admin.whatsapp', b.whatsapp],
    ['admin.line', b.line],
    ['admin.wechat', b.wechat],
  ];
  return `
    <div class="md:col-span-2 border-t pt-4 mt-2">
      <h4 class="font-medium mb-2">${t('admin.socialContacts')}</h4>
      <div class="grid md:grid-cols-2 gap-2">
        ${fields.map(([key, val]) => `<p><strong>${t(key)}:</strong> ${val || '-'}</p>`).join('')}
      </div>
    </div>
  `;
}

function showInstructorLeaveDialog(coachId) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 class="font-semibold text-lg mb-4">${t('admin.coachLeave')}</h3>
        <form id="instructorLeaveForm" class="space-y-3">
          <label class="text-sm block">
            <span class="text-slate-600">${t('coach.leaveDate')}</span>
            <input type="date" name="date" required class="mt-1 w-full border rounded-lg px-3 py-2">
          </label>
          <fieldset class="text-sm">
            <legend class="text-slate-600 mb-1">${t('admin.leavePeriod')}</legend>
            <label class="mr-4"><input type="radio" name="period" value="full" checked> ${t('admin.leaveFullDay')}</label>
            <label class="mr-4"><input type="radio" name="period" value="half_am"> ${t('admin.leaveHalfAm')}</label>
            <label><input type="radio" name="period" value="half_pm"> ${t('admin.leaveHalfPm')}</label>
          </fieldset>
          <label class="text-sm block">
            <span class="text-slate-600">${t('coach.leaveReason')}</span>
            <input type="text" name="reason" class="mt-1 w-full border rounded-lg px-3 py-2">
          </label>
          <div class="flex gap-2 pt-2">
            <button type="submit" class="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm">${t('common.confirm')}</button>
            <button type="button" id="cancelLeaveDialog" class="px-4 py-2 border rounded-lg text-sm">${t('common.cancel')}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cancelLeaveDialog').addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });
    overlay.querySelector('#instructorLeaveForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const period = form.period.value;
      const payload = {
        date: form.date.value,
        reason: form.reason.value,
        period,
      };
      overlay.remove();
      resolve(payload);
    });
  });
}

function showAdminApp() {
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
}

function showLoginGate() {
  document.getElementById('loginGate').classList.remove('hidden');
  document.getElementById('adminApp').classList.add('hidden');
}

async function verifyAndEnter() {
  try {
    const res = await api.getMeta();
    meta = res.data;
    ui.setResortConfig(meta.resortConfig || meta.pricing?.resorts || []);
    showAdminApp();
    navigate('dashboard');
    return true;
  } catch {
    return false;
  }
}

async function init() {
  i18n.setLang('en');

  window.addEventListener('langchange', () => {
    document.getElementById('pageTitle').textContent = t(PAGE_TITLE_KEYS[currentPage] || currentPage);
    if (document.getElementById('adminApp') && !document.getElementById('adminApp').classList.contains('hidden')) {
      navigate(currentPage);
    }
  });

  document.getElementById('loginBtn').addEventListener('click', async () => {
    const key = document.getElementById('loginApiKey').value.trim();
    const errEl = document.getElementById('loginError');
    if (!key) {
      errEl.textContent = t('admin.loginRequired');
      errEl.classList.remove('hidden');
      return;
    }
    setApiKey(key);
    const ok = await verifyAndEnter();
    if (!ok) {
      errEl.textContent = t('admin.loginFail');
      errEl.classList.remove('hidden');
      setApiKey('');
    } else {
      errEl.classList.add('hidden');
    }
  });

  document.getElementById('loginApiKey').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    setApiKey('');
    showLoginGate();
    document.getElementById('loginApiKey').value = '';
  });

  document.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  const storedKey = getApiKey();
  if (storedKey) {
    document.getElementById('loginApiKey').value = storedKey;
    const ok = await verifyAndEnter();
    if (!ok) showLoginGate();
  } else {
    showLoginGate();
  }
}

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('[data-page]').forEach((btn) => {
    btn.classList.toggle('bg-brand-500', btn.dataset.page === page);
    btn.classList.toggle('text-white', btn.dataset.page === page);
  });

  const titles = PAGE_TITLE_KEYS;
  document.getElementById('pageTitle').textContent = t(titles[page] || page);

  if (page === 'dashboard') loadDashboard();
  if (page === 'bookings') loadBookings();
  if (page === 'instructors') loadInstructors();
  if (page === 'new-booking') renderNewBookingForm();
  if (page === 'schedule') loadScheduleView({ headOnly: false, initialDate: pendingScheduleDate });
  if (page === 'head-schedule') loadScheduleView({ headOnly: true, initialDate: pendingScheduleDate });
  pendingScheduleDate = null;
  if (page === 'pricing') loadPricing();
  if (page === 'klook') loadKlookImport();
}

async function loadDashboard() {
  const container = document.getElementById('content');
  container.innerHTML = '<p class="text-slate-500">' + t('common.loading') + '</p>';

  try {
    const [pending, confirmed, assigned, needsAttention, alertsRes] = await Promise.all([
      api.listBookings({ status: 'pending' }),
      api.listBookings({ status: 'confirmed' }),
      api.listBookings({ status: 'assigned' }),
      api.listBookings({ status: 'needs_attention' }),
      api.getAlerts(),
    ]);

    const { alerts, summary } = alertsRes.data;

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        ${statCard(t('admin.stat.pending'), pending.data.length, 'amber', 'bookings', 'pending')}
        ${statCard(t('admin.stat.confirmed'), confirmed.data.length, 'blue', 'bookings', 'confirmed')}
        ${statCard(t('admin.stat.assigned'), assigned.data.length, 'green', 'bookings', 'assigned')}
        ${statCard(t('admin.stat.needsAttention'), needsAttention.data.length, 'orange', 'bookings', 'needs_attention')}
      </div>
      ${alerts.length ? `
      <div class="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-semibold text-lg text-orange-900">⚠️ ${t('admin.alerts')} (${summary.total})</h3>
          <span class="text-xs text-orange-700">${t('admin.priorityHigh')} ${summary.high} · ${t('admin.priorityMed')} ${summary.medium}</span>
        </div>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          ${alerts.slice(0, 8).map((a) => `
            <div class="flex justify-between items-start gap-4 text-sm bg-white rounded-lg px-4 py-3 border border-orange-100">
              <p class="${a.severity === 'high' ? 'text-red-700' : 'text-orange-800'}">${a.message}</p>
              ${a.bookingId ? `<button data-goto-booking="${a.bookingId}" class="text-brand-600 hover:underline whitespace-nowrap text-xs">${t('admin.view')}</button>` : ''}
            </div>
          `).join('')}
        </div>
      </div>` : ''}
      <div class="bg-white rounded-xl shadow-sm border p-6">
        <h3 class="font-semibold text-lg mb-4">${t('admin.recentPending')}</h3>
        ${renderBookingTable(pending.data.slice(0, 5), { compact: true })}
      </div>
    `;

    container.querySelectorAll('[data-filter]').forEach((el) => {
      el.addEventListener('click', () => {
        navigate('bookings');
        setTimeout(() => {
          document.getElementById('statusFilter').value = el.dataset.filter;
          loadBookings();
        }, 0);
      });
    });
    container.querySelectorAll('[data-goto-booking]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigate('bookings');
        setTimeout(() => showBookingDetail(btn.dataset.gotoBooking), 100);
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="text-red-600">${err.message}</p>`;
  }
}

function statCard(title, count, color, page, filter) {
  const colors = {
    amber: 'border-amber-200 bg-amber-50',
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    orange: 'border-orange-200 bg-orange-50',
  };
  return `
    <button data-filter="${filter}" class="text-left border rounded-xl p-5 ${colors[color]} hover:shadow-md transition">
      <p class="text-sm text-slate-600">${title}</p>
      <p class="text-3xl font-bold mt-2">${count}</p>
    </button>
  `;
}

async function loadBookings() {
  const container = document.getElementById('content');
  const status = document.getElementById('statusFilter')?.value || '';

  container.innerHTML = `
    <div class="flex flex-wrap gap-3 mb-4 items-center">
      <select id="statusFilter" class="border rounded-lg px-3 py-2 text-sm">
        <option value="">${t('admin.allStatus')}</option>
        ${(meta?.bookingStatuses || []).map((s) => `<option value="${s}" ${status === s ? 'selected' : ''}>${ui.label(s)}</option>`).join('')}
      </select>
      <button id="refreshBookings" class="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm">${t('common.refresh')}</button>
    </div>
    <div id="bookingsTable"><p class="text-slate-500">${t('common.loading')}</p></div>
    <div id="bookingDetail" class="hidden mt-6"></div>
  `;

  document.getElementById('statusFilter').addEventListener('change', loadBookings);
  document.getElementById('refreshBookings').addEventListener('click', loadBookings);

  try {
    const params = status ? { status } : {};
    const res = await api.listBookings(params);
    document.getElementById('bookingsTable').innerHTML = renderBookingTable(res.data);
    bindBookingActions();
  } catch (err) {
    document.getElementById('bookingsTable').innerHTML = `<p class="text-red-600">${err.message}</p>`;
  }
}

function renderBookingTable(bookings, { compact = false } = {}) {
  if (!bookings.length) {
    return '<p class="text-slate-500 py-8 text-center">' + t('admin.noBookings') + '</p>';
  }

  return `
    <div class="overflow-x-auto bg-white rounded-xl border shadow-sm">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left">
          <tr>
            <th class="px-4 py-3">${t('admin.col.date')}</th>
            <th class="px-4 py-3">${t('admin.col.guest')}</th>
            <th class="px-4 py-3">${t('admin.col.lesson')}</th>
            <th class="px-4 py-3">${t('admin.col.guests')}</th>
            <th class="px-4 py-3">${t('admin.col.coaches')}</th>
            <th class="px-4 py-3">${t('admin.col.source')}</th>
            <th class="px-4 py-3">${t('admin.col.payment')}</th>
            <th class="px-4 py-3">${t('admin.col.status')}</th>
            ${compact ? '' : `<th class="px-4 py-3">${t('admin.col.actions')}</th>`}
          </tr>
        </thead>
        <tbody>
          ${bookings
            .map(
              (b) => `
            <tr class="border-t hover:bg-slate-50">
              <td class="px-4 py-3">${ui.formatLessonDateRange(b)}<br><span class="text-xs text-slate-500">${b.lessonStartTime || '09:00'} · ${b.durationHours}h · ${ui.resortLabel(b.resortLocation, b.region)}</span></td>
              <td class="px-4 py-3">${guestPageLink(b._id, b.guestName)}<br><span class="text-xs text-slate-500">${b.phone}</span></td>
              <td class="px-4 py-3">${ui.label(b.lessonType)}</td>
              <td class="px-4 py-3">${b.totalGuests} ${t('common.people')}<br><span class="text-xs text-slate-500">${t('admin.childrenUnder6Short')}: ${b.childrenUnder6}</span></td>
              <td class="px-4 py-3">${t('public.coachesNeeded', { n: b.instructorsRequired })}${b.assignedInstructors?.length ? `<br><span class="text-xs text-green-700">${b.assignedInstructors.map((a) => a.instructor?.name || '-').join(', ')}</span>` : ''}</td>
              <td class="px-4 py-3">${ui.label(b.source)}</td>
              <td class="px-4 py-3">${b.totalAmount ? ui.formatMoney(b.totalAmount, b.currency) : '-'}<br><span class="text-xs text-slate-500">${ui.label(b.paymentStatus || '')}</span></td>
              <td class="px-4 py-3">${ui.statusBadge(b.status)}</td>
              ${
                compact
                  ? ''
                  : `<td class="px-4 py-3 space-x-1 whitespace-nowrap">
                <button data-action="view" data-id="${b._id}" class="text-brand-600 hover:underline">${t('admin.action.detail')}</button>
                ${b.status === 'pending' ? `<button data-action="confirm" data-id="${b._id}" class="text-green-600 hover:underline">${t('admin.action.confirm')}</button>` : ''}
                ${b.status === 'confirmed' ? `<button data-action="auto-assign" data-id="${b._id}" class="text-purple-600 hover:underline">${t('admin.action.autoAssign')}</button><button data-action="assign" data-id="${b._id}" class="text-blue-600 hover:underline">${t('admin.action.assign')}</button>` : ''}
                ${['assigned', 'needs_attention'].includes(b.status) ? `<button data-action="reassign" data-id="${b._id}" class="text-blue-600 hover:underline">${t('admin.action.reassign')}</button>` : ''}
                ${b.status === 'needs_attention' ? `<button data-action="resolve" data-id="${b._id}" class="text-teal-600 hover:underline">${t('admin.action.resolve')}</button>` : ''}
                ${b.status === 'assigned' ? `<button data-action="complete" data-id="${b._id}" class="text-green-600 hover:underline">${t('admin.action.complete')}</button>` : ''}
                ${!['cancelled', 'completed', 'needs_attention'].includes(b.status) ? `<button data-action="needs-attention" data-id="${b._id}" class="text-orange-600 hover:underline">${t('admin.action.needsAttention')}</button>` : ''}
                ${!['cancelled', 'completed'].includes(b.status) ? `<button data-action="cancel" data-id="${b._id}" class="text-red-600 hover:underline">${t('admin.action.cancel')}</button>` : ''}
              </td>`
              }
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function lessonTimeOptions(selected = '09:00') {
  const options = [];
  for (let mins = 8 * 60 + 30; mins <= 16 * 60; mins += 30) {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    const time = `${h}:${m}`;
    options.push(`<option value="${time}" ${time === selected ? 'selected' : ''}>${time}</option>`);
  }
  return options.join('');
}

function resortDisplayName(r) {
  return i18n.getLang() === 'en' && r.nameEn ? r.nameEn : r.name;
}

function regionDisplayName(region) {
  const key = `enum.${region.id}`;
  const label = t(key);
  return label !== key ? label : region.name;
}

function durationOptions(selected) {
  return [3, 4, 5, 6]
    .map(
      (h) =>
        `<option value="${h}" ${Number(selected) === h ? 'selected' : ''}>${h} ${t('common.hours')}</option>`
    )
    .join('');
}

function lessonTypeOptions(selected) {
  return [
    { value: 'ski', key: 'enum.ski' },
    { value: 'snowboard', key: 'enum.snowboard' },
  ]
    .map(
      (o) =>
        `<option value="${o.value}" ${selected === o.value ? 'selected' : ''}>${t(o.key)}</option>`
    )
    .join('');
}

function languagePrefOptions(selected = 'any') {
  return ['any', 'zh', 'en']
    .map(
      (v) =>
        `<option value="${v}" ${selected === v ? 'selected' : ''}>${ui.label(v)}</option>`
    )
    .join('');
}

function heatLevelOptions(selected = 'medium') {
  return ['high', 'medium', 'low']
    .map(
      (v) =>
        `<option value="${v}" ${selected === v ? 'selected' : ''}>${ui.label(v)}</option>`
    )
    .join('');
}

function canEditBooking(b) {
  return !['completed', 'cancelled'].includes(b.status);
}

function canFullyEditBooking(b) {
  return ['pending', 'confirmed', 'needs_attention'].includes(b.status);
}

function bindBookingActions() {
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { action, id } = btn.dataset;
      try {
        if (action === 'confirm') {
          await api.confirmBooking(id);
          ui.toast(t('admin.bookingConfirmed'), 'success');
          loadBookings();
        } else if (action === 'cancel') {
          if (!confirm(t('admin.confirmCancel'))) return;
          await api.cancelBooking(id);
          ui.toast(t('admin.bookingCancelled'), 'success');
          loadBookings();
        } else if (action === 'view') {
          showBookingDetail(id);
        } else if (action === 'assign') {
          showAssignPanel(id, 'assign');
        } else if (action === 'reassign') {
          showAssignPanel(id, 'reassign');
        } else if (action === 'auto-assign') {
          if (!confirm(t('admin.confirmAutoAssign'))) return;
          await api.autoAssignInstructors(id);
          ui.toast(t('admin.autoAssignOk'), 'success');
          loadBookings();
        } else if (action === 'needs-attention') {
          const note = prompt(t('admin.needsAttentionPrompt')) || t('admin.needsAttentionDefault');
          await api.markNeedsAttention(id, { adminNotes: note });
          ui.toast(t('admin.markedAttention'), 'success');
          loadBookings();
        } else if (action === 'resolve') {
          if (!confirm(t('admin.confirmResolve'))) return;
          await api.resolveBooking(id);
          ui.toast(t('admin.resolved'), 'success');
          loadBookings();
        } else if (action === 'complete') {
          if (!confirm(t('admin.confirmComplete'))) return;
          await api.completeBooking(id);
          ui.toast(t('admin.lessonCompleted'), 'success');
          loadBookings();
        }
      } catch (err) {
        ui.toast(err.message, 'error');
      }
    });
  });
}

async function showBookingDetail(id) {
  const panel = document.getElementById('bookingDetail');
  panel.classList.remove('hidden');
  panel.innerHTML = `<p class="text-slate-500">${t('common.loading')}</p>`;

  try {
    const res = await api.getBooking(id);
    const b = res.data;
    const editable = canEditBooking(b);
    const fullEdit = canFullyEditBooking(b);

    panel.innerHTML = `
      <div class="bg-white border rounded-xl p-6 shadow-sm">
        <div class="flex flex-wrap justify-between items-start gap-3 mb-4">
          <div>
            <h3 class="text-lg font-semibold">${t('admin.bookingDetail')}</h3>
            <p class="text-sm text-slate-500">${b.guestName} · ${ui.label(b.source)}</p>
          </div>
          <div class="flex flex-wrap gap-2 items-center">
            ${ui.statusBadge(b.status)}
            ${b.status === 'pending' ? `<button data-detail-action="confirm" class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs">${t('admin.action.confirm')}</button>` : ''}
            ${b.status === 'confirmed' ? `<button data-detail-action="assign" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs">${t('admin.action.assign')}</button>` : ''}
            ${['assigned', 'needs_attention'].includes(b.status) ? `<button data-detail-action="reassign" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs">${t('admin.action.reassign')}</button>` : ''}
            ${b.status === 'needs_attention' ? `<button data-detail-action="resolve" class="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs">${t('admin.action.resolve')}</button>` : ''}
            ${b.status === 'assigned' ? `<button data-detail-action="complete" class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs">${t('admin.markComplete')}</button>` : ''}
            ${!['cancelled', 'completed', 'needs_attention'].includes(b.status) ? `<button data-detail-action="needs-attention" class="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs">${t('admin.action.needsAttention')}</button>` : ''}
            ${!['cancelled', 'completed'].includes(b.status) ? `<button data-detail-action="cancel" class="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs">${t('admin.action.cancel')}</button>` : ''}
          </div>
        </div>

        ${editable ? `
        <form id="editBookingForm" class="grid md:grid-cols-2 gap-4 text-sm border-t pt-4">
          <div>
            <label class="block text-xs text-slate-500 mb-1">${t('public.lessonDateFrom')}</label>
            <input name="lessonDateFrom" type="date" value="${bookingDateIso(b, 'lessonDateFrom')}" ${fullEdit ? '' : 'disabled'} class="border rounded-lg px-3 py-2 w-full disabled:bg-slate-50">
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">${t('public.lessonDateTo')}</label>
            <input name="lessonDateTo" type="date" value="${bookingDateIso(b, 'lessonDateTo')}" ${fullEdit ? '' : 'disabled'} class="border rounded-lg px-3 py-2 w-full disabled:bg-slate-50">
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">${t('admin.startTime')}</label>
            <select name="lessonStartTime" class="border rounded-lg px-3 py-2 w-full">
              ${lessonTimeOptions(b.lessonStartTime || '09:00')}
            </select>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">${t('public.resort')}</label>
            <select name="resortLocation" class="border rounded-lg px-3 py-2 w-full">
              ${renderResortSelectOptionsFor(b.resortLocation)}
            </select>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">${t('public.duration')}</label>
            <select name="durationHours" ${fullEdit ? '' : 'disabled'} class="border rounded-lg px-3 py-2 w-full disabled:bg-slate-50">
              ${durationOptions(b.durationHours)}
            </select>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">${t('public.lessonType')}</label>
            <select name="lessonType" ${fullEdit ? '' : 'disabled'} class="border rounded-lg px-3 py-2 w-full disabled:bg-slate-50">
              ${lessonTypeOptions(b.lessonType)}
            </select>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">${t('admin.paymentStatus')}</label>
            <select name="paymentStatus" class="border rounded-lg px-3 py-2 w-full">
              ${(meta?.paymentStatuses || []).map((s) => `<option value="${s}" ${b.paymentStatus === s ? 'selected' : ''}>${ui.label(s)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">${t('public.totalGuests')}</label>
            <input name="totalGuests" type="number" min="1" value="${b.totalGuests}" ${fullEdit ? '' : 'disabled'} class="border rounded-lg px-3 py-2 w-full disabled:bg-slate-50">
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">${t('public.childrenUnder6')}</label>
            <input name="childrenUnder6" type="number" min="0" value="${b.childrenUnder6}" ${fullEdit ? '' : 'disabled'} class="border rounded-lg px-3 py-2 w-full disabled:bg-slate-50">
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-500 mb-1">${t('admin.adminNotes')}</label>
            <textarea name="adminNotes" rows="2" class="border rounded-lg px-3 py-2 w-full">${b.adminNotes || ''}</textarea>
          </div>
          <div class="md:col-span-2 flex gap-2">
            <button type="submit" class="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm">${t('admin.saveChanges')}</button>
            <button type="button" id="closeBookingDetail" class="px-4 py-2 border rounded-lg text-sm">${t('common.close')}</button>
          </div>
        </form>
        ` : `
        <div class="grid md:grid-cols-2 gap-4 text-sm border-t pt-4">
          <p><strong>${t('admin.col.date')}:</strong> ${ui.formatLessonDateRange(b)} ${b.lessonStartTime || '09:00'} (${b.durationHours} ${t('common.hours')})</p>
          <p><strong>${t('public.resort')}:</strong> ${ui.resortLabel(b.resortLocation, b.region)}</p>
        </div>
        `}

        <div class="grid md:grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t">
          <p><strong>${t('admin.col.guest')}:</strong> ${b.guestName}</p>
          <p><strong>${t('public.phone')}:</strong> ${b.phone}</p>
          <p><strong>Email:</strong> ${b.email || '-'}</p>
          ${renderSocialContacts(b)}
          <p><strong>${t('public.languagePref')}:</strong> ${ui.label(b.languagePref)}</p>
          <p><strong>${t('public.instructorsRequired')}:</strong> ${b.instructorsRequired}</p>
          <p><strong>${t('public.estimatedFee')}:</strong> ${ui.formatMoney(b.totalAmount, b.currency)} · ${ui.label(b.paymentMethod)}</p>
          ${b.assignedInstructors?.length ? `<p class="md:col-span-2"><strong>${t('admin.assignedInstructors')}:</strong> ${b.assignedInstructors.map((a) => a.instructor?.name || '-').join(', ')}</p>` : ''}
          <p class="md:col-span-2"><strong>${t('admin.specialRequests')}:</strong> ${b.specialRequests || '-'}</p>
          ${b.klookOrderId ? `<p><strong>${t('admin.klookOrder')}:</strong> ${b.klookOrderId}</p>` : ''}
        </div>
      </div>
    `;

    const editForm = panel.querySelector('#editBookingForm');
    if (editForm) bindLessonDateRange(editForm);

    panel.querySelector('#closeBookingDetail')?.addEventListener('click', () => {
      panel.classList.add('hidden');
    });

    panel.querySelector('#editBookingForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const body = {
        lessonStartTime: form.lessonStartTime.value,
        resortLocation: form.resortLocation.value,
        adminNotes: form.adminNotes.value,
        paymentStatus: form.paymentStatus.value,
      };
      if (fullEdit) {
        Object.assign(body, {
          lessonDateFrom: form.lessonDateFrom.value,
          lessonDateTo: form.lessonDateTo.value,
          durationHours: Number(form.durationHours.value),
          lessonType: form.lessonType.value,
          totalGuests: Number(form.totalGuests.value),
          childrenUnder6: Number(form.childrenUnder6.value),
        });
      }
      try {
        await api.updateBooking(id, body);
        ui.toast(t('admin.bookingUpdated'), 'success');
        showBookingDetail(id);
        const table = document.getElementById('bookingsTable');
        if (table) {
          const status = document.getElementById('statusFilter')?.value || '';
          const res2 = await api.listBookings(status ? { status } : {});
          table.innerHTML = renderBookingTable(res2.data);
          bindBookingActions();
        }
      } catch (err) {
        ui.toast(err.message, 'error');
      }
    });

    panel.querySelectorAll('[data-detail-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.detailAction;
        try {
          if (action === 'confirm') {
            await api.confirmBooking(id);
            ui.toast(t('admin.bookingConfirmed'), 'success');
          } else if (action === 'assign') {
            showAssignPanel(id, 'assign');
            return;
          } else if (action === 'reassign') {
            showAssignPanel(id, 'reassign');
            return;
          } else if (action === 'resolve') {
            if (!confirm(t('admin.confirmResolve'))) return;
            await api.resolveBooking(id);
            ui.toast(t('admin.resolved'), 'success');
          } else if (action === 'complete') {
            if (!confirm(t('admin.confirmComplete'))) return;
            await api.completeBooking(id);
            ui.toast(t('admin.lessonCompleted'), 'success');
          } else if (action === 'needs-attention') {
            const note = prompt(t('admin.needsAttentionPrompt')) || t('admin.needsAttentionDefault');
            await api.markNeedsAttention(id, { adminNotes: note });
            ui.toast(t('admin.markedAttention'), 'success');
          } else if (action === 'cancel') {
            if (!confirm(t('admin.confirmCancel'))) return;
            await api.cancelBooking(id);
            ui.toast(t('admin.bookingCancelled'), 'success');
          }
          showBookingDetail(id);
          loadBookings();
        } catch (err) {
          ui.toast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    panel.innerHTML = `<p class="text-red-600">${err.message}</p>`;
  }
}

async function showAssignPanel(id, mode = 'assign') {
  const isReassign = mode === 'reassign';
  const panel = document.getElementById('bookingDetail');
  panel.classList.remove('hidden');
  panel.innerHTML = `<p class="text-slate-500">${t('common.loading')}</p>`;

  try {
    const [bookingRes, suggestRes] = await Promise.all([
      api.getBooking(id),
      api.suggestInstructors(id, isReassign),
    ]);
    const b = bookingRes.data;
    const { suggestions, allEligible, instructorsRequired, lessonDayCount, canAutoAssign } = suggestRes.data;
    const currentCoaches = (b.assignedInstructors || [])
      .map((a) => a.instructor?.name)
      .filter(Boolean)
      .join(', ');

    panel.innerHTML = `
      <div class="bg-white border rounded-xl p-6 shadow-sm">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-lg font-semibold">${isReassign ? t('admin.reassignTitle') : t('admin.assignTitle')}: ${b.guestName} · ${ui.formatLessonDateRange(b)}</h3>
            <p class="text-sm text-slate-600">${t('public.coachesNeeded', { n: instructorsRequired })}${lessonDayCount > 1 ? ` · ${lessonDayCount} ${t('common.days')}` : ''}</p>
            ${isReassign && currentCoaches ? `<p class="text-xs text-slate-500 mt-1">Current: ${currentCoaches}</p>` : ''}
          </div>
          ${canAutoAssign ? `<button id="autoAssignBtn" class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">${isReassign ? t('admin.action.autoAssign') : t('admin.action.autoAssign')}</button>` : ''}
        </div>

        <div class="mb-4">
          <p class="text-sm font-medium mb-2">${t('admin.systemSuggest')}</p>
          <div class="space-y-2">
            ${suggestions.length ? suggestions.map((s) => `
              <label class="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" name="instructorPick" value="${s.instructorId}" class="instructor-checkbox mt-1" ${suggestions.indexOf(s) < instructorsRequired ? 'checked' : ''}>
                <div class="flex-1">
                  <p class="font-medium">${s.name} <span class="text-xs text-slate-500">score ${s.score}</span></p>
                  <p class="text-xs text-slate-500">${s.specialties.map(ui.label).join(', ')} · ${s.languages.map(ui.label).join(', ')} · ${ui.label(s.heatLevel)}</p>
                  ${s.breakdown ? `<p class="text-xs text-slate-400 mt-1">${s.breakdown.map((x) => `${x.factor} ${x.points > 0 ? '+' : ''}${x.points}`).join(' · ')}</p>` : ''}
                </div>
              </label>
            `).join('') : `<p class="text-amber-600 text-sm">${t('admin.allEligible')}</p>`}
          </div>
        </div>

        <div class="mb-4">
          <p class="text-sm font-medium mb-2">${t('admin.allEligible')}</p>
          <select id="manualInstructorSelect" multiple class="w-full border rounded-lg p-2 text-sm h-32">
            ${allEligible.map((c) => `<option value="${c.instructorId}">${c.name} (score ${c.score})</option>`).join('')}
          </select>
        </div>

        <button id="confirmAssign" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">${isReassign ? t('admin.action.reassign') : t('admin.confirmAssign')}</button>
      </div>
    `;

    document.getElementById('confirmAssign').addEventListener('click', async () => {
      const checked = [...document.querySelectorAll('.instructor-checkbox:checked')].map((el) => el.value);
      const manual = [...document.getElementById('manualInstructorSelect').selectedOptions].map((o) => o.value);
      const instructorIds = checked.length ? checked : manual;

      if (instructorIds.length !== instructorsRequired) {
        ui.toast(t('public.coachesNeeded', { n: instructorsRequired }), 'error');
        return;
      }

      try {
        if (isReassign) {
          await api.reassignInstructors(id, instructorIds);
          ui.toast(t('admin.reassignOk'), 'success');
        } else {
          await api.assignInstructors(id, instructorIds);
          ui.toast(t('admin.assignOk'), 'success');
        }
        loadBookings();
        panel.classList.add('hidden');
      } catch (err) {
        ui.toast(err.message, 'error');
      }
    });

    document.getElementById('autoAssignBtn')?.addEventListener('click', async () => {
      if (isReassign && !confirm(t('admin.confirmAutoReassign'))) return;
      if (!isReassign && !confirm(t('admin.confirmAutoAssign'))) return;
      try {
        if (isReassign) {
          await api.autoReassignInstructors(id);
          ui.toast(t('admin.autoReassignOk'), 'success');
        } else {
          await api.autoAssignInstructors(id);
          ui.toast(t('admin.autoAssignOk'), 'success');
        }
        loadBookings();
        panel.classList.add('hidden');
      } catch (err) {
        ui.toast(err.message, 'error');
      }
    });
  } catch (err) {
    panel.innerHTML = `<p class="text-red-600">${err.message}</p>`;
  }
}

async function loadInstructors() {
  const container = document.getElementById('content');
  container.innerHTML = '<p class="text-slate-500">' + t('common.loading') + '</p>';

  try {
    const [res, pendingRes] = await Promise.all([api.listInstructors(), api.listPendingLeave()]);
    const pending = pendingRes.data || [];

    container.innerHTML = `
      ${pending.length ? `
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <h3 class="font-semibold text-amber-900 mb-3">${t('admin.pendingLeave')}</h3>
          <div class="space-y-2 text-sm" id="pendingLeaveList">
            ${pending.map((p) => `
              <div class="flex flex-wrap justify-between gap-2 items-center bg-white rounded-lg border px-3 py-2">
                <span><strong>${p.instructorName}</strong> · ${ui.formatDate(p.date)} (${leavePeriodLabel(p.period)})${p.reason ? ` · ${p.reason}` : ''}</span>
                <span class="flex gap-2">
                  <button data-leave-action="approve" data-instructor="${p.instructorId}" data-request="${p.requestId}" class="px-2 py-1 bg-green-600 text-white rounded text-xs">${t('admin.approveLeave')}</button>
                  <button data-leave-action="reject" data-instructor="${p.instructorId}" data-request="${p.requestId}" class="px-2 py-1 border border-red-300 text-red-600 rounded text-xs">${t('admin.rejectLeave')}</button>
                </span>
              </div>`).join('')}
          </div>
        </div>` : ''}
      <div class="flex justify-between mb-4">
        <p class="text-sm text-slate-600">${res.data.length} coach(es)</p>
        <button id="showInstructorForm" class="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm">${t('admin.addInstructor')}</button>
      </div>
      <div id="instructorForm" class="hidden mb-6"></div>
      <div class="grid gap-4">
        ${res.data.map(renderInstructorCard).join('')}
      </div>
    `;

    container.querySelectorAll('[data-leave-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const action = btn.dataset.leaveAction;
          await api.reviewLeave(btn.dataset.instructor, btn.dataset.request, action);
          ui.toast(action === 'approve' ? t('admin.leaveSet') : 'Rejected', 'success');
          loadInstructors();
        } catch (err) {
          ui.toast(err.message, 'error');
        }
      });
    });

    document.getElementById('showInstructorForm').addEventListener('click', () => {
      const form = document.getElementById('instructorForm');
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) {
        form.innerHTML = renderInstructorForm();
        bindInstructorFormSubmit();
      }
    });

    container.querySelectorAll('[data-instructor-action="block"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const payload = await showInstructorLeaveDialog(btn.dataset.id);
        if (!payload) return;
        try {
          const res = await api.blockInstructorDate(btn.dataset.id, payload);
          ui.toast(res.message || t('admin.leaveSet'), res.affectedBookings > 0 ? 'error' : 'success');
          loadInstructors();
        } catch (err) {
          ui.toast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('[data-instructor-action="unblock"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(t('admin.confirmUnblock', { date: btn.dataset.date }))) return;
        try {
          await api.unblockInstructorDate(btn.dataset.id, { date: btn.dataset.date });
          ui.toast(t('admin.leaveRemoved'), 'success');
          loadInstructors();
        } catch (err) {
          ui.toast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="text-red-600">${err.message}</p>`;
  }
}

function renderInstructorCard(coach) {
  const blocked = (coach.blockedDates || [])
    .map(
      (b) =>
        `<span class="inline-flex items-center gap-1 mr-2">${ui.formatDate(b.date)} (${leavePeriodLabel(b.period)})${b.reason ? ` — ${b.reason}` : ''}<button data-instructor-action="unblock" data-id="${coach._id}" data-date="${new Date(b.date).toISOString().split('T')[0]}" class="text-brand-600 hover:underline">${t('admin.coachUnblock')}</button></span>`
    )
    .join('');

  return `
    <div class="bg-white border rounded-xl p-5 shadow-sm ${coach.active ? '' : 'opacity-60'}" data-instructor-id="${coach._id}">
      <div class="flex justify-between items-start gap-4">
        <div class="flex-1">
          <h3 class="font-semibold text-lg">${coach.name}
            ${coach.isHeadInstructor ? '<span class="text-xs bg-brand-100 text-brand-800 px-2 py-0.5 rounded ml-1">Head</span>' : ''}
            ${coach.isMainland ? `<span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">${t('admin.coachMainland')}</span>` : ''}
          </h3>
          <p class="text-sm text-slate-600 mt-1">${coach.phone || ''} ${coach.email ? '· ' + coach.email : ''}</p>
          <p class="text-sm mt-2">
            ${coach.specialties.map((s) => `<span class="inline-block bg-brand-100 text-brand-800 px-2 py-0.5 rounded text-xs mr-1">${ui.label(s)}</span>`).join('')}
            ${coach.languages.map((l) => `<span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs mr-1">${ui.label(l)}</span>`).join('')}
          </p>
          <p class="text-xs text-slate-500 mt-2">${ui.label(coach.heatLevel)} · ${coach.skillLevel}/5 · max ${coach.maxDailyLessons}/day</p>
          ${blocked ? `<p class="text-xs text-red-600 mt-2">${t('admin.coachLeave')}: ${blocked}</p>` : ''}
          ${(coach.leaveRequests || []).filter((lr) => lr.status === 'pending').map((lr) => `<p class="text-xs text-amber-600 mt-1">${t('coach.pendingLeave')}: ${ui.formatDate(lr.date)} (${leavePeriodLabel(lr.period)})</p>`).join('')}
        </div>
        <div class="text-right space-y-2">
          <span class="text-xs block ${coach.active ? 'text-green-600' : 'text-red-600'}">${coach.active ? t('admin.coachActive') : t('admin.coachInactive')}</span>
          <button data-instructor-action="block" data-id="${coach._id}" class="block text-xs text-amber-600 hover:underline">${t('admin.coachLeave')}</button>
        </div>
      </div>
    </div>
  `;
}

function renderInstructorForm() {
  return `
    <form id="createInstructorForm" class="bg-white border rounded-xl p-6 shadow-sm grid md:grid-cols-2 gap-4">
      <input name="name" placeholder="${t('admin.instructorForm.namePh')}" required class="border rounded-lg px-3 py-2">
      <input name="phone" placeholder="${t('public.phone')}" class="border rounded-lg px-3 py-2">
      <input name="email" placeholder="Email" type="email" class="border rounded-lg px-3 py-2">
      <input name="pin" type="password" minlength="4" placeholder="${t('admin.instructorForm.pinPh')}" required class="border rounded-lg px-3 py-2">
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="isMainland"> ${t('admin.coachMainland')}</label>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="isHeadInstructor"> ${t('admin.headInstructor')}</label>
      <div>
        <p class="text-sm mb-1">${t('admin.instructorForm.specialty')}</p>
        <label class="mr-3 text-sm"><input type="checkbox" name="specialties" value="ski"> ${t('enum.ski')}</label>
        <label class="text-sm"><input type="checkbox" name="specialties" value="snowboard"> ${t('enum.snowboard')}</label>
      </div>
      <div>
        <p class="text-sm mb-1">${t('admin.instructorForm.languages')}</p>
        <label class="mr-3 text-sm"><input type="checkbox" name="languages" value="zh" checked> ${t('enum.zh')}</label>
        <label class="mr-3 text-sm"><input type="checkbox" name="languages" value="en"> ${t('enum.en')}</label>
        <label class="text-sm"><input type="checkbox" name="languages" value="ja"> ${t('enum.ja')}</label>
      </div>
      <div>
        <p class="text-sm mb-1">${t('admin.instructorForm.heatLevel')}</p>
        <select name="heatLevel" class="border rounded-lg px-3 py-2 w-full">
          ${heatLevelOptions('medium')}
        </select>
      </div>
      <div>
        <p class="text-sm mb-1">${t('admin.instructorForm.skillLevel')}</p>
        <input name="skillLevel" type="number" min="1" max="5" value="3" class="border rounded-lg px-3 py-2 w-full">
      </div>
      <div class="md:col-span-2">
        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">${t('admin.instructorForm.save')}</button>
      </div>
    </form>
  `;
}

function bindInstructorFormSubmit() {
  const form = document.getElementById('createInstructorForm');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const specialties = [...form.querySelectorAll('[name=specialties]:checked')].map((el) => el.value);
    const languages = [...form.querySelectorAll('[name=languages]:checked')].map((el) => el.value);

    if (!specialties.length) {
      ui.toast(t('admin.pickSpecialty'), 'error');
      return;
    }

    try {
      await api.createInstructor({
        name: form.name.value,
        phone: form.phone.value,
        email: form.email.value,
        isMainland: form.isMainland.checked,
        isHeadInstructor: form.isHeadInstructor.checked,
        specialties,
        languages: languages.length ? languages : ['zh'],
        heatLevel: form.heatLevel.value,
        skillLevel: Number(form.skillLevel.value),
        pin: form.pin.value,
      });
      ui.toast(t('admin.instructorCreated'), 'success');
      loadInstructors();
    } catch (err) {
      ui.toast(err.message, 'error');
    }
  });
}

function renderResortSelectOptions() {
  const regions = meta?.pricing?.regions || [];
  return regions
    .map((region) => {
      const resorts = region.resorts || [];
      if (!resorts.length) return '';
      return `
        <optgroup label="${regionDisplayName(region)}">
          ${resorts.map((r) => `<option value="${r.id}">${resortDisplayName(r)}</option>`).join('')}
        </optgroup>
      `;
    })
    .join('');
}

function renderResortSelectOptionsFor(selectedId) {
  const regions = meta?.pricing?.regions || [];
  return regions
    .map((region) => {
      const resorts = region.resorts || [];
      if (!resorts.length) return '';
      return `
        <optgroup label="${regionDisplayName(region)}">
          ${resorts
            .map(
              (r) =>
                `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>${resortDisplayName(r)}</option>`
            )
            .join('')}
        </optgroup>
      `;
    })
    .join('');
}

function renderNewBookingForm() {
  const container = document.getElementById('content');
  container.innerHTML = `
    <form id="newBookingForm" class="bg-white border rounded-xl p-6 shadow-sm max-w-2xl grid gap-4">
      <div>
        <label class="text-sm block mb-1">${t('public.resort')} *</label>
        <select name="resortLocation" required class="border rounded-lg px-3 py-2 w-full">
          ${renderResortSelectOptions()}
        </select>
        <p class="text-xs text-slate-500 mt-1">${t('admin.resortSamePrice')}</p>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="text-sm block mb-1">${t('public.lessonDateFrom')} *</label>
          <input name="lessonDateFrom" type="date" required class="border rounded-lg px-3 py-2 w-full">
        </div>
        <div>
          <label class="text-sm block mb-1">${t('public.lessonDateTo')} *</label>
          <input name="lessonDateTo" type="date" required class="border rounded-lg px-3 py-2 w-full">
        </div>
        <div>
          <label class="text-sm block mb-1">${t('public.duration')} *</label>
          <select name="durationHours" required class="border rounded-lg px-3 py-2 w-full">
            ${durationOptions(4)}
          </select>
        </div>
        <div>
          <label class="text-sm block mb-1">${t('admin.startTime')}</label>
          <select name="lessonStartTime" class="border rounded-lg px-3 py-2 w-full">
            ${lessonTimeOptions('09:00')}
          </select>
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="text-sm block mb-1">${t('public.lessonType')} *</label>
          <select name="lessonType" required class="border rounded-lg px-3 py-2 w-full">
            ${lessonTypeOptions('ski')}
          </select>
        </div>
        <div>
          <label class="text-sm block mb-1">${t('public.languagePref')}</label>
          <select name="languagePref" class="border rounded-lg px-3 py-2 w-full">
            ${languagePrefOptions('any')}
          </select>
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="text-sm block mb-1">${t('public.totalGuests')} *</label>
          <input name="totalGuests" type="number" min="1" value="1" required class="border rounded-lg px-3 py-2 w-full" id="totalGuestsInput">
        </div>
        <div>
          <label class="text-sm block mb-1">${t('public.childrenUnder6')}</label>
          <input name="childrenUnder6" type="number" min="0" value="0" class="border rounded-lg px-3 py-2 w-full" id="childrenInput">
        </div>
      </div>
      <p id="instructorCalcResult" class="text-sm text-brand-700 font-medium"></p>
      <input name="guestName" placeholder="${t('public.guestName')} *" required class="border rounded-lg px-3 py-2">
      <div class="grid md:grid-cols-2 gap-4">
        <input name="phone" placeholder="${t('public.phone')} *" required class="border rounded-lg px-3 py-2">
        <input name="email" placeholder="Email" type="email" class="border rounded-lg px-3 py-2">
      </div>
      <div>
        <h3 class="text-sm font-semibold text-slate-700">${t('admin.socialContacts')}</h3>
        <div class="grid md:grid-cols-2 gap-4 mt-2">
          <input name="instagram" placeholder="${t('admin.instagram')}" class="border rounded-lg px-3 py-2">
          <input name="facebook" placeholder="${t('admin.facebook')}" class="border rounded-lg px-3 py-2">
          <input name="whatsapp" placeholder="${t('admin.whatsapp')}" class="border rounded-lg px-3 py-2">
          <input name="line" placeholder="${t('admin.line')}" class="border rounded-lg px-3 py-2">
          <input name="wechat" placeholder="${t('admin.wechat')}" class="border rounded-lg px-3 py-2">
        </div>
      </div>
      <textarea name="specialRequests" placeholder="${t('public.specialRequests')}" rows="3" class="border rounded-lg px-3 py-2"></textarea>
      <button type="submit" class="px-4 py-2 bg-brand-500 text-white rounded-lg w-fit">${t('admin.createPending')}</button>
    </form>
  `;

  async function updateInstructorCalc() {
    const totalGuests = Number(document.getElementById('totalGuestsInput').value);
    const childrenUnder6 = Number(document.getElementById('childrenInput').value);
    try {
      const res = await api.calculateInstructors(totalGuests, childrenUnder6);
      document.getElementById('instructorCalcResult').textContent = t('admin.instructorsNeeded', {
        n: res.data.instructorsRequired,
      });
    } catch {
      document.getElementById('instructorCalcResult').textContent = '';
    }
  }

  document.getElementById('totalGuestsInput').addEventListener('input', updateInstructorCalc);
  document.getElementById('childrenInput').addEventListener('input', updateInstructorCalc);
  updateInstructorCalc();

  const newBookingForm = document.getElementById('newBookingForm');
  bindLessonDateRange(newBookingForm);
  const today = new Date().toISOString().split('T')[0];
  newBookingForm.lessonDateFrom.min = today;
  newBookingForm.lessonDateTo.min = today;
  newBookingForm.lessonDateFrom.value = today;
  newBookingForm.lessonDateTo.value = today;

  newBookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await api.createBooking({
        lessonDateFrom: form.lessonDateFrom.value,
        lessonDateTo: form.lessonDateTo.value,
        lessonStartTime: form.lessonStartTime.value,
        resortLocation: form.resortLocation.value,
        durationHours: Number(form.durationHours.value),
        lessonType: form.lessonType.value,
        totalGuests: Number(form.totalGuests.value),
        childrenUnder6: Number(form.childrenUnder6.value),
        guestName: form.guestName.value,
        phone: form.phone.value,
        email: form.email.value,
        instagram: form.instagram.value,
        facebook: form.facebook.value,
        whatsapp: form.whatsapp.value,
        line: form.line.value,
        wechat: form.wechat.value,
        languagePref: form.languagePref.value,
        specialRequests: form.specialRequests.value,
        source: 'admin',
        paymentMethod: 'on_site',
        paymentStatus: 'pay_on_site',
      });
      ui.toast(t('admin.bookingCreated'), 'success');
      pendingScheduleDate = form.lessonDateFrom.value;
      navigate('schedule');
    } catch (err) {
      ui.toast(err.message, 'error');
    }
  });
}

function capacityBadge(cap) {
  if (!cap) return '';
  const styles = {
    ok: 'bg-green-100 text-green-800 border-green-200',
    tight: 'bg-amber-100 text-amber-800 border-amber-200',
    overbooked: 'bg-red-100 text-red-800 border-red-200',
  };
  const labels = {
    ok: t('admin.capacityOk'),
    tight: t('admin.capacityTight'),
    overbooked: t('admin.capacityOver'),
  };
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[cap.status] || styles.ok}">${labels[cap.status] || cap.status}</span>`;
}

function formatIsoDate(d) {
  return d.toISOString().split('T')[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return formatIsoDate(d);
}

const SCHEDULE_RANGE_MAX_DAYS = 31;

function datesInRange(from, to) {
  const dates = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function renderGanttChart({ timeSlots, rows, unassigned, locations, capacity }) {
  const cols = timeSlots.length;
  const legend = locations
    .filter((l) => l.id !== 'other')
    .map(
      (l) =>
        `<span class="inline-flex items-center gap-1 px-2 py-1 rounded border"><span class="w-3 h-3 rounded" style="background:${l.color}"></span>${l.nameEn || l.name}</span>`
    )
    .join('');

  const capHtml = capacity
    ? `<div class="mb-3 flex flex-wrap items-center gap-2 text-sm">${capacityBadge(capacity)}<span class="text-slate-600">${t('admin.capacitySummary', { demand: capacity.demand, supply: capacity.supply, remaining: capacity.remaining })}</span></div>`
    : '';

  const chart = `
    <div class="min-w-[1200px]">
      <div class="grid border-b bg-slate-50 text-xs sticky top-0" style="grid-template-columns:120px repeat(${cols}, minmax(32px,1fr))">
        <div class="p-2 font-medium border-r">${t('admin.ganttInstructor')}</div>
        ${timeSlots.map((s, i) => `<div class="p-1 text-center border-r ${i % 2 === 0 ? 'font-medium' : 'text-slate-400'}">${s.time}</div>`).join('')}
      </div>
      ${rows
        .map(
          (row) => `
        <div class="grid border-b relative" style="grid-template-columns:120px repeat(${cols}, minmax(32px,1fr)); min-height:56px">
          <div class="p-2 text-sm font-medium border-r bg-slate-50">${row.instructorName}</div>
          ${timeSlots.map(() => `<div class="border-r min-h-[56px]"></div>`).join('')}
          ${(row.leaveBlocks || [])
            .map(
              (lb) => `
            <div class="absolute top-1 h-12 rounded bg-slate-200 border border-slate-300 text-slate-600 text-[10px] px-1.5 py-1 overflow-hidden"
              style="left:calc(120px + (100% - 120px) * ${lb.startSlot / cols});
                     width:calc((100% - 120px) * ${lb.spanSlots / cols} - 4px); z-index:1;">
              <p class="font-semibold truncate">${leavePeriodGanttLabel()}</p>
            </div>`
            )
            .join('')}
          ${row.blocks
            .map(
              (b) => `
            <div class="absolute top-1 h-12 rounded text-white text-[10px] px-1.5 py-1 overflow-hidden shadow"
              style="left:calc(120px + (100% - 120px) * ${b.startSlot / cols});
                     width:calc((100% - 120px) * ${b.spanSlots / cols} - 4px);
                     background:${b.color}; z-index:2;">
              <p class="font-semibold truncate">${b.sourcePrefix || ''}${guestPageLink(b.bookingId, b.guestName, 'text-white hover:underline')} ${b.lessonTag || ''}</p>
              <p class="opacity-90 truncate">${b.locationName}</p>
            </div>`
            )
            .join('')}
        </div>`
        )
        .join('')}
    </div>`;

  const unassignedHtml = unassigned.length
    ? `<div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4"><h3 class="font-medium text-amber-900 mb-2">${t('admin.ganttUnassigned')} (${unassigned.length})</h3><div class="space-y-2 text-sm">${unassigned.map((b) => `<p>${guestPageLink(b.bookingId, b.guestName)} · ${b.lessonStartTime} · ${b.durationHours}h · ${b.locationName}</p>`).join('')}</div></div>`
    : '';

  return `${capHtml}<div id="ganttLegend" class="flex flex-wrap gap-2 mb-4 text-xs">${legend}</div><div id="ganttChart" class="bg-white rounded-xl border overflow-x-auto">${chart}</div>${unassignedHtml}`;
}

async function loadScheduleView({ headOnly = false, initialDate = null } = {}) {
  const container = document.getElementById('content');
  const today = formatIsoDate(new Date());
  const startDate = initialDate || today;
  const defaultRangeTo = addDays(startDate, 6);
  let viewMode = 'day';
  let anchorDate = startDate;
  const state = { headOnly };

  container.innerHTML = `
    <div class="flex flex-wrap gap-2 mb-4">
      <button data-schedule-view="day" class="schedule-view-btn px-3 py-1.5 rounded-lg text-sm border bg-brand-500 text-white">${t('admin.viewDay')}</button>
      <button data-schedule-view="week" class="schedule-view-btn px-3 py-1.5 rounded-lg text-sm border">${t('admin.viewWeek')}</button>
      <button data-schedule-view="range" class="schedule-view-btn px-3 py-1.5 rounded-lg text-sm border">${t('admin.viewRange')}</button>
    </div>
    <div id="scheduleToolbar" class="flex flex-wrap gap-3 mb-4 items-center">
      <input type="date" id="scheduleDate" value="${startDate}" class="border rounded-lg px-3 py-2 text-sm">
      <button id="refreshSchedule" class="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm">${t('common.refresh')}</button>
      <a href="/instructor/" target="_blank" class="text-sm text-brand-600 hover:underline">${t('admin.coachViewLink')}</a>
    </div>
    <div id="scheduleRangeToolbar" class="hidden flex flex-wrap gap-3 mb-4 items-end">
      <label class="text-sm">
        <span class="block text-xs text-slate-500 mb-1">${t('admin.rangeFrom')}</span>
        <input type="date" id="scheduleRangeFrom" value="${startDate}" class="border rounded-lg px-3 py-2 text-sm">
      </label>
      <label class="text-sm">
        <span class="block text-xs text-slate-500 mb-1">${t('admin.rangeTo')}</span>
        <input type="date" id="scheduleRangeTo" value="${defaultRangeTo}" class="border rounded-lg px-3 py-2 text-sm">
      </label>
      <button id="searchScheduleRange" class="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm">${t('admin.searchRange')}</button>
      <a href="/instructor/" target="_blank" class="text-sm text-brand-600 hover:underline pb-2">${t('admin.coachViewLink')}</a>
    </div>
    <div id="scheduleBody"><p class="text-slate-500">${t('common.loading')}</p></div>
  `;

  function setViewMode(mode) {
    viewMode = mode;
    container.querySelectorAll('.schedule-view-btn').forEach((btn) => {
      const active = btn.dataset.scheduleView === mode;
      btn.classList.toggle('bg-brand-500', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('border-brand-500', active);
    });
    document.getElementById('scheduleToolbar').classList.toggle('hidden', mode !== 'day');
    document.getElementById('scheduleRangeToolbar').classList.toggle('hidden', mode !== 'range');
  }

  function bindDayLinks(root) {
    root.querySelectorAll('[data-schedule-day]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('scheduleDate').value = btn.dataset.scheduleDay;
        setViewMode('day');
        render();
      });
    });
  }

  async function renderRangeGanttCharts(dates) {
    const body = document.getElementById('scheduleBody');
    const charts = await Promise.all(
      dates.map((date) =>
        api.getGantt({ date, headOnly: state.headOnly ? '1' : '0' }).then((res) => ({
          date,
          data: res.data,
        }))
      )
    );
    body.innerHTML = `
      <p class="text-xs text-slate-500 mb-3">${t('admin.rangeResult', { from: dates[0], to: dates[dates.length - 1], days: dates.length })}</p>
      <div class="space-y-6">
        ${charts
          .map(
            ({ date, data }) => `
          <div class="border rounded-xl overflow-hidden">
            <div class="bg-slate-50 px-4 py-2 text-sm font-medium border-b flex justify-between items-center">
              <span>${formatIsoDate(new Date(date + 'T12:00:00'))} · ${ui.formatDate(date)}</span>
              <button type="button" data-schedule-day="${date}" class="text-brand-600 hover:underline text-xs">${t('admin.viewDay')}</button>
            </div>
            <div class="overflow-x-auto p-2">${renderGanttChart(data)}</div>
          </div>`
          )
          .join('')}
      </div>`;
    bindDayLinks(body);
  }

  async function render() {
    const body = document.getElementById('scheduleBody');
    body.innerHTML = `<p class="text-slate-500">${t('common.loading')}</p>`;
    try {
      if (viewMode === 'day') {
        const date = document.getElementById('scheduleDate').value;
        const res = await api.getGantt({ date, headOnly: state.headOnly ? '1' : '0' });
        body.innerHTML = renderGanttChart(res.data);
        return;
      }

      if (viewMode === 'week') {
        const from = anchorDate;
        const dates = Array.from({ length: 7 }, (_, i) => addDays(from, i));
        await renderRangeGanttCharts(dates);
        return;
      }

      const from = document.getElementById('scheduleRangeFrom').value;
      const to = document.getElementById('scheduleRangeTo').value;
      if (!from || !to) {
        body.innerHTML = `<p class="text-slate-500 py-8 text-center">${t('admin.rangeSelectDates')}</p>`;
        return;
      }
      if (to < from) {
        body.innerHTML = `<p class="text-red-600 py-8 text-center">${t('admin.rangeInvalid')}</p>`;
        return;
      }
      const dates = datesInRange(from, to);
      if (dates.length > SCHEDULE_RANGE_MAX_DAYS) {
        body.innerHTML = `<p class="text-red-600 py-8 text-center">${t('admin.rangeTooLong', { max: SCHEDULE_RANGE_MAX_DAYS })}</p>`;
        return;
      }
      await renderRangeGanttCharts(dates);
    } catch (err) {
      body.innerHTML = `<p class="text-red-600">${err.message}</p>`;
    }
  }

  container.querySelectorAll('[data-schedule-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextMode = btn.dataset.scheduleView;
      if (nextMode !== 'day') {
        anchorDate = document.getElementById('scheduleDate').value;
        if (nextMode === 'range') {
          document.getElementById('scheduleRangeFrom').value = anchorDate;
          const toInput = document.getElementById('scheduleRangeTo');
          if (!toInput.value || toInput.value < anchorDate) {
            toInput.value = addDays(anchorDate, 6);
          }
        }
      }
      setViewMode(nextMode);
      render();
    });
  });

  document.getElementById('refreshSchedule').addEventListener('click', render);
  document.getElementById('scheduleDate').addEventListener('change', () => {
    anchorDate = document.getElementById('scheduleDate').value;
    if (viewMode === 'day') render();
  });
  document.getElementById('searchScheduleRange').addEventListener('click', render);
  document.getElementById('scheduleRangeFrom').addEventListener('change', () => {
    const fromInput = document.getElementById('scheduleRangeFrom');
    const toInput = document.getElementById('scheduleRangeTo');
    toInput.min = fromInput.value;
    if (toInput.value < fromInput.value) toInput.value = fromInput.value;
  });

  setViewMode('day');
  render();
}

function renderResortRow(resort, regionKey) {
  const rid = resort.id;
  return `
    <div class="grid md:grid-cols-[1fr_1fr_100px_auto_auto] gap-3 items-center bg-slate-50 rounded-lg p-3" data-resort-row data-resort-id="${rid}" data-region-key="${regionKey}">
      <input type="hidden" name="resort-id-${rid}" value="${rid}">
      <label class="text-sm">
        <span class="text-slate-500 block text-xs">${t('admin.resortName')}</span>
        <input name="resort-name-${rid}" value="${resort.name || ''}" required class="mt-1 w-full border rounded-lg px-2 py-1.5">
      </label>
      <label class="text-sm">
        <span class="text-slate-500 block text-xs">${t('admin.resortNameEn')}</span>
        <input name="resort-nameEn-${rid}" value="${resort.nameEn || ''}" class="mt-1 w-full border rounded-lg px-2 py-1.5">
      </label>
      <label class="text-sm">
        <span class="text-slate-500 block text-xs">${t('admin.resortColor')}</span>
        <input type="color" name="resort-color-${rid}" value="${resort.color || '#D1D5DB'}" class="mt-1 w-full h-9 border rounded-lg px-0.5">
      </label>
      <label class="text-sm flex items-center gap-2">
        <input type="checkbox" name="resort-active-${rid}" ${resort.active !== false ? 'checked' : ''}>
        <span>${t('admin.coachActive')}</span>
      </label>
      <button type="button" data-remove-resort class="text-xs text-red-600 hover:underline">${t('admin.removeResort')}</button>
    </div>`;
}

function renderRegionBlock(region) {
  const key = region.id;
  const resorts = region.resorts || [];
  return `
    <div class="border rounded-lg p-4 space-y-4" data-region-block data-region-key="${key}">
      <input type="hidden" name="region-key-${key}" value="${key}">
      <div class="flex flex-wrap justify-between gap-2 items-start">
        <div class="grid md:grid-cols-3 gap-3 flex-1">
          <label class="text-sm">
            <span class="text-slate-500 block text-xs">${t('admin.regionName')}</span>
            <input name="region-name-${key}" value="${region.name || ''}" required class="mt-1 w-full border rounded-lg px-2 py-1.5">
          </label>
          <label class="text-sm">
            <span class="text-slate-500 block text-xs">${t('admin.regionNameEn')}</span>
            <input name="region-nameEn-${key}" value="${region.nameEn || ''}" class="mt-1 w-full border rounded-lg px-2 py-1.5">
          </label>
          <label class="text-sm md:col-span-1">
            <span class="text-slate-500 block text-xs">${t('admin.regionDesc')}</span>
            <input name="region-desc-${key}" value="${region.description || ''}" class="mt-1 w-full border rounded-lg px-2 py-1.5">
          </label>
        </div>
        <button type="button" data-remove-region class="text-xs text-red-600 hover:underline shrink-0">${t('admin.removeRegion')}</button>
      </div>
      <div>
        <p class="text-xs text-slate-500 mb-2">${t('admin.pricingSection')}</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${[3, 4, 5, 6]
            .map(
              (h) => `
            <label class="text-sm block">
              <span class="text-slate-500">${h} ${t('common.hours')}</span>
              <input type="number" min="0" step="1" name="price-${key}-${h}" value="${region.prices?.[h] ?? ''}" class="mt-1 w-full border rounded-lg px-3 py-2">
            </label>`
            )
            .join('')}
        </div>
      </div>
      <div>
        <div class="flex justify-between items-center mb-2">
          <p class="text-xs text-slate-500">${t('admin.resortsSection')}</p>
          <button type="button" data-add-resort data-region-key="${key}" class="text-xs text-brand-600 hover:underline">+ ${t('admin.addResort')}</button>
        </div>
        <div class="space-y-2" data-resorts-list data-region-key="${key}">
          ${resorts.map((r) => renderResortRow(r, key)).join('')}
        </div>
      </div>
    </div>`;
}

function bindPricingFormEvents(form, initialRegions) {
  const regionsList = form.querySelector('#regionsList');

  form.querySelector('#addRegionBtn')?.addEventListener('click', () => {
    const key = `new-region-${Date.now()}`;
    const block = document.createElement('div');
    block.innerHTML = renderRegionBlock({
      id: key,
      name: '',
      nameEn: '',
      description: '',
      prices: { 3: 32000, 4: 46000, 5: 52000, 6: 62000 },
      resorts: [],
    });
    regionsList.appendChild(block.firstElementChild);
  });

  form.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-resort]');
    if (addBtn) {
      const regionKey = addBtn.dataset.regionKey;
      const list = form.querySelector(`[data-resorts-list][data-region-key="${regionKey}"]`);
      const rid = `new-resort-${Date.now()}`;
      const row = document.createElement('div');
      row.innerHTML = renderResortRow(
        { id: rid, name: '', nameEn: '', color: '#93C5FD', active: true },
        regionKey
      );
      list.appendChild(row.firstElementChild);
      return;
    }
    if (e.target.closest('[data-remove-resort]')) {
      e.target.closest('[data-resort-row]')?.remove();
      return;
    }
    if (e.target.closest('[data-remove-region]')) {
      const blocks = form.querySelectorAll('[data-region-block]');
      if (blocks.length <= 1) {
        ui.toast(t('admin.regionMinOne'), 'error');
        return;
      }
      e.target.closest('[data-region-block]')?.remove();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const regions = [];
    const resorts = [];
    form.querySelectorAll('[data-region-block]').forEach((block) => {
      const key = block.dataset.regionKey;
      const region = {
        id: form.elements[`region-key-${key}`].value,
        name: form.elements[`region-name-${key}`].value,
        nameEn: form.elements[`region-nameEn-${key}`].value,
        description: form.elements[`region-desc-${key}`].value,
        prices: {},
      };
      [3, 4, 5, 6].forEach((h) => {
        region.prices[h] = Number(form.elements[`price-${key}-${h}`].value);
      });
      regions.push(region);

      block.querySelectorAll('[data-resort-row]').forEach((row) => {
        const rid = row.dataset.resortId;
        const colorInput = row.querySelector(`input[name="resort-color-${rid}"]`);
        resorts.push({
          id: form.elements[`resort-id-${rid}`].value,
          name: form.elements[`resort-name-${rid}`].value,
          nameEn: form.elements[`resort-nameEn-${rid}`].value,
          region: key,
          color: colorInput ? colorInput.value : '#D1D5DB',
          active: form.elements[`resort-active-${rid}`].checked,
        });
      });
    });

    try {
      await api.updatePricing({ regions, resorts });
      ui.toast(t('admin.pricingResortsSaved'), 'success');
      const metaRes = await api.getMeta();
      meta = metaRes.data;
      ui.setResortConfig(meta.resortConfig || []);
      loadPricing();
    } catch (err) {
      ui.toast(err.message, 'error');
    }
  });
}

async function loadPricing() {
  const container = document.getElementById('content');
  container.innerHTML = `<p class="text-slate-500">${t('common.loading')}</p>`;
  try {
    const res = await api.getPricing();
    const regions = res.data.regions || [];
    container.innerHTML = `
      <div class="bg-white border rounded-xl p-6 shadow-sm max-w-4xl">
        <h3 class="font-semibold text-lg mb-2">${t('admin.pricingResortsTitle')}</h3>
        <p class="text-sm text-slate-600 mb-4">${t('admin.pricingResortsDesc')}</p>
        <form id="pricingForm" class="space-y-4">
          <div id="regionsList" class="space-y-6">
            ${regions.map((region) => renderRegionBlock(region)).join('')}
          </div>
          <button type="button" id="addRegionBtn" class="px-3 py-2 border border-dashed border-brand-300 text-brand-600 rounded-lg text-sm w-full hover:bg-brand-50">
            + ${t('admin.addRegion')}
          </button>
          <button type="submit" class="px-4 py-2 bg-brand-500 text-white rounded-lg">${t('admin.savePricingResorts')}</button>
        </form>
      </div>`;

    bindPricingFormEvents(document.getElementById('pricingForm'), regions);
  } catch (err) {
    container.innerHTML = `<p class="text-red-600">${err.message}</p>`;
  }
}

function loadKlookImport() {
  const container = document.getElementById('content');
  container.innerHTML = `
    <div class="max-w-3xl space-y-4">
      <div class="bg-white border rounded-xl p-6 shadow-sm">
        <h3 class="font-semibold mb-2">${t('admin.klookImport')}</h3>
        <p class="text-sm text-slate-600 mb-4">${t('admin.klookPaste')}</p>
        <input type="file" id="emlFile" accept=".eml" class="mb-3 text-sm">
        <textarea id="rawEmail" rows="8" placeholder="${t('admin.klookPastePh')}" class="w-full border rounded-lg p-3 text-sm font-mono"></textarea>
        <div class="flex gap-3 mt-4">
          <button id="parseKlookBtn" class="px-4 py-2 border rounded-lg text-sm">${t('admin.klookPreview')}</button>
          <button id="importKlookBtn" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">${t('admin.klookImportBtn')}</button>
        </div>
      </div>
      <div id="klookResult"></div>
    </div>
  `;

  document.getElementById('emlFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('rawEmail').value = await file.text();
  });

  document.getElementById('parseKlookBtn').addEventListener('click', async () => {
    try {
      const rawEmail = document.getElementById('rawEmail').value;
      const res = await api.parseKlookEmail({ rawEmail });
      renderKlookResult(res.data, false);
    } catch (err) {
      ui.toast(err.message, 'error');
    }
  });

  document.getElementById('importKlookBtn').addEventListener('click', async () => {
    try {
      const rawEmail = document.getElementById('rawEmail').value;
      const res = await api.importKlookEmail({ rawEmail });
      renderKlookResult(res.data, true);
      ui.toast(res.message, res.duplicate ? 'error' : 'success');
    } catch (err) {
      ui.toast(err.message, 'error');
    }
  });
}

function renderKlookResult(data, imported) {
  const { parseResult, booking } = data;
  const p = parseResult.parsed;
  document.getElementById('klookResult').innerHTML = `
    <div class="bg-white border rounded-xl p-6 shadow-sm text-sm space-y-2">
      <h3 class="font-semibold text-lg">${imported ? t('admin.klookResult') : t('admin.klookPreviewTitle')}</h3>
      <p><strong>${t('admin.klookOrderNo')}:</strong> ${p.klookOrderId || '-'}</p>
      <p><strong>${t('admin.klookDateTime')}:</strong> ${p.lessonDate || '-'} · <strong>${t('admin.klookTime')}:</strong> ${p.lessonStartTime || '-'}</p>
      <p><strong>${t('admin.klookGuest')}:</strong> ${p.guestName} · <strong>${t('admin.col.guests')}:</strong> ${p.totalGuests}</p>
      <p><strong>${t('admin.col.lesson')}:</strong> ${ui.label(p.lessonType)} · ${p.durationHours} ${t('common.hours')}</p>
      <p><strong>${t('admin.klookResort')}:</strong> ${ui.resortLabel(p.resortLocation, p.region)} <span class="text-slate-500">(${ui.label(p.region)})</span></p>
      <p><strong>${t('public.phone')}:</strong> ${p.phone} · <strong>Email:</strong> ${p.email || '-'}</p>
      ${parseResult.needsReview ? `<p class="text-amber-600">⚠️ ${t('admin.klookReview')}: ${parseResult.missing.join(', ')}</p>` : `<p class="text-green-600">✓ ${t('admin.klookComplete')}</p>`}
      ${booking ? `<p class="mt-2"><strong>${t('admin.klookBookingId')}:</strong> ${booking._id || booking.id}</p>` : ''}
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', init);
