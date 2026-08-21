/**
 * NextToppers API client (recovery build).
 *
 * Frontend requests are routed through the local/server-side /course endpoint.
 * The private upstream authorization token is intentionally NOT embedded in
 * this browser file. Configure it on the server via NEXTTOPPERS_API_TOKEN.
 */
const API = {
  async request(method, endpoint, data = {}, target = 'nexttoppers-course') {
    const cleanEndpoint = String(endpoint || '').split('/').pop();
    const params = new URLSearchParams({ endpoint: cleanEndpoint, target });
    const url = `/course?${params.toString()}`;

    const options = {
      method,
      headers: { 'Accept': 'application/json' }
    };

    if (method === 'POST') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data || {});
    }

    console.log(`[API Helper] ${method} ${cleanEndpoint} on ${target}`, data);

    const response = await fetch(url, options);
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }

    if (!response.ok) {
      const err = new Error(payload?.message || `Server responded with ${response.status}`);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    console.log('[API Helper] Success:', payload);
    return payload;
  },

  // Compatibility wrapper. The old GET /course path was returning 404.
  // We now send the same logical request through POST /course.
  async get(endpoint, data = {}, target = 'nexttoppers-course') {
    console.warn('[API Helper] GET compatibility call converted to POST:', endpoint);
    return this.request('POST', endpoint, data, target);
  },

  async post(endpoint, data = {}, target = 'nexttoppers-course') {
    return this.request('POST', endpoint, data, target);
  },

  showError(message) {
    console.error('Graceful Error:', message);
  }
};
window.API = API;
