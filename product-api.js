(() => {
  const API_URL = 'http://127.0.0.1:3000/api/products';

  async function request(url, options = {}) {
    let response;

    try {
      response = await fetch(url, {
        ...options,
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers
        }
      });
    } catch (error) {
      throw new Error('Nu s-a putut contacta serverul API. Verifică dacă server.js rulează.');
    }

    if (!response.ok) {
      let message = `Cererea API a eșuat (HTTP ${response.status}).`;

      try {
        const body = await response.json();
        if (typeof body.error === 'string') message = body.error;
      } catch (error) {
        // Păstrează mesajul HTTP dacă răspunsul de eroare nu conține JSON valid.
      }

      throw new Error(message);
    }

    if (response.status === 204) return null;

    try {
      return await response.json();
    } catch (error) {
      throw new Error('Serverul API a returnat un răspuns JSON invalid.');
    }
  }

  window.productApi = {
    getAll: () => request(API_URL),
    getById: (id) => request(`${API_URL}/${encodeURIComponent(id)}`),
    create: (product) => request(API_URL, {
      method: 'POST',
      body: JSON.stringify(product)
    }),
    update: (id, product) => request(`${API_URL}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(product)
    }),
    remove: (id) => request(`${API_URL}/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  };
})();
