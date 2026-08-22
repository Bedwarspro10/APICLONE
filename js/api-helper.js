const API_HELPER = {
  async fetchEndpoint(endpoint, payload = {}) {
    try {
      const response = await fetch(`/functions/course?endpoint=${encodeURIComponent(endpoint)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("API Helper Error:", error);
      throw error;
    }
  },

  async getEndpoint(endpoint, params = {}) {
    try {
      const queryParams = new URLSearchParams({ endpoint, ...params }).toString();
      const response = await fetch(`/functions/course?${queryParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("API Helper Error:", error);
      throw error;
    }
  }
};

window.API_HELPER = API_HELPER;
