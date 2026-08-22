/* Browser API client. Authentication remains server-side in /functions/course.js. */
window.API = {
  baseUrl: '/course',

  async post(endpoint, payload = {}, target = 'nexttoppers-course') {
    const url = new URL(this.baseUrl, window.location.origin);
    url.searchParams.set('endpoint', endpoint);
    // target is intentionally local-only; the Worker strips it before upstream.
    if (target) url.searchParams.set('target', target);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(payload || {})
    });

    return this._read(response);
  },

  async get(endpoint, params = {}, target = 'nexttoppers-course') {
    const url = new URL(this.baseUrl, window.location.origin);
    url.searchParams.set('endpoint', endpoint);
    if (target) url.searchParams.set('target', target);

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key === 'courseid' ? 'course_id' : key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/plain, */*' }
    });

    return this._read(response);
  },

  async _read(response) {
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error(`API returned a non-JSON response (${response.status}).`);
    }

    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || `API request failed (${response.status})`);
    }
    return data;
  }
};
