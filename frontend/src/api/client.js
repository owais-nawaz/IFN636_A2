const BASE = '/api';

async function parseRes(res) {
  const text = await res.text();
  if (!text) throw new Error('No response from server — make sure the backend is running on port 3000.');
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('Invalid server response — the Vite proxy may not be active. Restart the dev server.'); }
  if (!data.success) throw new Error(data.errors ? data.errors.join(' ') : 'Error');
  return data;
}

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'Authorization': user?.token ? `Bearer ${user.token}` : '',
  };
}

export const authApi = {
  login: (creds) => fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds)
  }).then(parseRes),

  signup: (data) => fetch(`${BASE}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(parseRes),
};

export const bugsApi = {

  claim: (id, user) => fetch(`${BASE}/bugs/${id}/claim`, {
    method: 'PATCH', headers: authHeaders(user),
  }).then(parseRes),

  resolve: (id, data, user) => fetch(`${BASE}/bugs/${id}/resolve`, {
    method: 'PATCH', headers: authHeaders(user), body: JSON.stringify(data)
  }).then(parseRes),

  verify: (id, data, user) => fetch(`${BASE}/bugs/${id}/verify`, {
    method: 'PATCH', headers: authHeaders(user), body: JSON.stringify(data)
  }).then(parseRes),

  getAll: (filters = {}) => {
    const p = new URLSearchParams();
    if (filters.status   && filters.status   !== 'All') p.set('status',   filters.status);
    if (filters.priority && filters.priority !== 'All') p.set('priority', filters.priority);
    if (filters.search?.trim()) p.set('search', filters.search.trim());
    return fetch(`${BASE}/bugs?${p}`).then(parseRes);
  },

  create: (data, user) => fetch(`${BASE}/bugs`, {
    method: 'POST', headers: authHeaders(user), body: JSON.stringify(data)
  }).then(parseRes),

  getHistory: (id, user) => fetch(`${BASE}/bugs/${id}/history`, {
    headers: authHeaders(user),
  }).then(parseRes),
};

export const notificationsApi = {
  getAll: (user) => fetch(`${BASE}/notifications`, {
    headers: authHeaders(user),
  }).then(parseRes),

  markRead: (id, user) => fetch(`${BASE}/notifications/${id}/read`, {
    method: 'PATCH', headers: authHeaders(user),
  }).then(parseRes),
};
