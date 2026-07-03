const API_BASE = '/api/v1/website';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.errors?.[0]?.msg || 'Request failed');
  }
  return data;
}

const api = {
  getPricing: () => request('/pricing'),
  getQuote: (body) => request('/quote', { method: 'POST', body: JSON.stringify(body) }),
  getAvailability: (date) => request(`/availability?date=${encodeURIComponent(date)}`),
  submitBooking: (body) => request('/submit', { method: 'POST', body: JSON.stringify(body) }),
  getBooking: (id, ref) => request(`/bookings/${id}?ref=${encodeURIComponent(ref)}`),
};

window.publicApi = api;
