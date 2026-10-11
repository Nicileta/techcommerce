(() => {
  const routes = [
    { path: '/', name: 'home' },
    { path: '/products', name: 'products' },
    { path: '/products/:id', name: 'productDetails' },
    { path: '/about', name: 'about' }
  ];
  const listeners = new Set();

  function getLocation() {
    const fragment = window.location.hash.slice(1) || '/';
    const url = new URL(fragment, 'http://router.local');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    let pathParts;
    try {
      pathParts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
    } catch (error) {
      return { name: 'notFound', path: pathname, params: {}, query: new URLSearchParams(url.search) };
    }

    for (const route of routes) {
      const routeParts = route.path.split('/').filter(Boolean);
      if (routeParts.length !== pathParts.length) continue;

      const params = {};
      const matches = routeParts.every((part, index) => {
        if (part.startsWith(':')) {
          params[part.slice(1)] = pathParts[index];
          return true;
        }
        return part === pathParts[index];
      });

      if (matches) {
        return {
          name: route.name,
          path: pathname,
          params,
          query: new URLSearchParams(url.search)
        };
      }
    }

    return { name: 'notFound', path: pathname, params: {}, query: new URLSearchParams(url.search) };
  }

  function notify() {
    const location = getLocation();
    listeners.forEach((listener) => listener(location));
  }

  function buildHash(path, query = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') {
        searchParams.set(key, String(value));
      }
    });
    const search = searchParams.toString();
    return `#${path}${search ? `?${search}` : ''}`;
  }

  function navigate(path, query = {}, replace = false) {
    const hash = buildHash(path, query);

    if (replace) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
      notify();
      return;
    }

    if (window.location.hash === hash) {
      notify();
    } else {
      window.location.hash = hash;
    }
  }

  window.appRouter = {
    getLocation,
    navigate,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };

  window.addEventListener('hashchange', notify);
  if (!window.location.hash) {
    window.location.hash = '#/';
  } else {
    notify();
  }
})();
