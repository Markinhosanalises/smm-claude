/* Session cookies are sent only to our origin. Credentials never enter URLs/storage. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  const inFlight = new Map();
  window.smmFetch = async function (input, options = {}) {
    const url = new URL(input, location.origin);
    if (url.origin !== location.origin) throw new Error('Destino externo não permitido');
    url.searchParams.delete('pin');
    url.searchParams.delete('senha');
    let body;
    if (options.body) {
      body = JSON.parse(options.body);
      if (body.acao !== 'admin-login') delete body.pin;
      options = { ...options, body: JSON.stringify(body) };
    }
    const method = options.method || 'GET';
    const operation = body && method === 'POST' && (['/api/order', '/api/carteira'].includes(url.pathname)||(url.pathname==='/api/revendedor'&&body.acao==='creditar-cliente-manual'));
    const signature = operation ? url.pathname + ':' + options.body : null;
    const headers = new Headers(options.headers);
    if (operation) {
      let id = inFlight.get(signature) || sessionStorage.getItem('smm_pending:' + signature);
      if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('smm_pending:' + signature, id); }
      inFlight.set(signature, id);
      headers.set('Idempotency-Key', id);
    }
    const response = await nativeFetch(url, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
    if (operation && (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429))) {
      inFlight.delete(signature); sessionStorage.removeItem('smm_pending:' + signature);
    }
    return response;
  };
})();
