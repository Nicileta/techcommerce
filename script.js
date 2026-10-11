const statuses = ['available', 'out_of_stock', 'inactive'];
const form = document.getElementById('productForm');
const formTitle = document.getElementById('formTitle');
const searchInput = document.getElementById('searchInput');
const tableBody = document.getElementById('productTableBody');
const resetFormBtn = document.getElementById('resetFormBtn');
const appMessage = document.getElementById('appMessage');
const retryButton = document.getElementById('retryButton');
const sortSelect = document.getElementById('sortSelect');
const categoryFilter = document.getElementById('categoryFilter');
const routePage = document.getElementById('routePage');
const formPanel = document.getElementById('productFormPanel');
const listPanel = document.getElementById('productListPanel');
const submitButton = form.querySelector('button[type="submit"]');

let products = [];
let editingId = null;
let routeRequestId = 0;
let productLoadError = null;

function showMessage(message, type = '') {
  appMessage.textContent = message;
  appMessage.className = `app-message${type ? ` message-${type}` : ''}`;
  appMessage.hidden = !message;
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  resetFormBtn.disabled = isBusy;
  tableBody.querySelectorAll('button').forEach((button) => {
    button.disabled = isBusy;
  });
}

function getStatusLabel(status) {
  const labels = {
    available: 'Disponibil',
    out_of_stock: 'Stoc epuizat',
    inactive: 'Inactiv'
  };
  return labels[status];
}

function createCell(text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

function createActionButton(label, action, id, className) {
  const button = document.createElement('button');
  button.className = `icon-btn ${className}`;
  button.dataset.action = action;
  button.dataset.id = String(id);
  button.type = 'button';
  button.textContent = label;
  return button;
}

function renderProducts() {
  const query = window.appRouter.getLocation().query;
  const searchTerm = (query.get('search') || '').trim().toLocaleLowerCase();
  const category = query.get('category') || '';
  const sort = query.get('sort') || '';
  const filteredProducts = products
    .filter((product) =>
      (product.name.toLocaleLowerCase().includes(searchTerm)
        || product.category.toLocaleLowerCase().includes(searchTerm))
      && (!category || product.category === category)
    )
    .sort((first, second) => {
      if (sort === 'name') return first.name.localeCompare(second.name, 'ro');
      if (sort === 'price-asc') return first.price - second.price;
      if (sort === 'price-desc') return second.price - first.price;
      return first.id - second.id;
    });

  tableBody.replaceChildren();

  if (!filteredProducts.length) {
    const row = document.createElement('tr');
    const cell = createCell('Nu există produse care să corespundă criteriilor.');
    cell.colSpan = 6;
    cell.className = 'empty-state';
    row.append(cell);
    tableBody.append(row);
    return;
  }

  filteredProducts.forEach((product) => {
    const row = document.createElement('tr');
    row.append(
      createCell(product.name),
      createCell(product.category),
      createCell(`${Number(product.price).toFixed(2)} lei`),
      createCell(String(product.quantity))
    );

    const statusCell = document.createElement('td');
    const statusPill = document.createElement('span');
    statusPill.className = `status-pill status-${product.status}`;
    statusPill.textContent = getStatusLabel(product.status);
    statusCell.append(statusPill);
    row.append(statusCell);

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      createActionButton('Detalii', 'view', product.id, 'edit-btn'),
      createActionButton('Edit', 'edit', product.id, 'edit-btn'),
      createActionButton('Delete', 'delete', product.id, 'delete-btn')
    );
    actionsCell.append(actions);
    row.append(actionsCell);
    tableBody.append(row);
  });
}

function renderCategoryOptions(selectedCategory = '') {
  const categories = [...new Set(products.map((product) => product.category))]
    .sort((first, second) => first.localeCompare(second, 'ro'));
  categoryFilter.replaceChildren(new Option('Toate categoriile', ''));
  categories.forEach((category) => {
    categoryFilter.add(new Option(category, category));
  });
  categoryFilter.value = categories.includes(selectedCategory) ? selectedCategory : '';
}

async function loadProducts() {
  retryButton.hidden = true;
  productLoadError = null;
  if (window.appRouter.getLocation().name === 'products') {
    showMessage('Se încarcă produsele din API...');
  }

  try {
    const data = await window.productApi.getAll();
    if (!Array.isArray(data)) {
      throw new Error('Răspunsul API pentru lista de produse nu are formatul așteptat.');
    }
    products = data;
    productLoadError = null;
    if (window.appRouter.getLocation().name === 'products') {
      renderProducts();
      showMessage('');
      renderCategoryOptions(categoryFilter.value);
      retryButton.hidden = true;
      return;
    }
  } catch (error) {
    console.error('Eroare la încărcarea produselor:', error);
    productLoadError = error.message;
    if (window.appRouter.getLocation().name === 'products') {
      showMessage(error.message, 'error');
      retryButton.hidden = false;
    }
  }
}

function resetForm() {
  form.reset();
  document.getElementById('status').value = 'available';
  editingId = null;
  formTitle.textContent = 'Adăugare produs';
}

function populateForm(product) {
  document.getElementById('name').value = product.name;
  document.getElementById('category').value = product.category;
  document.getElementById('price').value = String(product.price);
  document.getElementById('quantity').value = String(product.quantity);
  document.getElementById('status').value = product.status;
  editingId = product.id;
  formTitle.textContent = 'Editare produs';
  document.getElementById('name').focus();
}

function readProductForm() {
  const formData = new FormData(form);
  const product = {
    name: String(formData.get('name')).trim(),
    category: String(formData.get('category')).trim(),
    price: Number(formData.get('price')),
    quantity: Number(formData.get('quantity')),
    status: String(formData.get('status'))
  };

  if (
    !product.name
    || !product.category
    || !Number.isFinite(product.price)
    || product.price < 0
    || !Number.isInteger(product.quantity)
    || product.quantity < 0
    || !statuses.includes(product.status)
  ) {
    throw new Error('Completează toate câmpurile cu valori valide. Prețul și cantitatea trebuie să fie nenegative, iar cantitatea întreagă.');
  }

  return product;
}

async function handleSubmit(event) {
  event.preventDefault();

  let product;
  try {
    product = readProductForm();
  } catch (error) {
    showMessage(error.message, 'error');
    return;
  }

  setBusy(true);
  try {
    if (editingId !== null) {
      const updatedProduct = await window.productApi.update(editingId, product);
      products = products.map((item) => item.id === editingId ? updatedProduct : item);
      showMessage('Produsul a fost actualizat cu succes.', 'success');
    } else {
      const createdProduct = await window.productApi.create(product);
      products.push(createdProduct);
      showMessage('Produsul a fost adăugat cu succes.', 'success');
    }
    renderProducts();
    resetForm();
  } catch (error) {
    console.error('Eroare la salvarea produsului:', error);
    showMessage(error.message, 'error');
  } finally {
    setBusy(false);
  }
}

async function handleTableClick(event) {
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest('button[data-action][data-id]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const product = products.find((item) => item.id === id);
  if (!product) return;

  if (button.dataset.action === 'edit') {
    populateForm(product);
    showMessage('');
    return;
  }

  if (button.dataset.action === 'view') {
    window.appRouter.navigate(`/products/${product.id}`);
    return;
  }

  if (button.dataset.action !== 'delete') return;
  if (!window.confirm(`Sigur vrei să ștergi produsul "${product.name}"?`)) return;

  setBusy(true);
  try {
    await window.productApi.remove(id);
    products = products.filter((item) => item.id !== id);
    if (editingId === id) resetForm();
    renderProducts();
    showMessage('Produsul a fost șters cu succes.', 'success');
  } catch (error) {
    console.error('Eroare la ștergerea produsului:', error);
    showMessage(error.message, 'error');
  } finally {
    setBusy(false);
  }
}

function setProductsQuery() {
  window.appRouter.navigate('/products', {
    search: searchInput.value.trim(),
    category: categoryFilter.value,
    sort: sortSelect.value
  }, true);
}

function createRouteLink(label, path, className = 'primary-btn') {
  const link = document.createElement('a');
  link.className = className;
  link.href = `#${path}`;
  link.textContent = label;
  return link;
}

function showRoutePage() {
  formPanel.hidden = true;
  listPanel.hidden = true;
  routePage.hidden = false;
  routePage.replaceChildren();
}

function showProductsPage(location) {
  routePage.hidden = true;
  formPanel.hidden = false;
  listPanel.hidden = false;
  searchInput.value = location.query.get('search') || '';
  sortSelect.value = location.query.get('sort') || '';
  renderCategoryOptions(location.query.get('category') || '');
  renderProducts();
  if (productLoadError) {
    showMessage(productLoadError, 'error');
    retryButton.hidden = false;
  }
}

function appendHeading(container, text) {
  const heading = document.createElement('h2');
  heading.textContent = text;
  container.append(heading);
}

async function showProductDetails(location, requestId) {
  showRoutePage();
  appendHeading(routePage, 'Detalii produs');
  const loading = document.createElement('p');
  loading.textContent = 'Se încarcă detaliile produsului...';
  routePage.append(loading);

  const id = Number(location.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    routePage.replaceChildren();
    appendHeading(routePage, 'Produs inexistent');
    routePage.append(createRouteLink('Înapoi la produse', '/products'));
    return;
  }

  try {
    const product = await window.productApi.getById(id);
    if (requestId !== routeRequestId) return;

    routePage.replaceChildren();
    appendHeading(routePage, product.name);
    const details = document.createElement('dl');
    details.className = 'detail-grid';
    [
      ['Categorie', product.category],
      ['Preț', `${Number(product.price).toFixed(2)} lei`],
      ['Cantitate', String(product.quantity)],
      ['Status', getStatusLabel(product.status)]
    ].forEach(([label, value]) => {
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = value;
      details.append(term, description);
    });
    routePage.append(details, createRouteLink('Înapoi la produse', '/products', 'secondary-btn'));
  } catch (error) {
    if (requestId !== routeRequestId) return;
    console.error('Eroare la încărcarea detaliilor produsului:', error);
    routePage.replaceChildren();
    appendHeading(routePage, 'Nu s-au putut încărca detaliile');
    const message = document.createElement('p');
    message.textContent = error.message;
    routePage.append(message, createRouteLink('Înapoi la produse', '/products', 'secondary-btn'));
  }
}

function renderRoute(location) {
  const requestId = ++routeRequestId;
  const currentPage = location.name === 'productDetails'
    ? 'products'
    : (location.name === 'notFound' ? '' : location.name);
  document.querySelectorAll('.main-nav a').forEach((link) => {
    const page = link.hash.slice(2) || 'home';
    if (page === currentPage) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  showMessage('');
  retryButton.hidden = true;

  if (location.name === 'products') {
    showProductsPage(location);
    return;
  }

  if (location.name === 'productDetails') {
    showProductDetails(location, requestId);
    return;
  }

  showRoutePage();
  if (location.name === 'home') {
    appendHeading(routePage, 'Bun venit la Tech Commerce');
    const intro = document.createElement('p');
    intro.textContent = 'Explorează produsele tech și gestionează catalogul magazinului.';
    routePage.append(intro, createRouteLink('Vezi produsele', '/products'));
    return;
  }

  if (location.name === 'about') {
    appendHeading(routePage, 'Despre Tech Commerce');
    const intro = document.createElement('p');
    intro.textContent = 'Miniaplicație de magazin tech. Catalogul este gestionat printr-un API REST local.';
    routePage.append(intro, createRouteLink('Vezi produsele', '/products'));
    return;
  }

  appendHeading(routePage, '404 — Pagina nu a fost găsită');
  const message = document.createElement('p');
  message.textContent = `Ruta „${location.path}” nu există.`;
  routePage.append(message, createRouteLink('Înapoi la pagina principală', '/'));
}

form.addEventListener('submit', handleSubmit);
searchInput.addEventListener('input', setProductsQuery);
categoryFilter.addEventListener('change', setProductsQuery);
sortSelect.addEventListener('change', setProductsQuery);
resetFormBtn.addEventListener('click', resetForm);
tableBody.addEventListener('click', handleTableClick);
retryButton.addEventListener('click', loadProducts);

resetForm();
window.appRouter.subscribe(renderRoute);
loadProducts();
