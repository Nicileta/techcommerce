const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.join(__dirname, 'products.json');
const MAX_BODY_BYTES = 1024 * 1024;
const statuses = new Set(['available', 'out_of_stock', 'inactive']);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function isAllowedOrigin(origin) {
  return origin === 'null'
    || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (!origin) return true;
  if (!isAllowedOrigin(origin)) return false;

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  return true;
}

function readProducts() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(data)) throw new Error('Fișierul de produse trebuie să conțină o listă.');
  return data;
}

function writeProducts(products) {
  const temporaryFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryFile, DATA_FILE);
}

function isValidProduct(product) {
  return product !== null
    && typeof product === 'object'
    && !Array.isArray(product)
    && typeof product.name === 'string'
    && product.name.trim().length > 0
    && product.name.trim().length <= 120
    && typeof product.category === 'string'
    && product.category.trim().length > 0
    && product.category.trim().length <= 80
    && typeof product.price === 'number'
    && Number.isFinite(product.price)
    && product.price >= 0
    && Number.isInteger(product.quantity)
    && product.quantity >= 0
    && statuses.has(product.status);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let tooLarge = false;
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      if (tooLarge) return;
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(Object.assign(new Error('Corpul cererii depășește limita de 1 MB.'), { statusCode: 413 }));
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      if (tooLarge) return;
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(Object.assign(new Error('Corpul cererii trebuie să fie JSON valid.'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

async function handleApiRequest(request, response, url) {
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length > 3 || pathParts[0] !== 'api' || pathParts[1] !== 'products') {
    sendJson(response, 404, { error: 'Endpoint-ul API nu a fost găsit.' });
    return;
  }

  const id = pathParts.length === 3 ? Number(pathParts[2]) : null;
  if (pathParts.length === 3 && (!Number.isSafeInteger(id) || id < 1)) {
    sendJson(response, 400, { error: 'Identificatorul produsului nu este valid.' });
    return;
  }

  const products = readProducts();

  if (request.method === 'GET' && id === null) {
    sendJson(response, 200, products);
    return;
  }

  if (request.method === 'GET' && id !== null) {
    const product = products.find((item) => item.id === id);
    if (!product) {
      sendJson(response, 404, { error: 'Produsul solicitat nu există.' });
      return;
    }
    sendJson(response, 200, product);
    return;
  }

  if (request.method === 'POST' && id === null) {
    const body = await readRequestBody(request);
    if (!isValidProduct(body)) {
      sendJson(response, 400, { error: 'Date invalide: verifică numele, categoria, prețul, cantitatea și statusul.' });
      return;
    }
    const nextId = products.reduce((maximum, product) => Math.max(maximum, product.id), 0) + 1;
    if (!Number.isSafeInteger(nextId)) {
      sendJson(response, 500, { error: 'Nu s-a putut genera un identificator pentru produs.' });
      return;
    }
    const created = {
      id: nextId,
      name: body.name.trim(),
      category: body.category.trim(),
      price: body.price,
      quantity: body.quantity,
      status: body.status
    };
    products.push(created);
    writeProducts(products);
    sendJson(response, 201, created);
    return;
  }

  if (request.method === 'PUT' && id !== null) {
    const index = products.findIndex((item) => item.id === id);
    if (index < 0) {
      sendJson(response, 404, { error: 'Produsul care trebuie actualizat nu există.' });
      return;
    }
    const body = await readRequestBody(request);
    if (!isValidProduct(body)) {
      sendJson(response, 400, { error: 'Date invalide: verifică numele, categoria, prețul, cantitatea și statusul.' });
      return;
    }
    const updated = {
      id,
      name: body.name.trim(),
      category: body.category.trim(),
      price: body.price,
      quantity: body.quantity,
      status: body.status
    };
    products[index] = updated;
    writeProducts(products);
    sendJson(response, 200, updated);
    return;
  }

  if (request.method === 'DELETE' && id !== null) {
    const remainingProducts = products.filter((item) => item.id !== id);
    if (remainingProducts.length === products.length) {
      sendJson(response, 404, { error: 'Produsul care trebuie șters nu există.' });
      return;
    }
    writeProducts(remainingProducts);
    response.writeHead(204);
    response.end();
    return;
  }

  sendJson(response, 405, { error: 'Metoda HTTP nu este permisă pentru acest endpoint.' });
}

function serveStaticFile(response, pathname) {
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch (error) {
    sendJson(response, 400, { error: 'Calea solicitată nu este validă.' });
    return;
  }

  const filePath = path.resolve(__dirname, `.${requestedPath}`);
  if (!filePath.startsWith(`${__dirname}${path.sep}`)) {
    sendJson(response, 403, { error: 'Accesul la această resursă este interzis.' });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      const statusCode = error.code === 'ENOENT' ? 404 : 500;
      sendJson(response, statusCode, { error: statusCode === 404 ? 'Fișierul nu a fost găsit.' : 'Nu s-a putut citi fișierul.' });
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream'
    });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);

  try {
    if (!applyCors(request, response)) {
      sendJson(response, 403, { error: 'Originea cererii nu este permisă.' });
      return;
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      await handleApiRequest(request, response, url);
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Metoda HTTP nu este permisă.' });
      return;
    }

    serveStaticFile(response, url.pathname);
  } catch (error) {
    console.error('Eroare la procesarea cererii:', error);
    if (!response.headersSent) {
      const statusCode = error.statusCode || 500;
      sendJson(response, statusCode, {
        error: statusCode === 500 ? 'Eroare internă a serverului API.' : error.message
      });
    } else {
      response.destroy();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Tech Commerce rulează la http://${HOST}:${PORT}`);
});
