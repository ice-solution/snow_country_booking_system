(function () {
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
    const id = params.get('id');
    const ref = params.get('ref');
    const payment = params.get('payment');

    window.addEventListener('langchange', () => {
      i18n.applyPage();
      if (window._lastBooking) renderBooking(window._lastBooking);
    });

    if (!id || !ref) {
      renderNotFound();
      return;
    }

    if (payment === 'success') {
      document.getElementById('paymentBanner').classList.remove('hidden');
    }

    try {
      const res = await publicApi.getBooking(id, ref);
      window._lastBooking = res.data;
      renderBooking(res.data);
    } catch (err) {
      document.getElementById('content').innerHTML = `
        <div class="text-center py-16">
          <p class="text-red-600 mb-4">${err.message}</p>
          <a href="/book.html" class="text-brand-600 hover:underline">${tr('public.backToBook')}</a>
        </div>
      `;
    }
  }

  function renderNotFound() {
    document.getElementById('content').innerHTML = `
      <div class="text-center py-16">
        <p class="text-red-600 mb-4">${tr('public.notFound')}</p>
        <a href="/book.html" class="text-brand-600 hover:underline">${tr('public.backToBook')}</a>
      </div>
    `;
  }

  function renderBooking(b) {
    document.getElementById('content').innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div class="bg-brand-500 text-white px-6 py-5 text-center">
          <div class="text-3xl mb-2">✓</div>
          <h2 class="text-xl font-bold">${tr('public.submitted')}</h2>
          <p class="text-brand-100 text-sm mt-1">${tr('public.submittedDesc')}</p>
        </div>

        <div class="p-6 space-y-4">
          <div class="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-slate-500">${tr('public.refNo')}</p>
              <p class="font-mono font-medium">${b.id}</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.status')}</p>
              <p class="font-medium">${ui.label(b.status)}</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.resortLabel')}</p>
              <p class="font-medium">${ui.label(b.resortLocation || b.region)}</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.lessonDate')}</p>
              <p class="font-medium">${ui.formatDate(b.lessonDate)}</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.lessonHours')}</p>
              <p class="font-medium">${b.durationHours} ${tr('common.hours')}</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.lessonType')}</p>
              <p class="font-medium">${ui.label(b.lessonType)}</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.guests')}</p>
              <p class="font-medium">${b.totalGuests} ${tr('common.people')}（${tr('public.childrenUnder6')}: ${b.childrenUnder6}）</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.coachesRequired')}</p>
              <p class="font-medium">${b.coachesRequired}</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.guestName')}</p>
              <p class="font-medium">${b.guestName}</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.phone')}</p>
              <p class="font-medium">${b.phone}</p>
            </div>
            ${b.email ? `<div><p class="text-slate-500">${tr('public.email')}</p><p class="font-medium">${b.email}</p></div>` : ''}
            <div>
              <p class="text-slate-500">${tr('public.languagePref')}</p>
              <p class="font-medium">${ui.label(b.languagePref)}</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.paymentMethod')}</p>
              <p class="font-medium">${ui.label(b.paymentMethod)}</p>
            </div>
            <div>
              <p class="text-slate-500">${tr('public.paymentStatus')}</p>
              <p class="font-medium">${ui.label(b.paymentStatus)}</p>
            </div>
            <div class="sm:col-span-2">
              <p class="text-slate-500">${tr('public.estimatedFee')}</p>
              <p class="font-bold text-xl text-brand-600">${ui.formatMoney(b.totalAmount, b.currency)}</p>
            </div>
            ${b.specialRequests ? `
            <div class="sm:col-span-2">
              <p class="text-slate-500">${tr('public.specialRequests')}</p>
              <p class="font-medium">${b.specialRequests}</p>
            </div>` : ''}
          </div>

          <div class="bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
            <p class="font-medium text-slate-800 mb-1">${tr('public.nextSteps')}</p>
            <p>${tr('public.nextStepsDesc')}</p>
          </div>
        </div>
      </div>

      <div class="text-center mt-8">
        <a href="/" class="text-brand-600 hover:underline text-sm">${tr('public.backHome')}</a>
      </div>
    `;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
