import { getToken } from './storage';

// Physical device (Android + iOS): use your PC's LAN IP
// Android emulator only: use 10.0.2.2
export const API_BASE_URL = 'http://10.187.101.163:8000';

// App.js registers this so any 401 auto-triggers logout
let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  _onUnauthorized = fn;
}

async function request(path, options = {}) {
  const token = options.skipAuth ? null : await getToken();

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check that FastAPI is running and the IP is correct.');
  }

  if (response.status === 401 && !options.skipAuth) {
    _onUnauthorized?.();
    throw new Error('Session expired. Please log in again.');
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    let msg = 'Request failed.';
    if (typeof data === 'string' && data) {
      msg = data;
    } else if (data?.detail) {
      if (Array.isArray(data.detail)) {
        // FastAPI validation errors: [{loc, msg, type}]
        msg = data.detail.map((e) => e.msg || JSON.stringify(e)).join(', ');
      } else {
        msg = String(data.detail);
      }
    } else if (data) {
      msg = JSON.stringify(data);
    }
    throw new Error(msg);
  }

  return data;
}

export const api = {
  healthCheck: () => request('/health', { skipAuth: true }),
  login: (body) => request('/login', { method: 'POST', body, skipAuth: true }),
  register: (body) => request('/register', { method: 'POST', body, skipAuth: true }),
  requestPasswordReset: (body) => request('/password-reset/request', { method: 'POST', body, skipAuth: true }),
  confirmPasswordReset: (body) => request('/password-reset/confirm', { method: 'POST', body, skipAuth: true }),

  getMe: () => request('/me'),
  getChatHistory: () => request('/chat/history'),
  searchChats: (q) => request(`/chat/search?q=${encodeURIComponent(q)}`),
  getMedicalHistory: () => request('/medical-history'),
  sendChat: (body) => request('/chat', { method: 'POST', body }),

  replyToNote: (noteId, body) => request(`/notes/${noteId}/reply`, { method: 'POST', body }),
  registerPushToken: (body) => request('/push-token', { method: 'POST', body }),
  uploadFile: async (uri, filename, mimeType) => {
    const token = await import('./storage').then(m => m.getToken());
    const formData = new FormData();
    formData.append('file', { uri, name: filename, type: mimeType });
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed.');
    return response.json();
  },
  registerDoctorPushToken: (body) => request('/doctor/push-token', { method: 'POST', body }),

  getPatients: () => request('/patients'),
  getPatient: (id) => request(`/patients/${id}`),
  getFlaggedChats: () => request('/doctor/flagged-chats'),
  getNotifications: () => request('/doctor/notifications'),
  reviewChat: (chatId) => request(`/doctor/chats/${chatId}/review`, { method: 'POST' }),
  addDoctorNote: (body) => request('/doctor/notes', { method: 'POST', body }),
  addMedicalHistory: (body) => request('/doctor/medical-history', { method: 'POST', body }),
};
