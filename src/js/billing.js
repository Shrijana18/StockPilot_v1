// src/js/billing.js
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

export const initBillingPage = async (db, auth, currentUser) => {
  console.log("🧾 Billing module starting with:", { db, auth, currentUser });

  const productSelect = document.querySelector('#productSearch');
  const addToCartBtn = document.getElementById('addToCartBtn');
  const cartTableBody = document.getElementById('cartItems');
  const generateInvoiceBtn = document.getElementById('generateInvoiceBtn');
  // Safe fallback logic for createBillBtn to trigger generateInvoiceBtn
  const createBillBtn = document.getElementById('createBillBtn');
  if (createBillBtn) {
    createBillBtn.addEventListener('click', () => {
      if (generateInvoiceBtn) generateInvoiceBtn.click();
    });
  }

  // Insert toggle preview logic here
  const togglePreviewBtn = document.getElementById('toggleInvoicePreviewBtn');
  const invoicePreviewSection = document.getElementById('invoicePreview');

  if (togglePreviewBtn && invoicePreviewSection) {
    togglePreviewBtn.addEventListener('click', () => {
      invoicePreviewSection.classList.toggle('hidden');
      if (!invoicePreviewSection.classList.contains('hidden')) {
        invoicePreviewSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  if (!productSelect || !addToCartBtn || !cartTableBody || !generateInvoiceBtn) {
    console.error("Missing billing DOM elements.");
    return;
  }

  let tomSelect;
  let cart = [];
  // --- Shared product options for TomSelect instances ---
  let productOptions = [];
  let previewSelectInstance;

  const userId = currentUser?.uid;
  if (!userId || !db) {
    console.error("❌ Missing Firestore DB or User ID");
    return;
  }

  // Auto-load existing customer data on blur of phone/email input
  document.getElementById('customerPhone')?.addEventListener('blur', loadCustomerIfExists);
  document.getElementById('customerEmail')?.addEventListener('blur', loadCustomerIfExists);

  async function loadCustomerIfExists() {
    const phone = document.getElementById('customerPhone')?.value.trim();
    const email = document.getElementById('customerEmail')?.value.trim();
    const customerId = phone || email;
    if (!customerId || !db || !userId) return;

    const docRef = doc(db, 'businesses', userId, 'customers', customerId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      document.getElementById('customerName').value = data.name || '';
      document.getElementById('customerPhone').value = data.phone || '';
      document.getElementById('customerEmail').value = data.email || '';
      const addrEl = document.getElementById('customerAddress');
      if (addrEl) addrEl.value = data.address || '';
    }
  }

  // ✅ Set up TomSelect after short delay
  setTimeout(async () => {
    tomSelect = new TomSelect(productSelect, {
      valueField: 'id',
      labelField: 'label',
      searchField: 'search',
      options: [],
      create: false,
      placeholder: 'Search by name or SKU...',
      render: {
        option: function(data, escape) {
          return `
            <div class="flex items-center gap-2">
              <img src="${escape(data.image || '')}" class="w-8 h-8 object-cover rounded" />
              <div>
                <div class="font-semibold">${escape(data.label)}</div>
                <div class="text-xs text-gray-500">${escape(data.details || '')}</div>
              </div>
            </div>`;
        },
        item: function(data, escape) {
          return `<div>${escape(data.label)}</div>`;
        }
      }
    });

    const productsRef = collection(db, 'businesses', userId, 'products');
    const snapshot = await getDocs(productsRef);

    productOptions = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const label = `${data.name || 'No Name'} (${data.sku || ''})`;
      productOptions.push({
        id: docSnap.id,
        label,
        search: `${data.name} ${data.sku}`.toLowerCase(),
        image: Array.isArray(data.image) ? data.image[0] : '',
        details: `${data.brand || ''} - ${data.category || ''}`
      });
    });

    tomSelect.addOptions(productOptions);
    tomSelect.refreshOptions(false);
    // If previewSelectInstance is initialized, add options to it as well
    if (previewSelectInstance) {
      previewSelectInstance.addOptions(productOptions);
      previewSelectInstance.refreshOptions(false);
    }
  }, 150);

  addToCartBtn.addEventListener('click', async () => {
    const selectedId = tomSelect.getValue();
    if (!selectedId) return;

    const docRef = doc(db, 'businesses', userId, 'products', selectedId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const product = docSnap.data();
    const existing = cart.find(p => p.id === selectedId);

    if (existing) existing.quantity += 1;
    else cart.push({
      id: selectedId,
      name: product.name,
      price: product.price || 0,
      quantity: 1,
      sku: product.sku || '',
      image: Array.isArray(product.image) ? product.image[0] : ''
    });

    renderCart();
  });

  // --- Utility: renderPreview ---
  function renderPreview() {
    // get all current values
    const customerName = document.getElementById('customerName')?.value.trim() || '';
    const customerPhone = document.getElementById('customerPhone')?.value.trim() || '';
    const customerEmail = document.getElementById('customerEmail')?.value.trim() || '';
    const includeGST = document.getElementById('toggleGST')?.checked;
    const cgstRate = parseFloat(document.getElementById('cgstRate')?.value) || 0;
    const sgstRate = parseFloat(document.getElementById('sgstRate')?.value) || 0;
    const igstRate = parseFloat(document.getElementById('igstRate')?.value) || 0;
    const invoiceType = document.getElementById('invoiceType')?.value || 'retail';
    const includeCustomerDetails = document.getElementById('toggleCustomerDetails')?.checked;
    const customerInfo = includeCustomerDetails
      ? { customerName, customerPhone, customerEmail }
      : { customerName: '', customerPhone: '', customerEmail: '' };

    document.getElementById('previewBusinessName').textContent = "BusinessPilot User";
    document.getElementById('previewBusinessAddress').textContent = "123 Business Street, India";
    document.getElementById('previewCustomerName').textContent = customerInfo.customerName;
    document.getElementById('previewCustomerPhone').textContent = customerInfo.customerPhone;
    document.getElementById('previewCustomerEmail').textContent = customerInfo.customerEmail;
    document.getElementById('previewInvoiceType').textContent = invoiceType;
    document.getElementById('previewInvoiceDate').textContent = new Date().toLocaleDateString();

    const previewProductTable = document.getElementById('previewProductTable');
    previewProductTable.innerHTML = '';
    cart.forEach(item => {
      const tr = document.createElement('tr');
      const total = calculateSubtotal(item);
      tr.innerHTML = `
        <td class="border px-2 py-1">${item.name}</td>
        <td class="border px-2 py-1">${item.quantity}</td>
        <td class="border px-2 py-1">₹${item.price}</td>
        <td class="border px-2 py-1">${item.discount || 0}%</td>
        <td class="border px-2 py-1">₹${total.toFixed(2)}</td>
      `;
      previewProductTable.appendChild(tr);
    });
    // --- Editable cart rendering in preview section ---
    const previewCartTable = document.getElementById('editCartItems');
    if (previewCartTable) {
      previewCartTable.innerHTML = '';
      cart.forEach(item => {
        const tr = document.createElement('tr');
        const total = calculateSubtotal(item);
        tr.innerHTML = `
          <td class="border px-2 py-1">${item.name}</td>
          <td class="border px-2 py-1"><input type="number" min="1" value="${item.quantity}" class="edit-cart-qty w-16 border p-1" data-id="${item.id}" /></td>
          <td class="border px-2 py-1"><input type="number" min="0" value="${item.price}" class="edit-cart-price w-20 border p-1" data-id="${item.id}" /></td>
          <td class="border px-2 py-1"><input type="number" min="0" max="100" value="${item.discount || 0}" class="edit-cart-discount w-16 border p-1" data-id="${item.id}" /></td>
          <td class="border px-2 py-1 subtotal" data-id="${item.id}">₹${total.toFixed(2)}</td>
        `;
        previewCartTable.appendChild(tr);
      });
      previewCartTable.querySelectorAll('.edit-cart-qty, .edit-cart-price, .edit-cart-discount').forEach(input => {
        input.addEventListener('input', () => {
          const id = input.getAttribute('data-id');
          const updatedItem = cart.find(i => i.id === id);
          if (!updatedItem) return;
          const qtyInput = previewCartTable.querySelector(`.edit-cart-qty[data-id="${id}"]`);
          const priceInput = previewCartTable.querySelector(`.edit-cart-price[data-id="${id}"]`);
          const discountInput = previewCartTable.querySelector(`.edit-cart-discount[data-id="${id}"]`);
          updatedItem.quantity = parseInt(qtyInput.value) || 1;
          updatedItem.price = parseFloat(priceInput.value) || 0;
          updatedItem.discount = parseFloat(discountInput.value) || 0;
          const subtotalEl = previewCartTable.querySelector(`.subtotal[data-id="${id}"]`);
          if (subtotalEl) {
            subtotalEl.textContent = `₹${calculateSubtotal(updatedItem).toFixed(2)}`;
          }
          const newSubtotal = cart.reduce((s, i) => s + calculateSubtotal(i), 0);
          document.getElementById('previewSubtotal').textContent = newSubtotal.toFixed(2);
          document.getElementById('previewGrandTotal').textContent = newSubtotal.toFixed(2);
        });
      });
    }
    // --- End editable cart rendering ---
    const subtotal = cart.reduce((sum, i) => sum + calculateSubtotal(i), 0);
    document.getElementById('previewSubtotal').textContent = subtotal.toFixed(2);
    let cgst = 0, sgst = 0, igst = 0;
    if (includeGST) {
      cgst = subtotal * (cgstRate / 100);
      sgst = subtotal * (sgstRate / 100);
      igst = subtotal * (igstRate / 100);
      document.getElementById('previewGSTBreakdown').style.display = '';
      document.getElementById('previewCGSTAmount').textContent = cgst.toFixed(2);
      document.getElementById('previewSGSTAmount').textContent = sgst.toFixed(2);
      document.getElementById('previewIGSTAmount').textContent = igst.toFixed(2);
    } else {
      document.getElementById('previewGSTBreakdown').style.display = 'none';
    }
    const grandTotal = subtotal + cgst + sgst + igst;
    document.getElementById('previewGrandTotal').textContent = grandTotal.toFixed(2);
    function numberToWords(n) {
      const a = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                 "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                 "Seventeen", "Eighteen", "Nineteen"];
      const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? "-" + a[n % 10] : "");
      if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
      return n.toFixed(2);
    }
    document.getElementById('previewAmountWords').textContent = numberToWords(Math.floor(grandTotal)) + " Rupees Only";
    // Ensure the preview section is shown
    const previewSection = document.getElementById('invoicePreview');
    if (previewSection) {
      previewSection.classList.remove('hidden');
      previewSection.style.display = 'block';
    }
    // Remove previous cancel button if exists
    const existingCancelBtn = document.getElementById('cancelBillBtn');
    if (existingCancelBtn) {
      existingCancelBtn.remove();
    }
    // Add Cancel Bill button to preview section
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel Bill';
    cancelBtn.className = 'ml-4 px-4 py-2 bg-red-600 text-white rounded';
    cancelBtn.id = 'cancelBillBtn';
    cancelBtn.onclick = () => {
      cart = [];
      renderCart();
      previewSection.classList.add('hidden');
      document.getElementById('customerName').value = '';
      document.getElementById('customerPhone').value = '';
      document.getElementById('customerEmail').value = '';
    };
    previewSection.appendChild(cancelBtn);
    // Make preview fields editable
    ['previewCustomerName', 'previewCustomerPhone', 'previewCustomerEmail', 'previewBusinessName', 'previewBusinessAddress'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.contentEditable = true;
        el.classList.add('border', 'border-dashed', 'px-1');
        el.title = 'Click to edit';
      }
    });
  }

  generateInvoiceBtn.addEventListener('click', async () => {
    const customerName = document.getElementById('customerName')?.value.trim() || '';
    // Only require customerName and cart check here for validation
    if (!customerName || cart.length === 0) return alert("Fill all fields");

    const customerPhone = document.getElementById('customerPhone')?.value.trim() || '';
    const customerEmail = document.getElementById('customerEmail')?.value.trim() || '';
    const includeGST = document.getElementById('toggleGST')?.checked;
    const cgstRate = parseFloat(document.getElementById('cgstRate')?.value) || 0;
    const sgstRate = parseFloat(document.getElementById('sgstRate')?.value) || 0;
    const igstRate = parseFloat(document.getElementById('igstRate')?.value) || 0;
    const invoiceType = document.getElementById('invoiceType')?.value || 'retail';
    const includeCustomerDetails = document.getElementById('toggleCustomerDetails')?.checked;
    // --- End customer save logic ---
    const customerInfo = includeCustomerDetails
      ? { customerName, customerPhone, customerEmail }
      : { customerName: '', customerPhone: '', customerEmail: '' };
    const invoice = {
      ...customerInfo,
      items: cart.map(item => ({ ...item })),
      createdAt: new Date().toISOString(),
      total: cart.reduce((sum, i) => sum + calculateSubtotal(i), 0),
      invoiceType,
      includeGST,
      gstRates: {
        cgst: includeGST ? cgstRate : 0,
        sgst: includeGST ? sgstRate : 0,
        igst: includeGST ? igstRate : 0
      }
    };
    // 🧾 Populate invoice preview panel
    renderPreview();
    // Show toast to guide user to next step
    const toast = document.getElementById('invoiceSuccessToast');
    if (toast) {
      toast.textContent = "✅ Invoice preview ready. Confirm payment to save.";
      toast.classList.remove('hidden');
      toast.scrollIntoView({ behavior: 'smooth' });
    }
    // Finalize invoice logic
    const finalizeBtn = document.getElementById('finalizeInvoiceBtn');
    if (finalizeBtn) {
      finalizeBtn.onclick = async () => {
        const finalizedInvoice = {
          ...invoice,
          customerName: document.getElementById('previewCustomerName').textContent.trim(),
          customerPhone: document.getElementById('previewCustomerPhone').textContent.trim(),
          customerEmail: document.getElementById('previewCustomerEmail').textContent.trim(),
          businessName: document.getElementById('previewBusinessName').textContent.trim(),
          businessAddress: document.getElementById('previewBusinessAddress').textContent.trim()
        };
        // --- Save customer data to Firestore under a unique ID ---
        const customerId = finalizedInvoice.customerPhone || finalizedInvoice.customerEmail || finalizedInvoice.customerName.replace(/\s+/g, '_').toLowerCase();
        if (customerId) {
          const customerDocRef = doc(db, 'businesses', userId, 'customers', customerId);
          const customerSnapshot = await getDoc(customerDocRef);
          if (!customerSnapshot.exists()) {
            await setDoc(customerDocRef, {
              name: finalizedInvoice.customerName,
              phone: finalizedInvoice.customerPhone,
              email: finalizedInvoice.customerEmail,
              address: document.getElementById('customerAddress')?.value.trim() || '',
              createdAt: new Date().toISOString()
            });
          }
        }
        // --- End customer save logic ---
        await addDoc(collection(db, 'businesses', userId, 'finalizedInvoices'), finalizedInvoice);
        // Show success toast and Create New Bill
        const toast = document.getElementById('invoiceSuccessToast');
        if (toast) {
          toast.textContent = "✅ Invoice saved successfully!";
          toast.classList.remove('hidden');
          toast.innerHTML += `<br><button id="createNewBillBtn" class="mt-2 px-4 py-2 bg-white text-green-600 border border-green-600 rounded">🧾 Create New Bill</button>`;
          document.getElementById('createNewBillBtn')?.addEventListener('click', () => location.reload());
        }
        alert('✅ Final invoice saved successfully!');
      };
    }
  });

  // --- Preview cart product search & add ---
  const previewProductSelect = document.querySelector('#previewProductSearch');
  const previewAddToCartBtn = document.getElementById('previewAddToCartBtn');

  if (previewProductSelect && previewAddToCartBtn) {
    // Use global previewSelectInstance variable
    previewSelectInstance = new TomSelect(previewProductSelect, {
      valueField: 'id',
      labelField: 'label',
      searchField: 'search',
      options: productOptions,
      create: false,
      render: tomSelect ? tomSelect.render : undefined
    });
    // If productOptions loaded after initialization, add them
    if (productOptions && productOptions.length > 0) {
      previewSelectInstance.addOptions(productOptions);
      previewSelectInstance.refreshOptions(false);
    }
    previewAddToCartBtn.addEventListener('click', async () => {
      const selectedId = previewSelectInstance.getValue();
      if (!selectedId) return;
      const docRef = doc(db, 'businesses', userId, 'products', selectedId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      const product = docSnap.data();
      const existing = cart.find(p => p.id === selectedId);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({
          id: selectedId,
          name: product.name,
          price: product.price || 0,
          quantity: 1,
          sku: product.sku || '',
          image: Array.isArray(product.image) ? product.image[0] : '',
          discount: 0
        });
      }
      renderCart();
      renderPreview();
    });
  }

  function calculateSubtotal(item) {
    const discount = (item.price * item.quantity) * ((item.discount || 0) / 100);
    return (item.price * item.quantity) - discount;
  }

  function renderCart() {
    cartTableBody.innerHTML = '';
    cart.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.name}</td>
        <td><input type="number" min="1" value="${item.quantity}" class="qty-input w-16 p-1 border rounded" data-id="${item.id}" /></td>
        <td><input type="number" min="0" value="${item.price}" class="price-input w-20 p-1 border rounded" data-id="${item.id}" /></td>
        <td><input type="number" min="0" max="100" value="${item.discount || 0}" class="discount-input w-16 p-1 border rounded" data-id="${item.id}" /></td>
        <td class="subtotal" data-id="${item.id}">₹${calculateSubtotal(item).toFixed(2)}</td>
        <td><button data-id="${item.id}" class="text-red-600 remove-item">🗑️</button></td>
      `;
      cartTableBody.appendChild(row);
    });

    cartTableBody.querySelectorAll('.qty-input, .price-input, .discount-input').forEach(input => {
      input.addEventListener('input', () => {
        const id = input.getAttribute('data-id');
        const updatedItem = cart.find(i => i.id === id);
        if (!updatedItem) return;

        const qtyInput = cartTableBody.querySelector(`.qty-input[data-id="${id}"]`);
        const priceInput = cartTableBody.querySelector(`.price-input[data-id="${id}"]`);
        const discountInput = cartTableBody.querySelector(`.discount-input[data-id="${id}"]`);

        updatedItem.quantity = parseInt(qtyInput.value) || 1;
        updatedItem.price = parseFloat(priceInput.value) || 0;
        updatedItem.discount = parseFloat(discountInput.value) || 0;

        const subtotalEl = cartTableBody.querySelector(`.subtotal[data-id="${id}"]`);
        if (subtotalEl) {
          subtotalEl.textContent = `₹${calculateSubtotal(updatedItem).toFixed(2)}`;
        }

        document.getElementById('billingSubtotal').textContent = `₹${cart.reduce((s, i) => s + calculateSubtotal(i), 0).toFixed(2)}`;
        document.getElementById('billingGrandTotal').textContent = `₹${cart.reduce((s, i) => s + calculateSubtotal(i), 0).toFixed(2)}`;
      });
    });

    document.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        cart = cart.filter(p => p.id !== id);
        renderCart();
      });
    });

    document.getElementById('billingSubtotal').textContent = `₹${cart.reduce((s, i) => s + calculateSubtotal(i), 0).toFixed(2)}`;
    document.getElementById('billingGrandTotal').textContent = `₹${cart.reduce((s, i) => s + calculateSubtotal(i), 0).toFixed(2)}`;
  }

  const gstToggle = document.getElementById('toggleGST');
  const gstRateInputs = document.getElementById('gstRateInputs');
  if (gstToggle && gstRateInputs) {
    gstToggle.addEventListener('change', () => {
      gstRateInputs.classList.toggle('hidden', !gstToggle.checked);
    });
  }

  // --- Tab switching logic with invoice reload ---
  const tabButtons = document.querySelectorAll('[data-billing-tab]');
  const tabContents = document.querySelectorAll('[data-billing-tab-content]');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.getAttribute('data-billing-tab');
      // Highlight only clicked tab, remove from others
      tabButtons.forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'shadow', 'ring', 'ring-offset-2', 'ring-blue-400');
        b.classList.add('bg-white', 'text-blue-600');
      });
      btn.classList.remove('bg-white', 'text-blue-600');
      btn.classList.add('bg-blue-600', 'text-white', 'shadow');
      btn.classList.add('ring', 'ring-offset-2', 'ring-blue-400');

      tabContents.forEach(content => {
        if (content.getAttribute('data-billing-tab-content') === target) {
          content.classList.remove('hidden');
        } else {
          content.classList.add('hidden');
        }
      });

      // If All Invoices tab selected, load latest data as cards
      if (target === 'all-invoices-tab') {
        const cardContainer = document.getElementById('invoiceCardContainer');
        if (cardContainer) {
          // --- Filter bar ---
          let filterBar = document.getElementById('invoiceFilterBar');
          if (!filterBar) {
            filterBar = document.createElement('div');
            filterBar.id = 'invoiceFilterBar';
            filterBar.className = 'flex flex-wrap items-center gap-2 mb-4';
            filterBar.innerHTML = `
              <input type="text" id="invoiceSearchInput" placeholder="Search by name or phone..." class="border rounded px-2 py-1 w-48" />
              <input type="date" id="invoiceDateInput" class="border rounded px-2 py-1" />
              <button id="invoiceFilterBtn" class="px-3 py-1 bg-blue-500 text-white rounded">Filter</button>
              <button id="invoiceClearFilterBtn" class="px-3 py-1 bg-gray-200 text-gray-700 rounded">Clear</button>
            `;
            cardContainer.parentNode.insertBefore(filterBar, cardContainer);
          }
          cardContainer.innerHTML = '';
          const snapshot = await getDocs(collection(db, 'businesses', userId, 'finalizedInvoices'));
          let invoices = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            invoices.push(data);
          });

          // Filtering logic
          function renderFilteredCards() {
            cardContainer.innerHTML = '';
            let filtered = invoices;
            const searchVal = document.getElementById('invoiceSearchInput')?.value.trim().toLowerCase() || '';
            const dateVal = document.getElementById('invoiceDateInput')?.value;
            if (searchVal) {
              filtered = filtered.filter(inv =>
                (inv.customerName || '').toLowerCase().includes(searchVal) ||
                (inv.customerPhone || '').toLowerCase().includes(searchVal) ||
                (inv.customerEmail || '').toLowerCase().includes(searchVal)
              );
            }
            if (dateVal) {
              filtered = filtered.filter(inv => {
                const d = new Date(inv.createdAt);
                // YYYY-MM-DD compare
                const iso = d.toISOString().slice(0, 10);
                return iso === dateVal;
              });
            }
            if (filtered.length === 0) {
              cardContainer.innerHTML = '<p class="text-center py-6 text-gray-500">No invoices found.</p>';
              return;
            }
            filtered.forEach(data => {
              const card = document.createElement('div');
              card.className = 'mb-6';
              card.innerHTML = `
                <div class="bg-gray-50 p-4 rounded-lg shadow-md">
                  <div class="flex justify-between mb-2">
                    <div>
                      <h2 class="font-semibold text-lg">${data.customerName || 'Unnamed'}</h2>
                      <p class="text-sm text-gray-500">${data.customerPhone || ''}</p>
                      <p class="text-sm text-gray-500">${data.customerEmail || ''}</p>
                    </div>
                    <div class="text-right text-sm">
                      <p class="font-medium text-green-700">₹${(data.total || 0).toFixed(2)}</p>
                      <p class="text-gray-400">${new Date(data.createdAt).toLocaleString()}</p>
                      <p class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${data.invoiceType || 'N/A'}</p>
                    </div>
                  </div>
                  <hr class="my-2" />
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-gray-600">
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(data.items || []).map(item => `
                        <tr>
                          <td>${item.name}</td>
                          <td>${item.quantity}</td>
                          <td>₹${item.price}</td>
                          <td>₹${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `;
              cardContainer.appendChild(card);
            });
          }
          // Initial render
          renderFilteredCards();
          // Event listeners for filter bar
          document.getElementById('invoiceFilterBtn').onclick = renderFilteredCards;
          document.getElementById('invoiceSearchInput').oninput = function(e) {
            if (!this.value) renderFilteredCards();
          };
          document.getElementById('invoiceDateInput').onchange = renderFilteredCards;
          document.getElementById('invoiceClearFilterBtn').onclick = function() {
            document.getElementById('invoiceSearchInput').value = '';
            document.getElementById('invoiceDateInput').value = '';
            renderFilteredCards();
          };
        }
      }
    });
  });
};

// Enable inline editing from HTML's onclick if needed
window.editPreviewField = function (spanId) {
  const span = document.getElementById(spanId);
  const currentValue = span.innerText;
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentValue;
  input.className = "border p-1 text-black rounded";
  input.onblur = () => {
    span.innerText = input.value;
    span.style.display = "inline";
    input.remove();
  };
  span.style.display = "none";
  span.parentNode.insertBefore(input, span);
  input.focus();
  // Add logic to reset form and UI when "Create New Bill" is clicked
  const createNewBillBtn = document.getElementById('createNewBillBtn');
  if (createNewBillBtn) {
    createNewBillBtn.addEventListener('click', () => {
      location.reload(); // Reloads to clear form, cart, and UI
    });
  }
};