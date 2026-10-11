# Tech Commerce

Miniaplicație CRUD pentru produse tech, cu interfață frontend și API REST local. Serverul folosește doar modulele native Node.js și păstrează produsele în `products.json`.

## Pornire

1. Instalează Node.js dacă nu este deja instalat.
2. Pornește API-ul o singură dată din acest folder cu `node server.js` și lasă terminalul deschis.
3. În VS Code poți deschide `index.html` cu extensia Live Server sau îl poți deschide direct în browser. Interfața trimite cereri către `http://127.0.0.1:3000/api/products`.

Serverul permite cereri din `file://` și de pe origini HTTP locale (`localhost`, `127.0.0.1`, `::1`) pentru dezvoltare. Dacă API-ul nu rulează, interfața afișează eroarea și butonul de reîncercare.

## Endpoint-uri

| Metodă | Endpoint | Acțiune |
| --- | --- | --- |
| GET | `/api/products` | Citește toate produsele |
| GET | `/api/products/:id` | Citește un produs |
| POST | `/api/products` | Creează produsul; ID-ul este generat de server |
| PUT | `/api/products/:id` | Înlocuiește datele unui produs |
| DELETE | `/api/products/:id` | Șterge produsul |

Corpurile POST și PUT sunt JSON și conțin `name`, `category`, `price`, `quantity` și `status`. Serverul validează datele și răspunde cu coduri HTTP potrivite (`201`, `400`, `404`, `405`, `413`, `500`) și un mesaj JSON pentru erori.

Frontend-ul folosește funcțiile din `product-api.js`; erorile de rețea, răspunsurile HTTP nereușite și JSON-ul invalid sunt afișate în interfață.

## Navigarea frontend

Aplicația folosește hash routing, astfel încât navigarea client-side funcționează și când deschizi `index.html` direct sau prin Live Server, fără reîncărcare de pagină.

| Rută | Ecran |
| --- | --- |
| `#/` | Pagina principală |
| `#/products` | Catalog, formularul CRUD și filtre |
| `#/products/:id` | Detaliile produsului; `id` este extras din rută și folosit pentru `GET /api/products/:id` |
| `#/about` | Despre aplicație |
| orice rută necunoscută | Ecran 404 |

Catalogul folosește query parameters pentru căutare, categorie și sortare, de exemplu `index.html#/products?search=laptop&category=Laptopuri&sort=price-asc`. Linkul către un produs folosește parametrul de rută, de exemplu `#/products/1`.
