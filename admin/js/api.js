const API_BASE = '/api/v1';

function getApiKey() {
  return localStorage.getItem('adminApiKey') || '';
}

function setApiKey(key) {
  localStorage.setItem('adminApiKey', key);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const apiKey = getApiKey();
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data.message || data.errors?.[0]?.msg || 'Request failed';
    throw new Error(message);
  }
  return data;
}

const api = {
  getMeta: () => request('/meta'),
  getHealth: () => request('/health'),

  listCoaches: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/coaches${qs ? `?${qs}` : ''}`);
  },
  getCoach: (id) => request(`/coaches/${id}`),
  createCoach: (body) => request('/coaches', { method: 'POST', body: JSON.stringify(body) }),
  updateCoach: (id, body) =>
    request(`/coaches/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCoach: (id) => request(`/coaches/${id}`, { method: 'DELETE' }),
  blockCoachDate: (id, body) =>
    request(`/coaches/${id}/block-date`, { method: 'POST', body: JSON.stringify(body) }),

  listBookings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/bookings${qs ? `?${qs}` : ''}`);
  },
  getBooking: (id) => request(`/bookings/${id}`),
  createBooking: (body) => request('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  updateBooking: (id, body) =>
    request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  confirmBooking: (id, body = {}) =>
    request(`/bookings/${id}/confirm`, { method: 'POST', body: JSON.stringify(body) }),
  cancelBooking: (id, body = {}) =>
    request(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify(body) }),
  markNeedsAttention: (id, body = {}) =>
    request(`/bookings/${id}/needs-attention`, { method: 'POST', body: JSON.stringify(body) }),
  resolveBooking: (id, body = {}) =>
    request(`/bookings/${id}/resolve`, { method: 'POST', body: JSON.stringify(body) }),
  completeBooking: (id, body = {}) =>
    request(`/bookings/${id}/complete`, { method: 'POST', body: JSON.stringify(body) }),
  suggestCoaches: (id, forReassign = false) =>
    request(`/bookings/${id}/suggest-coaches${forReassign ? '?forReassign=1' : ''}`),
  assignCoaches: (id, coachIds) =>
    request(`/bookings/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ coachIds, assignedBy: 'admin' }),
    }),
  reassignCoaches: (id, coachIds) =>
    request(`/bookings/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ coachIds, assignedBy: 'admin' }),
    }),
  autoAssignCoaches: (id) =>
    request(`/bookings/${id}/auto-assign`, { method: 'POST' }),
  autoReassignCoaches: (id) =>
    request(`/bookings/${id}/auto-reassign`, { method: 'POST' }),
  calculateCoaches: (totalGuests, childrenUnder6) =>
    request('/bookings/calculate-coaches', {
      method: 'POST',
      body: JSON.stringify({ totalGuests, childrenUnder6 }),
    }),

  getAlerts: () => request('/alerts'),
  getSchedule: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/schedule${qs ? `?${qs}` : ''}`);
  },
  getGantt: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/gantt${qs ? `?${qs}` : ''}`);
  },
  getCapacity: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/capacity${qs ? `?${qs}` : ''}`);
  },
  getPricing: () => request('/pricing'),
  updatePricing: (body) => request('/pricing', { method: 'PUT', body: JSON.stringify(body) }),
  listPendingLeave: () => request('/coaches/leave-requests/pending'),
  reviewLeave: (coachId, requestId, action) =>
    request(`/coaches/${coachId}/leave-requests/${requestId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  parseKlookEmail: (body) =>
    request('/integrations/klook/parse', { method: 'POST', body: JSON.stringify(body) }),
  importKlookEmail: (body) =>
    request('/integrations/klook/import', { method: 'POST', body: JSON.stringify(body) }),
  getIntegrationMeta: () => request('/integrations/meta'),
  unblockCoachDate: (id, body) =>
    request(`/coaches/${id}/unblock-date`, { method: 'POST', body: JSON.stringify(body) }),
};

window.api = api;
window.getApiKey = getApiKey;
window.setApiKey = setApiKey;
