/* Browser-side API helper. Authentication stays server-side in /functions/course.js. */
window.API = {
  baseUrl: '/course',

  post: async function(endpoint, payload, target = 'nexttoppers-course') {
    const requestUrl = `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}&target=${encodeURIComponent(target)}`;
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const raw = await response.json();
    if (!response.ok || raw?.success === false) throw new Error(raw?.message || `API request failed (${response.status})`);
    if (raw?.data && typeof raw.data === 'string' && typeof window.EduVibeDecrypt !== 'undefined') {
      return await window.EduVibeDecrypt.decryptResponse(raw);
    }
    return raw;
  },

  get: async function(endpoint, params = {}, target = 'nexttoppers-course') {
    const qs = new URLSearchParams({ endpoint, target, ...params });
    const response = await fetch(`${this.baseUrl}?${qs.toString()}`, {
      method: 'GET', headers: { 'Accept': 'application/json' }
    });
    const raw = await response.json();
    if (!response.ok || raw?.success === false) throw new Error(raw?.message || `API request failed (${response.status})`);
    return raw;
  }
};
