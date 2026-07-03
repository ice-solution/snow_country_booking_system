const API = '/api/v1';
const t = (key, vars) => i18n.t(key, vars);

let lastGantt = null;
let lastLocations = null;
let lastBookings = null;

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || t('common.loading'));
  return data;
}

async function loadCoaches() {
  const res = await fetchJson(`${API}/coach-view/coaches`);
  const select = document.getElementById('coachSelect');
  select.innerHTML = res.data
    .map((c) => `<option value="${c._id}">${c.name}</option>`)
    .join('');

  const params = new URLSearchParams(window.location.search);
  if (params.get('coachId')) select.value = params.get('coachId');
}

function formatDate(d) {
  const locale = i18n.getLang() === 'en' ? 'en-GB' : 'zh-HK';
  return new Date(d).toLocaleDateString(locale, {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });
}

function resortName(loc) {
  if (!loc) return '';
  return i18n.getLang() === 'en' && loc.nameEn ? loc.nameEn : loc.name;
}

function leavePeriodLabel(period) {
  const labels = {
    full: 'admin.leaveFullDay',
    half_am: 'admin.leaveHalfAm',
    half_pm: 'admin.leaveHalfPm',
  };
  return t(labels[period] || labels.full);
}

function guestPageLink(bookingId, guestName, className = 'text-brand-600 hover:underline') {
  if (!bookingId || !guestName) return guestName || '-';
  const coachId = document.getElementById('coachSelect')?.value || '';
  const qs = new URLSearchParams({ id: bookingId });
  if (coachId) qs.set('coachId', coachId);
  return `<a href="/guest.html?${qs}" target="_blank" rel="noopener" class="${className}">${guestName}</a>`;
}

function renderLegend(locations) {
  document.getElementById('legend').innerHTML = locations
    .filter((l) => l.id !== 'other')
    .map((l) => `
      <span class="inline-flex items-center gap-1 px-2 py-1 rounded border">
        <span class="w-3 h-3 rounded" style="background:${l.color}"></span>${resortName(l)}
      </span>
    `).join('');
}

function renderGantt(gantt) {
  lastGantt = gantt;
  const el = document.getElementById('gantt');
  const leaveBlocks = gantt.leaveBlocks || [];
  if (!gantt.blocks.length && !leaveBlocks.length) {
    el.innerHTML = `<p class="p-8 text-center text-slate-500">${t('coach.noLessons')}</p>`;
    return;
  }

  const slots = gantt.timeSlots;
  const cols = slots.length;

  el.innerHTML = `
    <div class="min-w-[800px]">
      <div class="grid border-b bg-slate-50 text-xs" style="grid-template-columns:80px repeat(${cols}, minmax(36px,1fr))">
        <div class="p-2 font-medium border-r">${t('coach.time')}</div>
        ${slots.map((s, i) => `<div class="p-1 text-center border-r ${i % 2 === 0 ? 'font-medium' : 'text-slate-400'}">${s.time}</div>`).join('')}
      </div>
      <div class="grid relative" style="grid-template-columns:80px repeat(${cols}, minmax(36px,1fr)); min-height:80px">
        <div class="border-r p-2 text-xs text-slate-500">${t('coach.lesson')}</div>
        ${slots.map(() => `<div class="border-r border-b min-h-[72px]"></div>`).join('')}
        ${leaveBlocks
          .map(
            (lb) => `
          <div class="absolute top-2 h-16 rounded-md bg-slate-200 border border-slate-300 text-slate-600 text-xs p-2 overflow-hidden flex items-center"
            style="left:calc(80px + (100% - 80px) * ${lb.startSlot / cols});
                   width:calc((100% - 80px) * ${lb.spanSlots / cols});
                   z-index:1;">
            <div>
              <p class="font-semibold truncate">dayoff</p>
            </div>
          </div>`
          )
          .join('')}
        ${gantt.blocks.map((b) => `
          <div class="absolute top-2 h-16 rounded-md text-white text-xs p-2 overflow-hidden shadow-sm flex items-center"
            style="left:calc(80px + (100% - 80px) * ${b.startSlot / cols});
                   width:calc((100% - 80px) * ${b.spanSlots / cols});
                   background:${b.color}; margin-left:2px; z-index:2;">
            <div>
              <p class="font-semibold truncate">${b.sourcePrefix || ''}${guestPageLink(b.bookingId, b.guestName, 'text-white hover:underline')} ${b.lessonTag || ''}</p>
              <p class="opacity-90">${b.locationName} · ${b.lessonStartTime} · ${b.durationHours}h</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderUpcoming(bookings) {
  lastBookings = bookings;
  const el = document.getElementById('upcoming');
  if (!bookings.length) {
    el.innerHTML = `<p class="text-slate-500 text-sm">${t('coach.noUpcoming')}</p>`;
    return;
  }

  el.innerHTML = `
    <h2 class="font-semibold mb-3">${t('coach.myLessons')}</h2>
    <div class="space-y-3">
      ${bookings.map((b) => `
        <div class="border rounded-lg p-3 text-sm" style="border-left:4px solid ${b.color}">
          <p class="font-medium">${guestPageLink(b.bookingId, b.guestName)} · ${b.lessonTag || b.label.split(' ').slice(-2).join(' ')}</p>
          <p class="text-slate-600 mt-1">${b.locationName} · ${b.lessonStartTime} ${t('coach.startsAt')} · ${b.durationHours}h · ${b.totalGuests} ${t('common.people')}</p>
          <p class="text-slate-500">${t('public.phone')}: ${b.phone}</p>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadView() {
  const coachId = document.getElementById('coachSelect').value;
  const date = document.getElementById('dateInput').value;
  if (!coachId) return;

  const res = await fetchJson(`${API}/coach-view/${coachId}/gantt?date=${date}`);
  document.getElementById('coachName').textContent = res.data.coach.name;
  lastLocations = res.data.gantt.locations;
  renderLegend(lastLocations);
  renderGantt(res.data.gantt);
  renderUpcoming(res.data.upcoming);
}

async function init() {
  i18n.init('zh');
  i18n.mountLangSwitcher('langSwitcher');

  window.addEventListener('langchange', () => {
    i18n.applyPage();
    if (lastLocations) renderLegend(lastLocations);
    if (lastGantt) renderGantt(lastGantt);
    if (lastBookings) renderUpcoming(lastBookings);
  });

  document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
  const leaveDateInput = document.querySelector('#leaveForm [name=leaveDate]');
  if (leaveDateInput) leaveDateInput.min = new Date().toISOString().split('T')[0];

  document.getElementById('leaveForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const coachId = document.getElementById('coachSelect').value;
    const form = e.target;
    const msg = document.getElementById('leaveMsg');
    try {
      const res = await fetch(`${API}/coach-view/${coachId}/leave-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.leaveDate.value,
          reason: form.leaveReason.value,
          period: form.leavePeriod?.value || 'full',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      msg.textContent = t('coach.leaveSubmitted');
      msg.className = 'text-sm mt-2 text-green-700';
      msg.classList.remove('hidden');
      form.reset();
      if (leaveDateInput) leaveDateInput.min = new Date().toISOString().split('T')[0];
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'text-sm mt-2 text-red-600';
      msg.classList.remove('hidden');
    }
  });

  await loadCoaches();
  document.getElementById('coachSelect').addEventListener('change', loadView);
  document.getElementById('dateInput').addEventListener('change', loadView);
  document.getElementById('refreshBtn').addEventListener('click', loadView);
  await loadView();
}

init().catch((err) => {
  document.getElementById('gantt').innerHTML = `<p class="text-red-600 p-4">${err.message}</p>`;
});
