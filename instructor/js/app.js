const API = '/api/v1/instructor-view';
const t = (key, vars) => i18n.t(key, vars);

let lastGantt = null;
let lastLocations = null;
let lastBookings = null;
let lastDayOverview = null;
let currentInstructor = null;

function getToken() {
  return localStorage.getItem('instructorToken') || '';
}

function setToken(token) {
  if (token) localStorage.setItem('instructorToken', token);
  else localStorage.removeItem('instructorToken');
}

async function fetchJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers['X-Instructor-Token'] = token;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || t('common.loading'));
  return data;
}

function showLogin() {
  document.getElementById('loginGate').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
}

function showApp() {
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
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

function guestPageLink(bookingId, guestName, className = 'text-brand-600 hover:underline') {
  if (!bookingId || !guestName) return guestName || '-';
  const qs = new URLSearchParams({ id: bookingId });
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
    el.innerHTML = `<p class="p-8 text-center text-slate-500">${t('instructor.noLessons')}</p>`;
    return;
  }

  const slots = gantt.timeSlots;
  const cols = slots.length;

  el.innerHTML = `
    <div class="min-w-[800px]">
      <div class="grid border-b bg-slate-50 text-xs" style="grid-template-columns:80px repeat(${cols}, minmax(36px,1fr))">
        <div class="p-2 font-medium border-r">${t('instructor.time')}</div>
        ${slots.map((s, i) => `<div class="p-1 text-center border-r ${i % 2 === 0 ? 'font-medium' : 'text-slate-400'}">${s.time}</div>`).join('')}
      </div>
      <div class="grid relative" style="grid-template-columns:80px repeat(${cols}, minmax(36px,1fr)); min-height:80px">
        <div class="border-r p-2 text-xs text-slate-500">${t('instructor.lesson')}</div>
        ${slots.map(() => `<div class="border-r border-b min-h-[72px]"></div>`).join('')}
        ${leaveBlocks.map((lb) => `
          <div class="absolute top-2 h-16 rounded-md bg-slate-200 border border-slate-300 text-slate-600 text-xs p-2 overflow-hidden flex items-center"
            style="left:calc(80px + (100% - 80px) * ${lb.startSlot / cols});
                   width:calc((100% - 80px) * ${lb.spanSlots / cols}); z-index:1;">
            <p class="font-semibold truncate">dayoff</p>
          </div>`).join('')}
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
    el.innerHTML = `<p class="text-slate-500 text-sm">${t('instructor.noUpcoming')}</p>`;
    return;
  }

  el.innerHTML = `
    <h2 class="font-semibold mb-3">${t('instructor.myLessons')}</h2>
    <div class="space-y-3">
      ${bookings.map((b) => `
        <div class="border rounded-lg p-3 text-sm" style="border-left:4px solid ${b.color}">
          <p class="font-medium">${guestPageLink(b.bookingId, b.guestName)} · ${b.lessonTag || ''}</p>
          <p class="text-slate-600 mt-1">${b.locationName} · ${b.lessonStartTime} ${t('instructor.startsAt')} · ${b.durationHours}h · ${b.totalGuests} ${t('common.people')}</p>
          <p class="text-slate-500">${t('public.phone')}: ${b.phone}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDayOverview(data) {
  lastDayOverview = data;
  const el = document.getElementById('dayOverviewBody');
  const { timeSlots, rows, locations } = data;
  const cols = timeSlots.length;

  if (!rows.length) {
    el.innerHTML = `<p class="text-slate-500 text-sm">${t('instructor.noLessons')}</p>`;
    return;
  }

  el.innerHTML = `
    <div class="flex flex-wrap gap-2 text-xs mb-3">
      ${locations.filter((l) => l.id !== 'other').map((l) => `
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded border">
          <span class="w-3 h-3 rounded" style="background:${l.color}"></span>${resortName(l)}
        </span>
      `).join('')}
    </div>
    <div class="min-w-[1000px]">
      <div class="grid border-b bg-slate-50 text-xs" style="grid-template-columns:100px repeat(${cols}, minmax(32px,1fr))">
        <div class="p-2 font-medium border-r">${t('admin.ganttInstructor')}</div>
        ${timeSlots.map((s, i) => `<div class="p-1 text-center border-r ${i % 2 === 0 ? 'font-medium' : 'text-slate-400'}">${s.time}</div>`).join('')}
      </div>
      ${rows.map((row) => `
        <div class="grid border-b relative" style="grid-template-columns:100px repeat(${cols}, minmax(32px,1fr)); min-height:52px">
          <div class="p-2 text-xs font-medium border-r bg-slate-50">${row.instructorName}</div>
          ${timeSlots.map(() => `<div class="border-r min-h-[52px]"></div>`).join('')}
          ${(row.leaveBlocks || []).map((lb) => `
            <div class="absolute top-1 h-10 rounded bg-slate-200 border border-slate-300 text-[10px] px-1 flex items-center text-slate-600"
              style="left:calc(100px + (100% - 100px) * ${lb.startSlot / cols});
                     width:calc((100% - 100px) * ${lb.spanSlots / cols} - 2px); z-index:1;">dayoff</div>
          `).join('')}
          ${row.blocks.map((b) => `
            <div class="absolute top-1 h-10 rounded text-white text-[10px] px-1 overflow-hidden shadow-sm flex items-center"
              style="left:calc(100px + (100% - 100px) * ${b.startSlot / cols});
                     width:calc((100% - 100px) * ${b.spanSlots / cols} - 2px);
                     background:${b.color}; z-index:2;">
              <span class="truncate">${b.guestName || ''}</span>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

async function loadView() {
  const date = document.getElementById('dateInput').value;
  const [ganttRes, overviewRes] = await Promise.all([
    fetchJson(`${API}/gantt?date=${date}`),
    fetchJson(`${API}/day-overview?date=${date}`),
  ]);

  document.getElementById('instructorName').textContent = ganttRes.data.instructor.name;
  lastLocations = ganttRes.data.gantt.locations;
  renderLegend(lastLocations);
  renderGantt(ganttRes.data.gantt);
  renderUpcoming(ganttRes.data.upcoming);
  renderDayOverview(overviewRes.data);
}

async function verifySession() {
  const res = await fetchJson(`${API}/me`);
  currentInstructor = res.data;
  showApp();
  document.getElementById('instructorName').textContent = currentInstructor.name;
}

async function init() {
  i18n.init('zh');
  i18n.mountLangSwitcher('langSwitcher');
  i18n.mountLangSwitcher('langSwitcherHeader');

  window.addEventListener('langchange', () => {
    i18n.applyPage();
    if (lastLocations) renderLegend(lastLocations);
    if (lastGantt) renderGantt(lastGantt);
    if (lastBookings) renderUpcoming(lastBookings);
    if (lastDayOverview) renderDayOverview(lastDayOverview);
  });

  document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
  const leaveDateInput = document.querySelector('#leaveForm [name=leaveDate]');
  if (leaveDateInput) leaveDateInput.min = new Date().toISOString().split('T')[0];

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errEl = document.getElementById('loginError');
    errEl.classList.add('hidden');
    try {
      const res = await fetchJson(`${API}/login`, {
        method: 'POST',
        body: JSON.stringify({ login: form.login.value, pin: form.pin.value }),
      });
      setToken(res.data.token);
      currentInstructor = res.data.instructor;
      showApp();
      await loadView();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await fetchJson(`${API}/logout`, { method: 'POST' });
    } catch (_err) {
      /* ignore */
    }
    setToken('');
    showLogin();
  });

  document.getElementById('leaveForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const msg = document.getElementById('leaveMsg');
    try {
      await fetchJson(`${API}/leave-requests`, {
        method: 'POST',
        body: JSON.stringify({
          date: form.leaveDate.value,
          reason: form.leaveReason.value,
          period: form.leavePeriod?.value || 'full',
        }),
      });
      msg.textContent = t('instructor.leaveSubmitted');
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

  document.getElementById('dateInput').addEventListener('change', loadView);
  document.getElementById('refreshBtn').addEventListener('click', loadView);

  if (getToken()) {
    try {
      await verifySession();
      await loadView();
      return;
    } catch (_err) {
      setToken('');
    }
  }
  showLogin();
}

init().catch((err) => {
  const gate = document.getElementById('loginError');
  if (gate) {
    gate.textContent = err.message;
    gate.classList.remove('hidden');
  }
});
