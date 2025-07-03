import { doc, addDoc, collection, onSnapshot, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { fetchAndInjectHTML, closeModal } from '../utils.js';

// Helper: Success toast
const showSuccessToast = (message) => {
  const toast = document.createElement('div');
  toast.className = "fixed top-5 right-5 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500 opacity-0";
  toast.innerHTML = `<strong>✅</strong> ${message}`;

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('opacity-100'), 100); // fade in

  setTimeout(() => {
    toast.classList.remove('opacity-100'); // fade out
    setTimeout(() => toast.remove(), 500);
  }, 3000);
};

// --- State ---
let db = null;
let currentUser = null;

// --- Functions ---
const handleAddProduct = async (e) => {
    e.preventDefault();
    const form = e.target;
    console.log("📤 Submitting product form");
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
    const errorElement = form.querySelector('#add-product-form-error');
    if (errorElement) errorElement.textContent = '';

    const productName = form.querySelector('#product-name').value;
    const productSku = form.querySelector('#product-sku').value;
    const productQuantity = form.querySelector('#quantity')?.value;
    const productUnit = form.querySelector('#product-unit').value;
    const productPrice = form.querySelector('#selling-price')?.value;
    const productImageFiles = Array.from(form.querySelector('#product-image').files).slice(0, 3);
    const productDescription = form.querySelector('#description')?.value;
    const productBrand = form.querySelector('#brand-name').value;
    console.log("📦 Product Data Captured:", {
      productName,
      productSku,
      productQuantity,
      productUnit,
      productPrice,
      productImageFiles,
      productDescription,
      productBrand,
      productCategory: form.querySelector('#category').value,
      costPrice: form.querySelector('#cost-price')?.value
    });
    const productCategory = form.querySelector('#category').value;
    const costPrice = form.querySelector('#cost-price')?.value;

    if (!productName || !productSku || isNaN(Number(productQuantity)) || isNaN(Number(productPrice)) || isNaN(Number(costPrice))) {
        if (errorElement) errorElement.textContent = 'Please fill in all required fields correctly.';
        submitButton.disabled = false;
        submitButton.textContent = "Save";
        return;
    }

    try {
        // Null-check for user and db
        if (!currentUser || !db) {
            console.error("User or Firestore DB not initialized.");
            if (errorElement) errorElement.textContent = 'User not logged in or database error.';
            submitButton.disabled = false;
            submitButton.textContent = "Save";
            return;
        }
        let imageURLs = [];
        if (productImageFiles.length > 0) {
            const storage = getStorage();
            for (const file of productImageFiles) {
                const imageRef = ref(storage, `users/${currentUser.uid}/products/${productSku}_${Date.now()}_${file.name}`);
                try {
                    const snapshot = await uploadBytes(imageRef, file);
                    const url = await getDownloadURL(snapshot.ref);
                    imageURLs.push(url);
                } catch (uploadError) {
                    console.error("⚠️ Image upload failed:", uploadError);
                    if (errorElement) errorElement.textContent = 'One or more images failed to upload.';
                    submitButton.disabled = false;
                    submitButton.textContent = "Save";
                    return;
                }
            }
        }
        // Create a new document in the "products" sub-collection for the current user's business
        const userProductsCollection = collection(db, `businesses/${currentUser.uid}/products`);
        console.log("📁 Ready to save to Firestore at:", `businesses/${currentUser.uid}/products`);
        const productData = {
            name: productName,
            sku: productSku,
            quantity: Number(productQuantity),
            unit: productUnit,
            price: Number(productPrice),
            image: imageURLs,
            description: productDescription,
            brand: productBrand,
            category: productCategory,
            cost: Number(costPrice),
            createdAt: serverTimestamp()
        };
        console.log("🚀 Sending product data to Firestore:", productData);
        await addDoc(userProductsCollection, productData);
        console.log("✅ Firestore write completed");
        showSuccessToast(`Product "${productName}" added successfully!`);
        form.reset(); // Clear form fields
        submitButton.disabled = false;
        submitButton.textContent = "Save";
        closeModal();
        console.log("Saved to Firestore:", productData);
    } catch (error) {
        console.error("Error adding document: ", error);
        console.log("❌ Firestore save failed with error:", error.message);
        if (errorElement) errorElement.textContent = 'Failed to save product.';
        submitButton.disabled = false;
        submitButton.textContent = "Save";
    }
};

const renderInventoryList = (products) => {
  const inventoryListElement = document.getElementById('inventory-list');
  if (!inventoryListElement) return;

  // --- Filtering and Sorting Logic ---
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const searchTerm = searchInput?.value.toLowerCase() || '';
  const sortValue = sortSelect?.value || '';

  let filteredProducts = [...products];

  // --- Filter by status chip ---
  const activeChip = document.querySelector('.chip.active');
  const statusFilter = activeChip ? activeChip.dataset.status : null;

  if (statusFilter === 'in-stock') {
    filteredProducts = filteredProducts.filter(p => p.quantity > 0);
  } else if (statusFilter === 'low') {
    filteredProducts = filteredProducts.filter(p => p.quantity === 0);
  } else if (statusFilter === 'out-of-stock') {
    filteredProducts = filteredProducts.filter(p => p.quantity === 0); // Or whatever rule applies
  }

  // --- Filter by search term ---
  filteredProducts = filteredProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm) ||
    p.sku.toLowerCase().includes(searchTerm) ||
    p.brand.toLowerCase().includes(searchTerm)
  );

  // --- Sort ---
  if (sortValue === 'name-asc') filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
  if (sortValue === 'name-desc') filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
  if (sortValue === 'qty-asc') filteredProducts.sort((a, b) => a.quantity - b.quantity);
  if (sortValue === 'qty-desc') filteredProducts.sort((a, b) => b.quantity - a.quantity);
  if (sortValue === 'price-asc') filteredProducts.sort((a, b) => a.price - b.price);
  if (sortValue === 'price-desc') filteredProducts.sort((a, b) => b.price - a.price);

  if (filteredProducts.length === 0) {
    inventoryListElement.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-gray-500">You haven't added any products yet. Click "Add Inventory" to get started.</td></tr>`;
    return;
  }

  inventoryListElement.innerHTML = filteredProducts.map(product => {
    const statusBadge = product.quantity > 0
      ? '<span class="text-sm px-2 py-1 rounded-full bg-green-600 text-white">🟢 In Stock</span>'
      : '<span class="text-sm px-2 py-1 rounded-full bg-red-600 text-white">🔴 Low</span>';

    const imageUrl = Array.isArray(product.image) ? product.image[0] : product.image;
    const imageTag = imageUrl
      ? `<img src="${imageUrl}" alt="${product.name}" class="w-12 h-12 object-cover rounded" />`
      : `<div class="w-12 h-12 bg-gray-700 text-white flex items-center justify-center rounded">📦</div>`;

    return `
      <tr class="border-b border-white/10 hover:bg-white/5">
        <td class="p-4">${imageTag}</td>
        <td class="p-4 font-medium">${product.name}</td>
        <td class="p-4 text-gray-400">${product.sku}</td>
        <td class="p-4 text-gray-400">${product.brand}</td>
        <td class="p-4 text-gray-400">${product.category}</td>
        <td class="p-4 text-gray-400">${product.quantity}</td>
        <td class="p-4 text-gray-400">${product.unit}</td>
        <td class="p-4 text-gray-400">₹${product.cost}</td>
        <td class="p-4 text-gray-400">₹${product.price}</td>
        <td class="p-4 text-center whitespace-nowrap w-32">${statusBadge}</td>
      </tr>
    `;
  }).join('');
};

const listenForInventoryUpdates = (targetContainer = document.getElementById('inventory-list')) => {
  if (!currentUser || !targetContainer) return;
  console.log("🔄 Listening for inventory updates...");

  const q = query(collection(db, `businesses/${currentUser.uid}/products`));
  onSnapshot(q, (querySnapshot) => {
    const products = [];
    querySnapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });
    products.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() ? a.createdAt.toDate() : 0;
      const bTime = b.createdAt?.toDate?.() ? b.createdAt.toDate() : 0;
      return bTime - aTime;
    });
    renderInventoryList(products);
    // --- Bind search and sort listeners for live filtering/sorting ---
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    if (searchInput) searchInput.addEventListener('input', () => renderInventoryList(products));
    if (sortSelect) sortSelect.addEventListener('change', () => renderInventoryList(products));
    // --- Bind status filter chip listeners ---
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderInventoryList(products);
      });
    });
  });
};

const bindInventoryOptionButtons = () => {
  document.getElementById('close-add-inventory-options-modal-btn')?.addEventListener('click', closeModal);

  document.getElementById('open-manual-entry-form')?.addEventListener('click', () => {
    const tabContent = document.getElementById('inventory-tab-content');
    if (!tabContent) return;

    fetch('./src/modals/manual-entry-form.html')
      .then(res => res.text())
      .then(html => {
        tabContent.innerHTML = html;

        const backButton = document.createElement('button');
        backButton.textContent = '← Back to Inventory';
        backButton.className = 'mb-4 bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700';
        backButton.addEventListener('click', () => {
          fetchAndInjectHTML('./src/modals/add-inventory-options-modal.html', tabContent).then(() => {
            bindInventoryOptionButtons();
          });
        });
        tabContent.prepend(backButton);

        document.getElementById('manual-entry-form')?.addEventListener('submit', handleAddProduct);
        console.log("🧩 handleAddProduct bound to #manual-entry-form");

        const imageInput = document.getElementById('product-image');
        const preview = document.getElementById('image-preview');

        imageInput?.addEventListener('change', (e) => {
          const preview = document.getElementById('image-preview');
          preview.innerHTML = ''; // clear previous previews
          const files = Array.from(e.target.files);
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
          const maxSize = 5 * 1024 * 1024; // 5MB

          let validFiles = [];

          files.forEach((file, index) => {
            if (!allowedTypes.includes(file.type)) {
              alert(`${file.name} is not a valid image. Only JPG, PNG, and WEBP allowed.`);
              return;
            }

            if (file.size > maxSize) {
              alert(`${file.name} exceeds 5MB limit.`);
              return;
            }

            validFiles.push(file);

            const reader = new FileReader();
            reader.onload = function (event) {
              const wrapper = document.createElement('div');
              wrapper.className = 'relative inline-block m-1';
              wrapper.innerHTML = `
                <img src="${event.target.result}" alt="Preview" class="w-16 h-16 object-cover rounded border border-gray-300" />
                <button data-index="${index}" class="absolute top-0 right-0 bg-red-600 text-white text-xs px-1 rounded remove-preview">&times;</button>
              `;
              preview.appendChild(wrapper);
            };
            reader.readAsDataURL(file);
          });

          // Replace files with valid ones only
          const dataTransfer = new DataTransfer();
          validFiles.forEach(file => dataTransfer.items.add(file));
          imageInput.files = dataTransfer.files;

          // Attach remove event listener
          preview.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-preview')) {
              const indexToRemove = Number(e.target.dataset.index);
              const remainingFiles = Array.from(imageInput.files).filter((_, i) => i !== indexToRemove);
              const newDataTransfer = new DataTransfer();
              remainingFiles.forEach(file => newDataTransfer.items.add(file));
              imageInput.files = newDataTransfer.files;
              imageInput.dispatchEvent(new Event('change')); // re-render previews
            }
          });

          preview.classList.remove('hidden');
        });

        // --- Drag-and-drop and remove image enhancement ---
        const uploadArea = document.getElementById('image-upload-area');
        const removeBtn = document.getElementById('remove-image');

        uploadArea?.addEventListener('click', () => {
          imageInput.click(); // trigger file dialog on click anywhere in the upload area
        });

        uploadArea?.addEventListener('dragover', (e) => {
          e.preventDefault();
          uploadArea.classList.add('bg-gray-700');
        });

        uploadArea?.addEventListener('dragleave', (e) => {
          e.preventDefault();
          uploadArea.classList.remove('bg-gray-700');
        });

        uploadArea?.addEventListener('drop', (e) => {
          e.preventDefault();
          uploadArea.classList.remove('bg-gray-700');
          const file = e.dataTransfer.files[0];
          if (file) {
            imageInput.files = e.dataTransfer.files;
            imageInput.dispatchEvent(new Event('change')); // trigger preview logic
          }
        });

        removeBtn?.addEventListener('click', () => {
          imageInput.value = '';
          preview.src = '';
          preview.classList.add('hidden');
          removeBtn.classList.add('hidden');
        });
      });
  });

  document.getElementById('open-ocr-upload-form')?.addEventListener('click', () => {
    fetchAndInjectHTML('./src/modals/ocr-upload-form.html', document.getElementById('inventory-tab-content')).then(() => {
      setTimeout(() => {
        document.getElementById('close-ocr-upload-form-btn')?.addEventListener('click', closeModal);

        const fileInput = document.getElementById('ocr-image-file');
        const ocrUploadArea = document.getElementById('ocr-upload-area');
        const ocrPreview = document.getElementById('ocr-preview');
        const ocrForm = document.getElementById('ocr-inventory-form');
        const output = document.getElementById('ocr-preview-output');

        if (!fileInput || !ocrForm || !output) {
          console.error("❌ OCR DOM not ready");
          return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        ocrUploadArea?.addEventListener('click', () => {
          fileInput.click();
        });

        ocrUploadArea?.addEventListener('dragover', (e) => {
          e.preventDefault();
          ocrUploadArea.classList.add('bg-gray-700');
        });

        ocrUploadArea?.addEventListener('dragleave', (e) => {
          e.preventDefault();
          ocrUploadArea.classList.remove('bg-gray-700');
        });

        ocrUploadArea?.addEventListener('drop', (e) => {
          e.preventDefault();
          ocrUploadArea.classList.remove('bg-gray-700');
          const file = e.dataTransfer.files[0];
          if (file && allowedTypes.includes(file.type) && file.size <= maxSize) {
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
          } else {
            alert('Invalid file type or size exceeds 5MB.');
          }
        });

        fileInput?.addEventListener('change', (e) => {
          const file = e.target.files[0];
          const ocrPreview = document.getElementById('ocr-preview');
          if (!ocrPreview) {
            console.error("❌ Element with id 'ocr-preview' not found.");
            return;
          }
          ocrPreview.innerHTML = '';
          if (file && allowedTypes.includes(file.type) && file.size <= maxSize) {
            const reader = new FileReader();
            reader.onload = function (event) {
              const wrapper = document.createElement('div');
              wrapper.className = 'relative inline-block m-1';
              wrapper.innerHTML = `
                <img src="${event.target.result}" alt="Preview" class="w-24 h-24 object-cover rounded border border-gray-300" />
                <button id="remove-ocr-preview" class="absolute top-0 right-0 bg-red-600 text-white text-xs px-1 rounded">&times;</button>
              `;
              ocrPreview.appendChild(wrapper);
            };
            reader.readAsDataURL(file);
          }

          ocrPreview.addEventListener('click', (e) => {
            if (e.target.id === 'remove-ocr-preview') {
              fileInput.value = '';
              ocrPreview.innerHTML = '';
            }
          });
        });

        ocrForm?.addEventListener('submit', async (e) => {
          e.preventDefault();
          console.log("🧠 OCR Form Submitted. Starting scan...");
          const file = fileInput.files[0];
          if (!file) return;

          // Check if Tesseract is available globally
          if (!window.Tesseract) {
            output.innerHTML = "<div class='text-red-500'>❌ OCR Engine not found. Make sure Tesseract.js is loaded.</div>";
            return;
          }

          // Show loading spinner/message during OCR scan
          output.innerHTML = "<div class='text-yellow-300 flex items-center gap-2'><svg class='animate-spin h-5 w-5 text-yellow-300' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'><circle class='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' stroke-width='4'></circle><path class='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z'></path></svg>🕵️ Scanning image, please wait...</div>";

          try {
            // Use Tesseract.js directly (CDN v2+)
            const result = await Tesseract.recognize(file, 'eng');
            const text = result.data.text;
            console.log("📄 OCR Result:", text);
            output.innerHTML = `<pre class="bg-black p-2 rounded border border-gray-700 overflow-auto text-green-400">${text}</pre>`;

            const cleanedText = text
              .replace(/[“”"':*]/g, '')
              .replace(/\s{2,}/g, ' ')
              .trim();
            const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l);
            const parsedProducts = [];

            lines.forEach((line) => {
              const regex = /^(.+?)\s+(\d+)\s*(pcs|kg|ltr|box)?(?:\s*₹?\s*(\d+))?$/i;
              const match = line.match(regex);
              if (match) {
                const [, name, qty, unit, price] = match;
                parsedProducts.push({ name, quantity: qty, unit: unit || 'pcs', price });
              }
            });

            if (parsedProducts.length === 0) {
              output.innerHTML += `<div class="text-yellow-400 mt-2">⚠️ No structured items found from OCR. Please edit manually or retry.</div>`;
              return;
            }

            let tableHTML = `
              <table class="mt-4 w-full text-sm text-white border border-gray-700">
                <thead class="bg-gray-800 text-white">
                  <tr>
                    <th class="p-2">✔</th>
                    <th class="p-2">Product Name</th>
                    <th class="p-2">Qty</th>
                    <th class="p-2">Unit</th>
                    <th class="p-2">Price</th>
                    <th class="p-2"></th>
                  </tr>
                </thead>
                <tbody>
            `;

            parsedProducts.forEach((item, index) => {
              tableHTML += `
                <tr class="border-b border-gray-600">
                  <td class="text-center"><input type="checkbox" class="ocr-product-check" data-index="${index}" checked /></td>
                  <td><input type="text" class="ocr-name bg-transparent border p-1 w-full" value="${item.name}" /></td>
                  <td><input type="number" class="ocr-qty bg-transparent border p-1 w-full" value="${item.quantity}" /></td>
                  <td><input type="text" class="ocr-unit bg-transparent border p-1 w-full" value="${item.unit}" /></td>
                  <td><input type="number" class="ocr-price bg-transparent border p-1 w-full" value="${item.price}" /></td>
                  <td><button class="delete-row text-red-500 px-2">🗑️</button></td>
                </tr>
              `;
            });
            tableHTML += `</tbody></table>
              <button id="confirm-ocr-upload" class="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded">✅ Confirm & Upload</button>
            `;

            output.innerHTML += tableHTML;

            // Add "Add Another Product Row" button and row logic
            output.innerHTML += `
              <button id="add-product-row" class="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">➕ Add Another Product Row</button>
            `;

            // Add Delete Selected Rows and Download CSV buttons
            output.innerHTML += `
              <div class="flex gap-2 mt-3">
                <button id="delete-selected-rows" class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">🗑️ Delete Selected Rows</button>
                <button id="download-csv" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">📥 Download CSV</button>
              </div>
            `;

            setTimeout(() => {
              const addRowBtn = document.getElementById('add-product-row');
              // Always select tbody from the current output's table
              const tbody = output.querySelector('table tbody');

              addRowBtn?.addEventListener('click', () => {
                // Select tbody from the current output's table context
                const localTbody = output.querySelector('table tbody');
                const row = document.createElement('tr');
                row.className = "border-b border-gray-600";
                row.innerHTML = `
                  <td class="text-center"><input type="checkbox" class="ocr-product-check" checked /></td>
                  <td><input type="text" class="ocr-name bg-transparent border p-1 w-full" placeholder="Product name" /></td>
                  <td><input type="number" class="ocr-qty bg-transparent border p-1 w-full" placeholder="Qty" /></td>
                  <td><input type="text" class="ocr-unit bg-transparent border p-1 w-full" placeholder="Unit" /></td>
                  <td><input type="number" class="ocr-price bg-transparent border p-1 w-full" placeholder="Price" /></td>
                  <td><button class="delete-row text-red-500 px-2">🗑️</button></td>
                `;
                localTbody.appendChild(row);
              });

              // Add event listener for delete row buttons
              tbody.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-row')) {
                  const row = e.target.closest('tr');
                  row?.remove();
                }
              });

              // Delete Selected Rows logic
              const deleteBtn = document.getElementById('delete-selected-rows');
              deleteBtn?.addEventListener('click', () => {
                const rows = output.querySelectorAll('table tbody tr');
                rows.forEach((row) => {
                  const checked = row.querySelector('.ocr-product-check')?.checked;
                  if (checked) {
                    row.remove();
                  }
                });
              });

              // Download CSV logic
              const csvBtn = document.getElementById('download-csv');
              csvBtn?.addEventListener('click', () => {
                const rows = output.querySelectorAll('table tbody tr');
                let csvContent = 'Product Name,Quantity,Unit,Price\n';
                rows.forEach((row) => {
                  const name = row.querySelector('.ocr-name')?.value || '';
                  const qty = row.querySelector('.ocr-qty')?.value || '';
                  const unit = row.querySelector('.ocr-unit')?.value || '';
                  const price = row.querySelector('.ocr-price')?.value || '';
                  csvContent += `${name},${qty},${unit},${price}\n`;
                });

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const tempLink = document.createElement('a');
                tempLink.setAttribute('href', url);
                tempLink.setAttribute('download', 'ocr_inventory.csv');
                tempLink.style.display = 'none';
                document.body.appendChild(tempLink);
                tempLink.click();
                document.body.removeChild(tempLink);
              });
            }, 100);

            setTimeout(() => {
              const confirmButton = document.getElementById('confirm-ocr-upload');
              if (!confirmButton) {
                console.warn("⚠️ confirm-ocr-upload button not found after DOM update.");
                return;
              }

              confirmButton.addEventListener('click', async () => {
                console.log("💾 Saving OCR extracted products to Firestore...");
                if (!currentUser || !db) return alert("User or DB not ready.");

                const rows = output.querySelectorAll('tbody tr');
                let successCount = 0;
                let errorCount = 0;

                for (let i = 0; i < rows.length; i++) {
                  const row = rows[i];
                  // Remove previous error style
                  row.style.border = '';
                  const checked = row.querySelector('.ocr-product-check')?.checked;
                  if (!checked) continue;

                  const name = row.querySelector('.ocr-name')?.value.trim();
                  const quantity = parseInt(row.querySelector('.ocr-qty')?.value || '0');
                  const unit = row.querySelector('.ocr-unit')?.value.trim();
                  const price = parseFloat(row.querySelector('.ocr-price')?.value || '0');

                  // Validation: all fields required, quantity and price must be valid
                  if (!name || isNaN(quantity) || !unit || isNaN(price)) {
                    row.style.border = '2px solid red';
                    errorCount++;
                    continue;
                  }

                  const product = {
                    name,
                    sku: `${name}-${Date.now()}`,
                    quantity,
                    unit,
                    price,
                    cost: price,
                    brand: "N/A",
                    category: "Uncategorized",
                    description: "Added via OCR",
                    image: [],
                    createdAt: serverTimestamp()
                  };

                  try {
                    const productRef = collection(db, `businesses/${currentUser.uid}/products`);
                    await addDoc(productRef, product);
                    successCount++;
                  } catch (err) {
                    console.error("❌ Failed to save OCR product:", err);
                    errorCount++;
                  }
                }

                if (successCount > 0) {
                  showSuccessToast(`${successCount} OCR products added successfully!`);
                  // Instead of appending, replace the output with the success message and remove all previous OCR output (including <pre>)
                  output.innerHTML = `<div class="text-green-400 mt-4">✅ ${successCount} products saved to inventory!</div>`;
                  // No need to clear again after a timeout, as we have fully replaced the content
                } else {
                  output.innerHTML += `<div class="text-yellow-400 mt-4">⚠️ No valid product rows were saved. Please check highlighted rows.</div>`;
                }
              });
            }, 100);
          } catch (err) {
            console.error("❌ OCR failed", err);
            output.innerHTML = `<div class="text-red-500">Error during OCR: ${err.message}</div>`;
          }
        });
        // --- Bind Scan and Import button for OCR tab ---
        // This logic is injected after OCR tab is loaded, so button exists.
        const scanBtn = document.getElementById('scan-import-btn');
        if (scanBtn) {
          scanBtn.addEventListener('click', async () => {
            const ocrPreview = document.getElementById('ocr-preview');
            if (!ocrPreview) {
              console.error("❌ Element with id 'ocr-preview' not found.");
              alert('OCR preview area not found. Please reload the page.');
              return;
            }
            const imagePreview = ocrPreview.querySelector('img');
            if (!imagePreview) {
              alert('Please upload an image before scanning.');
              return;
            }

            scanBtn.textContent = 'Scanning...';
            scanBtn.disabled = true;

            try {
              const result = await Tesseract.recognize(imagePreview.src, 'eng');
              const extractedText = result.data.text;
              console.log('OCR Result:', extractedText);

              const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
              // Use already scoped variables for userId and db
              // const userId = firebase.auth().currentUser?.uid;
              // const db = firebase.firestore();
              const userId = currentUser.uid;
              // db is already globally scoped and initialized via initInventoryPage

              for (const line of lines) {
                const match = line.match(/(.+?)\s+(\d+)\s*(pcs|kg|ltr)?/i);
                if (match) {
                  const [_, name, quantity, unitRaw] = match;
                  const unit = unitRaw || 'unit';
                  const product = {
                    productName: name.trim(),
                    quantity: parseInt(quantity),
                    unit,
                    createdAt: serverTimestamp()
                  };

                  await addDoc(collection(db, `businesses/${userId}/products`), product);
                }
              }

              alert('Inventory imported successfully!');
            } catch (err) {
              console.error('OCR Error:', err);
              alert('Failed to scan image. Please try again.');
            } finally {
              scanBtn.textContent = 'Scan and Import';
              scanBtn.disabled = false;
            }
          });
        }
      }, 300); // Slight delay ensures OCR DOM is ready
    });
  });

  document.getElementById('open-ai-autogen-form-btn')?.addEventListener('click', () => {
    fetchAndInjectHTML('./src/modals/ai-autogen-form.html', modalContainer).then(() => {
      document.getElementById('close-ai-autogen-form-btn')?.addEventListener('click', closeModal);
    });
  });
};

const loadAddInventoryOptions = () => {
  const tabContent = document.getElementById('inventory-tab-content');
  if (tabContent) tabContent.innerHTML = ''; // Clear tab content when Add Inventory is triggered

  fetchAndInjectHTML('./src/modals/add-inventory-options-modal.html', tabContent).then(() => {
    bindInventoryOptionButtons(); // new function
  });
};

// --- Initialization ---
// This function is exported and called by main.js when the inventory page is loaded
export const initInventoryPage = (firestoreDb, user) => {
    db = firestoreDb;
    currentUser = user;

    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const tabContent = document.getElementById('inventory-tab-content');
    if (!tabContent) return;

    document.addEventListener('click', (e) => {
      if (e.target?.id === 'close-add-inventory-options-modal-btn') {
        closeModal();
      }
    });
    
    listenForInventoryUpdates();

    // --- Inventory Sub-Tab Routing ---
    const setupInventoryTabs = () => {
      const tabContent = document.getElementById('inventory-tab-content');
      if (!tabContent) return;

      const tabs = [
        { id: 'tab-add', action: loadAddInventoryOptions },
        { id: 'tab-view', path: './src/views/inventory-view.html' },
        { id: 'tab-group', path: './src/views/item-group.html' },
        { id: 'tab-alerts', path: './src/views/low-stock-alert.html' }
      ];

      tabs.forEach(tab => {
        const button = document.getElementById(tab.id);
        if (button) {
          button.addEventListener('click', async () => {
            if (tab.action) {
              tab.action();
            } else {
              tabContent.innerHTML = '';
              await fetchAndInjectHTML(tab.path, tabContent);
              if (tab.id === 'tab-view') {
                setTimeout(() => {
                  const listTarget = document.getElementById('inventory-list');
                  listenForInventoryUpdates(listTarget);
                }, 100);
              }
            }
          });
        }
      });
    };

    setupInventoryTabs();
};


export { handleAddProduct, bindInventoryOptionButtons, loadAddInventoryOptions };