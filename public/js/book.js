let pricing = null;
let stripeEnabled = false;
let resortMap = {};

function tr(key, vars) {
  return i18n.t(key, vars);
}

function boot() {
  i18n.init('zh');
  i18n.mountLangSwitcher('langSwitcher', { dark: true });
  init();
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('cancelled')) {
    showAlert(tr('public.cancelledMsg'), 'warning');
  }

  const today = new Date().toISOString().split('T')[0];
  document.querySelector('[name=lessonDate]').min = today;
  updateDurationLabels();

  window.addEventListener('langchange', () => {
    i18n.applyPage();
    updateDurationLabels();
    renderResortOptions();
    renderPricing();
    toggleStripeOption();
    updateQuote();
    document.getElementById('submitBtn').textContent = tr('public.submit');
  });

  try {
    const res = await publicApi.getPricing();
    pricing = res.data;
    stripeEnabled = pricing.stripeEnabled;
    (pricing.resorts || []).forEach((r) => {
      resortMap[r.id] = r;
    });
    renderResortOptions();
    renderPricing();
    toggleStripeOption();
  } catch (err) {
    showAlert(tr('public.loadPricingFail') + err.message, 'error');
  }

  document.getElementById('bookingForm').addEventListener('input', debounce(updateQuote, 300));
  document.getElementById('bookingForm').addEventListener('change', updateQuote);
  document.getElementById('bookingForm').addEventListener('submit', handleSubmit);

  updateQuote();
}

function updateDurationLabels() {
  const select = document.getElementById('durationSelect');
  if (!select) return;
  const val = select.value;
  select.innerHTML = [3, 4, 5, 6]
    .map((h) => `<option value="${h}" ${String(h) === val ? 'selected' : ''}>${h} ${tr('common.hours')}</option>`)
    .join('');
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function resortDisplayName(r) {
  return i18n.getLang() === 'en' && r.nameEn ? r.nameEn : r.name;
}

function listSeparator() {
  return i18n.getLang() === 'en' ? ', ' : '、';
}

function pricingNoteText() {
  return tr('public.pricingNote');
}

function regionDisplayName(region) {
  const key = `enum.${region.id}`;
  const translated = tr(key);
  return translated !== key ? translated : region.name;
}

function renderResortOptions() {
  const select = document.querySelector('[name=resortLocation]');
  if (!pricing?.regions) return;
  const current = select.value;

  select.innerHTML = pricing.regions
    .map((region) => {
      const resorts = region.resorts || [];
      if (!resorts.length) return '';
      return `
        <optgroup label="${regionDisplayName(region)}">
          ${resorts.map((r) => `<option value="${r.id}" ${r.id === current ? 'selected' : ''}>${resortDisplayName(r)}</option>`).join('')}
        </optgroup>
      `;
    })
    .join('');
}

function renderPricing() {
  const el = document.getElementById('pricingTable');
  if (!pricing?.regions) return;

  el.innerHTML = pricing.regions
    .map((region) => {
      const resortNames = (region.resorts || []).map((r) => resortDisplayName(r)).join(listSeparator());
      return `
      <div class="mb-5 last:mb-0">
        <p class="font-medium text-slate-800 mb-1">${regionDisplayName(region)}</p>
        <p class="text-xs text-slate-500 mb-2">${resortNames || region.description}</p>
        ${Object.entries(region.prices)
          .map(
            ([hours, price]) => `
          <div class="flex justify-between py-1.5 border-b border-slate-100 last:border-0 text-sm">
            <span>${hours} ${tr('common.hours')}</span>
            <span class="font-medium">${ui.formatMoney(price, pricing.currency)}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `;
    })
    .join('');

  el.innerHTML += `<p class="text-xs text-slate-500 mt-4 pt-4 border-t">${pricingNoteText()}</p>`;
}

function toggleStripeOption() {
  const stripeOption = document.getElementById('paymentStripe');
  const stripeNote = document.getElementById('stripeNote');
  if (!stripeEnabled) {
    stripeOption.disabled = true;
    stripeOption.parentElement.classList.add('opacity-50');
    stripeNote.textContent = tr('public.stripeUnavailable');
    document.getElementById('paymentOnSite').checked = true;
  } else {
    stripeNote.textContent = '';
  }
}

function getFormData() {
  const form = document.getElementById('bookingForm');
  return {
    lessonDate: form.lessonDate.value,
    resortLocation: form.resortLocation.value,
    durationHours: Number(form.durationHours.value),
    lessonType: form.lessonType.value,
    totalGuests: Number(form.totalGuests.value),
    childrenUnder6: Number(form.childrenUnder6.value),
    guestName: form.guestName.value,
    phone: form.phone.value,
    email: form.email.value,
    instagram: form.instagram?.value,
    facebook: form.facebook?.value,
    whatsapp: form.whatsapp?.value,
    line: form.line?.value,
    wechat: form.wechat?.value,
    languagePref: form.languagePref.value,
    specialRequests: form.specialRequests.value,
    paymentMethod: form.paymentMethod.value,
  };
}

function resortLabel(id) {
  const r = resortMap[id];
  if (r) return resortDisplayName(r);
  return ui.label(id) || id;
}

async function updateQuote() {
  const form = document.getElementById('bookingForm');
  const resortLocation = form.resortLocation?.value;
  const durationHours = Number(form.durationHours.value);
  const totalGuests = Number(form.totalGuests.value) || 1;
  const childrenUnder6 = Number(form.childrenUnder6.value) || 0;

  const summaryEl = document.getElementById('quoteSummary');
  if (!resortLocation || !durationHours || !totalGuests) {
    summaryEl.innerHTML = `<p class="text-slate-500">${tr('public.quoteEmpty')}</p>`;
    return;
  }

  try {
    const res = await publicApi.getQuote({
      resortLocation,
      durationHours,
      totalGuests,
      childrenUnder6,
      lessonDate: form.lessonDate?.value,
    });
    const q = res.data;

    const capEl = document.getElementById('capacityNotice');
    if (q.capacity) {
      const capMsgs = {
        overbooked: ['public.capacityOver', 'bg-red-50 text-red-800 border-red-200'],
        tight: ['public.capacityTight', 'bg-amber-50 text-amber-800 border-amber-200'],
        ok: ['public.capacityOk', 'bg-green-50 text-green-800 border-green-200'],
      };
      const [key, cls] = capMsgs[q.capacity.status] || capMsgs.ok;
      capEl.className = `border rounded-lg px-3 py-2 text-sm mb-4 ${cls}`;
      capEl.textContent = tr(key);
      capEl.classList.remove('hidden');
    } else {
      capEl.classList.add('hidden');
    }

    let coachNote = tr('public.coachesNeeded', { n: q.coachesRequired });
    if (childrenUnder6 >= 2) coachNote += ' ' + tr('public.coachesChild');
    else if (totalGuests > 4) coachNote += ' ' + tr('public.coachesOver4');

    const packageNote =
      q.coachesRequired > 1
        ? tr('public.packageNoteMulti', {
            price: ui.formatMoney(q.packagePrice, q.currency),
            n: q.coachesRequired,
          })
        : tr('public.packageNote');

    summaryEl.innerHTML = `
      <div class="space-y-3">
        <div class="flex justify-between">
          <span class="text-slate-600">${tr('public.resortLabel')}</span>
          <span class="text-right text-sm">${q.resortName || resortLabel(resortLocation)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-600">${tr('public.regionLabel')}</span>
          <span class="text-right text-sm text-slate-500">${q.regionName}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-600">${tr('public.packagePrice')}</span>
          <span>${ui.formatMoney(q.packagePrice, q.currency)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-600">${tr('public.guests')}</span>
          <span>${q.totalGuests} ${tr('common.people')}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-600">${tr('public.lessonHours')}</span>
          <span>${q.durationHours} ${tr('common.hours')}</span>
        </div>
        <div class="flex justify-between font-semibold text-lg border-t pt-3">
          <span>${tr('public.estimatedTotal')}</span>
          <span class="text-brand-700">${ui.formatMoney(q.totalAmount, q.currency)}</span>
        </div>
        <p class="text-xs text-slate-500">${packageNote}</p>
        <p class="text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2">${coachNote}</p>
        <p class="text-xs text-slate-500">${pricingNoteText()}</p>
      </div>
    `;
  } catch (err) {
    summaryEl.innerHTML = `<p class="text-red-600 text-sm">${err.message}</p>`;
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = tr('public.submitting');

  try {
    const data = getFormData();

    if (data.paymentMethod === 'stripe' && !data.email) {
      throw new Error(tr('public.emailRequired'));
    }

    const res = await publicApi.submitBooking(data);

    if (res.data.checkoutUrl) {
      window.location.href = res.data.checkoutUrl;
      return;
    }

    const { id, publicRef } = res.data.booking;
    window.location.href = `/confirmation.html?id=${id}&ref=${publicRef}`;
  } catch (err) {
    showAlert(err.message, 'error');
    btn.disabled = false;
    btn.textContent = tr('public.submit');
  }
}

function showAlert(message, type = 'info') {
  const el = document.getElementById('alert');
  const colors = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    error: 'bg-red-50 text-red-800 border-red-200',
  };
  el.className = `border rounded-lg px-4 py-3 text-sm mb-6 ${colors[type]}`;
  el.textContent = message;
  el.classList.remove('hidden');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
