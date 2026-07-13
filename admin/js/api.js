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

  listInstructors: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/instructors${qs ? `?${qs}` : ''}`);
  },
  getInstructor: (id) => request(`/instructors/${id}`),
  createInstructor: (body) => request('/instructors', { method: 'POST', body: JSON.stringify(body) }),
  updateInstructor: (id, body) =>
    request(`/instructors/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteInstructor: (id) => request(`/instructors/${id}`, { method: 'DELETE' }),
  blockInstructorDate: (id, body) =>
    request(`/instructors/${id}/block-date`, { method: 'POST', body: JSON.stringify(body) }),

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
  suggestInstructors: (id, forReassign = false) =>
    request(`/bookings/${id}/suggest-instructors${forReassign ? '?forReassign=1' : ''}`),
  assignInstructors: (id, instructorIds) =>
    request(`/bookings/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ instructorIds, assignedBy: 'admin' }),
    }),
  reassignInstructors: (id, instructorIds) =>
    request(`/bookings/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ instructorIds, assignedBy: 'admin' }),
    }),
  autoAssignInstructors: (id) =>
    request(`/bookings/${id}/auto-assign`, { method: 'POST' }),
  autoReassignInstructors: (id) =>
    request(`/bookings/${id}/auto-reassign`, { method: 'POST' }),
  calculateInstructors: (totalGuests, childrenUnder6) =>
    request('/bookings/calculate-instructors', {
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
  listPendingLeave: () => request('/instructors/leave-requests/pending'),
  reviewLeave: (instructorId, requestId, action) =>
    request(`/instructors/${instructorId}/leave-requests/${requestId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  parseKlookEmail: (body) =>
    request('/integrations/klook/parse', { method: 'POST', body: JSON.stringify(body) }),
  importKlookEmail: (body) =>
    request('/integrations/klook/import', { method: 'POST', body: JSON.stringify(body) }),
  getIntegrationMeta: () => request('/integrations/meta'),
  unblockInstructorDate: (id, body) =>
    request(`/instructors/${id}/unblock-date`, { method: 'POST', body: JSON.stringify(body) }),
};

window.api = api;
window.getApiKey = getApiKey;
window.setApiKey = setApiKey;
