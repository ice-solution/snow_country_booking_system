const API = '/api/v1/instructor-view';
const t = (key, vars) => i18n.t(key, vars);

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

function showMsg(el, text, ok) {
  el.textContent = text;
  el.className = `text-sm mt-2 ${ok ? 'text-green-700' : 'text-red-600'}`;
  el.classList.remove('hidden');
}

function label(key) {
  const translated = t(`enum.${key}`);
  return translated !== `enum.${key}` ? translated : key;
}

function fillProfileForm(instructor) {
  const form = document.getElementById('profileForm');
  form.name.value = instructor.name || '';
  form.phone.value = instructor.phone || '';
  form.email.value = instructor.email || '';
  form.querySelectorAll('[name=languages]').forEach((el) => {
    el.checked = (instructor.languages || []).includes(el.value);
  });

  document.getElementById('readOnlyInfo').innerHTML = `
    <p>${t('admin.instructorForm.specialty')}: ${(instructor.specialties || []).map(label).join(', ') || '-'}</p>
    <p>${t('admin.instructorForm.heatLevel')}: ${label(instructor.heatLevel || 'medium')}</p>
    <p>${t('admin.instructorForm.skillLevel')}: ${instructor.skillLevel || 3}/5</p>
  `;
}

async function loadProfile() {
  const res = await fetchJson(`${API}/me`);
  document.getElementById('instructorName').textContent = res.data.name;
  fillProfileForm(res.data);
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
}

async function init() {
  i18n.init('zh');
  i18n.mountLangSwitcher('langSwitcherHeader');

  window.addEventListener('langchange', () => {
    i18n.applyPage();
    if (window._instructorProfile) fillProfileForm(window._instructorProfile);
  });

  if (!getToken()) {
    document.getElementById('loginGate').classList.remove('hidden');
    return;
  }

  try {
    const res = await fetchJson(`${API}/me`);
    window._instructorProfile = res.data;
    await loadProfile();
  } catch (_err) {
    setToken('');
    document.getElementById('loginGate').classList.remove('hidden');
    return;
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await fetchJson(`${API}/logout`, { method: 'POST' });
    } catch (_err) {
      /* ignore */
    }
    setToken('');
    window.location.href = '/instructor/';
  });

  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const msg = document.getElementById('profileMsg');
    const languages = [...form.querySelectorAll('[name=languages]:checked')].map((el) => el.value);
    if (!languages.length) {
      showMsg(msg, t('instructor.languageRequired'), false);
      return;
    }
    try {
      const res = await fetchJson(`${API}/me`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name.value,
          phone: form.phone.value,
          email: form.email.value,
          languages,
        }),
      });
      window._instructorProfile = res.data;
      document.getElementById('instructorName').textContent = res.data.name;
      showMsg(msg, t('instructor.profileSaved'), true);
    } catch (err) {
      showMsg(msg, err.message, false);
    }
  });

  document.getElementById('pinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const msg = document.getElementById('pinMsg');
    if (form.newPin.value !== form.confirmPin.value) {
      showMsg(msg, t('instructor.pinMismatch'), false);
      return;
    }
    try {
      await fetchJson(`${API}/me/pin`, {
        method: 'PUT',
        body: JSON.stringify({
          currentPin: form.currentPin.value,
          newPin: form.newPin.value,
        }),
      });
      form.reset();
      showMsg(msg, t('instructor.pinUpdated'), true);
    } catch (err) {
      showMsg(msg, err.message, false);
    }
  });
}

init().catch((err) => {
  document.getElementById('loginGate').classList.remove('hidden');
  document.getElementById('loginGate').querySelector('p').textContent = err.message;
});
