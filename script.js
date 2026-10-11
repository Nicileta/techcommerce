const statuses = ['available', 'out_of_stock', 'inactive'];
const form = document.getElementById('productForm');
const formTitle = document.getElementById('formTitle');
const searchInput = document.getElementById('searchInput');
const tableBody = document.getElementById('productTableBody');
const resetFormBtn = document.getElementById('resetFormBtn');
const appMessage = document.getElementById('appMessage');
const retryButton = document.getElementById('retryButton');
const submitButton = form.querySelector('button[type="submit"]');

let products = [];
let editingId = null;

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
  const searchTerm = searchInput.value.trim().toLocaleLowerCase();
  const filteredProducts = products.filter((product) =>
    product.name.toLocaleLowerCase().includes(searchTerm)
    || product.category.toLocaleLowerCase().includes(searchTerm)
  );

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
      createActionButton('Edit', 'edit', product.id, 'edit-btn'),
      createActionButton('Delete', 'delete', product.id, 'delete-btn')
    );
    actionsCell.append(actions);
    row.append(actionsCell);
    tableBody.append(row);
  });
}

async function loadProducts() {
  retryButton.hidden = true;
  showMessage('Se încarcă produsele din API...');

  try {
    const data = await window.productApi.getAll();
    if (!Array.isArray(data)) {
      throw new Error('Răspunsul API pentru lista de produse nu are formatul așteptat.');
    }
    products = data;
    renderProducts();
    showMessage('');
  } catch (error) {
    console.error('Eroare la încărcarea produselor:', error);
    showMessage(error.message, 'error');
    retryButton.hidden = false;
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

form.addEventListener('submit', handleSubmit);
searchInput.addEventListener('input', renderProducts);
resetFormBtn.addEventListener('click', resetForm);
tableBody.addEventListener('click', handleTableClick);
retryButton.addEventListener('click', loadProducts);

resetForm();
loadProducts();
