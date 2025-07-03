import { collection, query, where, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, getFirestore } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
// This file will handle the logic for the billing and Point-of-Sale page.
// We will build this out in a future step.

// import { getFirestore, collection, doc, getDoc, getDocs } from 'firebase/firestore';
// import { getAuth } from 'firebase/auth';

// --- Initialization ---
// Wait for Firebase Auth to be ready and then initialize the billing logic with the user ID
export const initBillingPage = async (firestore, auth, currentUser) => {
    // Console log to confirm Firestore instance receipt
    console.log("🧪 Firestore Check (billing.js):", firestore);
    const authInstance = auth;

    // Validate Firestore instance before using
    if (!firestore || typeof firestore !== 'object' || !('_databaseId' in firestore)) {
        console.error("❌ Invalid Firestore object received in Billing init");
        return;
    }

    console.log("📦 Billing initialized with Firestore:", firestore);
    console.log("👤 Current Auth:", authInstance);

    // Wait for auth state to be loaded
    onAuthStateChanged(authInstance, (user) => {
        if (!user) {
            console.error("No authenticated user found. Billing page cannot initialize.");
            return;
        }
        const userId = currentUser?.uid || user.uid;
        // Continue with initialization after user is authenticated
        const productSelect = document.querySelector('#productSearch');
        const addToCartBtn = document.getElementById('addToCartBtn');
        const cartTableBody = document.getElementById('cartItems');

        if (!productSelect || !addToCartBtn || !cartTableBody) {
            console.error("One or more key UI components are missing.");
            return;
        }

        // Use setTimeout to ensure DOM and user are fully ready before initializing TomSelect
        setTimeout(async () => {
            // TomSelect configuration
            const tomSelect = new TomSelect(productSelect, {
                valueField: 'id',
                labelField: 'label',
                searchField: 'search',
                options: [],
                create: false,
                maxOptions: 500,
                highlight: true,
                placeholder: 'Search product name, SKU, brand or category',
                render: {
                    option: function(data, escape) {
                        if (!data) return '';
                        return `
                            <div class="flex items-center space-x-3 py-1">
                                <img src="${escape(data.image || '')}" alt="img" class="w-8 h-8 object-cover rounded border" />
                                <div>
                                    <div class="font-semibold">${escape(data.label)}</div>
                                    <div class="text-sm text-gray-500">${escape(data.details)}</div>
                                </div>
                            </div>
                        `;
                    },
                    item: function(data, escape) {
                        if (!data) return '';
                        return `
                            <div class="flex items-center space-x-2">
                                <img src="${escape(data.image || '')}" alt="img" class="w-5 h-5 object-cover rounded" />
                                <span>${escape(data.label)}</span>
                            </div>
                        `;
                    }
                }
            });

            let cart = [];

            // Debug: Log Firestore and userId before using collection
            console.log('Billing page init with:', { firestore, userId });

            // Load products from Firestore only after TomSelect is ready and user is confirmed
            console.log("🔎 Fetching products from:", `businesses/${userId}/products`);

            if (!firestore || typeof firestore !== 'object' || !('_databaseId' in firestore)) {
                console.error("❌ Cannot use Firestore: Invalid Firestore instance.");
                return;
            }
            if (!userId || typeof userId !== 'string') {
                console.error("❌ Cannot use Firestore: Invalid user ID.");
                return;
            }

            console.log("✅ Using Firestore to fetch products for userId:", userId);

            try {
                const productsRef = collection(firestore, 'businesses', userId, 'products');
                const snapshot = await getDocs(productsRef);
                console.log("📦 Snapshot size:", snapshot.size);
                tomSelect.clearOptions();
                const options = [];

                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const searchString = [
                        data.name || '',
                        data.sku || '',
                        data.brand || '',
                        data.category || ''
                    ].join(' ').toLowerCase();

                    const label = `${data.name || 'Unnamed Product'} (${data.sku || 'No SKU'})`;
                    const details = `${data.brand || 'No Brand'} - ${data.category || ''}`;
                    const image = Array.isArray(data.image) && data.image.length > 0 ? data.image[0] : '';

                    options.push({
                        id: docSnap.id,
                        value: docSnap.id,
                        label: label,
                        search: searchString,
                        details: details,
                        image: image
                    });
                });

                console.log("🏁 Final TomSelect options:", options);
                if (options.length === 0) {
                    console.warn("⚠️ No products found in Firestore for user.");
                }

                tomSelect.addOptions(options);
                tomSelect.refreshOptions(false);
            } catch (error) {
                console.error("🔥 Error loading products from Firestore:", error);
                if (error.code === 'permission-denied') {
                    console.error("🔒 Firestore permission denied: check your rules.");
                }
            }

            // Handle Add to Cart
            addToCartBtn.addEventListener('click', () => {
                const selectedId = tomSelect.getValue();
                if (!selectedId) {
                    console.warn("No product selected to add to cart.");
                    return;
                }
                if (!selectedId) return;

                const selectedDocRef = doc(firestore, 'businesses', userId, 'products', selectedId);
                getDoc(selectedDocRef).then(docSnap => {
                    if (!docSnap.exists()) return;

                    const product = docSnap.data();
                    const existing = cart.find(item => item.id === selectedId);

                    if (existing) {
                        existing.quantity += 1;
                    } else {
                        cart.push({
                            id: selectedId,
                            name: product.name || 'Unnamed Product',
                            price: typeof product.price === 'number' ? product.price : 0,
                            quantity: 1,
                            image: Array.isArray(product.image) && product.image.length > 0 ? product.image[0] : '',
                            sku: product.sku || ''
                        });
                    }

                    renderCart();
                });
            });

            function renderCart() {
                if (!Array.isArray(cart) || cart.length === 0) {
                    cartTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Cart is empty</td></tr>';
                    updateTotals();
                    return;
                }
                cartTableBody.innerHTML = '';
                cart.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><img src="${item.image}" alt="img" class="w-10 h-10 object-cover rounded border" /></td>
                        <td>${item.name}</td>
                        <td><input type="number" min="1" class="quantity-input w-16 p-1 border rounded" value="${item.quantity}" data-id="${item.id}" /></td>
                        <td>₹${item.price.toFixed(2)}</td>
                        <td>₹${(item.quantity * item.price).toFixed(2)}</td>
                        <td><button class="text-red-600 font-bold delete-cart-item" data-id="${item.id}">🗑️</button></td>
                    `;
                    row.setAttribute('data-product-id', item.id);
                    cartTableBody.appendChild(row);
                });

                // Attach event listeners to quantity inputs
                const quantityInputs = cartTableBody.querySelectorAll('.quantity-input');
                quantityInputs.forEach(input => {
                    input.addEventListener('change', (e) => {
                        const id = e.target.getAttribute('data-id');
                        let newQuantity = parseInt(e.target.value, 10);
                        if (isNaN(newQuantity) || newQuantity < 1) {
                            newQuantity = 1;
                            e.target.value = 1;
                        }
                        const item = cart.find(i => i.id === id);
                        if (item) {
                            item.quantity = newQuantity;
                            renderCart();
                        }
                    });
                });

                // Attach event listeners to delete buttons
                const deleteButtons = cartTableBody.querySelectorAll('.delete-cart-item');
                deleteButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.getAttribute('data-id');
                        removeCartItem(id);
                    });
                });

                updateTotals();
            }

            function removeCartItem(id) {
                cart = cart.filter(item => item.id !== id);
                renderCart();
            }

            function updateTotals() {
                const subtotalElem = document.getElementById('billingSubtotal');
                const grandTotalElem = document.getElementById('billingGrandTotal');

                if (!subtotalElem || !grandTotalElem) {
                    console.warn('Subtotal or Grand Total element missing in DOM.');
                    return;
                }

                const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
                // For now, no taxes or discounts, so grand total = subtotal
                const grandTotal = subtotal;

                subtotalElem.textContent = `₹${subtotal.toFixed(2)}`;
                grandTotalElem.textContent = `₹${grandTotal.toFixed(2)}`;
            }

            // Handle Generate Invoice
            const generateInvoiceBtn = document.getElementById('generateInvoiceBtn');
            if (generateInvoiceBtn) {
                generateInvoiceBtn.addEventListener('click', async () => {
                    if (cart.length === 0) {
                        alert('Cart is empty, cannot generate invoice.');
                        return;
                    }

                    const customerNameInput = document.getElementById('customerName');
                    const customerName = customerNameInput ? customerNameInput.value.trim() : '';

                    if (!customerName) {
                        alert('Please enter customer name.');
                        return;
                    }

                    try {
                        // Prepare invoice data
                        const invoiceData = {
                            customerName,
                            createdAt: new Date(),
                            items: cart.map(item => ({
                                productId: item.id,
                                name: item.name,
                                price: item.price,
                                quantity: item.quantity,
                                sku: item.sku
                            })),
                            subtotal: cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
                            grandTotal: cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
                        };

                        // Save invoice to Firestore
                        const invoicesRef = collection(firestore, 'businesses', userId, 'invoices');
                        await addDoc(invoicesRef, invoiceData);

                        // Deduct quantities from products
                        for (const item of cart) {
                            const productRef = doc(firestore, 'businesses', userId, 'products', item.id);
                            const productSnap = await getDoc(productRef);
                            if (productSnap.exists()) {
                                const productData = productSnap.data();
                                const currentStock = typeof productData.stockQuantity === 'number' ? productData.stockQuantity : 0;
                                const newStock = currentStock - item.quantity;
                                if (newStock < 0) {
                                    alert(`Not enough stock for product ${item.name}. Available: ${currentStock}, required: ${item.quantity}`);
                                    return;
                                }
                                await updateDoc(productRef, { stockQuantity: newStock });
                            }
                        }

                        alert('Invoice generated and saved successfully.');
                        cart = [];
                        renderCart();
                        if (customerNameInput) customerNameInput.value = '';
                    } catch (error) {
                        console.error('Error generating invoice:', error);
                        alert('Failed to generate invoice. Please try again.');
                    }
                });
            }
        }, 150); // Small delay to ensure all is ready
    });
};
