import { doc, addDoc, collection, onSnapshot, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { fetchAndInjectHTML, closeModal } from './utils.js';

// --- State ---
let db = null;
let currentUser = null;

// --- Functions ---
const handleAddProduct = async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorElement = form.querySelector('#add-product-form-error');
    if (errorElement) errorElement.textContent = '';

    const productName = form.querySelector('#product-name').value;
    const productSku = form.querySelector('#product-sku').value;
    const productQuantity = form.querySelector('#product-quantity').value;

    if (!productName || !productSku || !productQuantity) {
        if (errorElement) errorElement.textContent = 'All fields are required.';
        return;
    }

    try {
        // Create a new document in the "products" sub-collection for the current user's business
        await addDoc(collection(db, `businesses/${currentUser.uid}/products`), {
            name: productName,
            sku: productSku,
            quantity: Number(productQuantity),
            createdAt: serverTimestamp()
        });
        closeModal();
    } catch (error) {
        console.error("Error adding document: ", error);
        if (errorElement) errorElement.textContent = 'Failed to save product.';
    }
};

const renderInventoryList = (products) => {
    const inventoryListElement = document.getElementById('inventory-list');
    if (!inventoryListElement) return;

    if (products.length === 0) {
        inventoryListElement.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-gray-500">You haven't added any products yet. Click "Add New Product" to get started.</td></tr>`;
        return;
    }

    inventoryListElement.innerHTML = products.map(product => `
        <tr class="border-b border-white/10 hover:bg-white/5">
            <td class="p-4 font-medium">${product.name}</td>
            <td class="p-4 text-gray-400">${product.sku}</td>
            <td class="p-4 font-bold text-lg text-white">${product.quantity}</td>
            <td class="p-4">
                <button class="text-sm font-medium text-teal-400 hover:text-teal-300">Edit</button>
            </td>
        </tr>
    `).join('');
};

const listenForInventoryUpdates = () => {
    if (!currentUser) return;
    // Create a query to get products for the current user's business
    const q = query(collection(db, `businesses/${currentUser.uid}/products`));
    
    // onSnapshot listens for real-time changes
    onSnapshot(q, (querySnapshot) => {
        const products = [];
        querySnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        // Sort products by creation date, newest first
        products.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
        renderInventoryList(products);
    });
};

// --- Initialization ---
// This function is exported and called by main.js when the inventory page is loaded
export const initInventoryPage = (firestoreDb, user) => {
    db = firestoreDb;
    currentUser = user;

    // Attach event listener for the "Add New Product" button on the inventory page
    // We use event delegation on the pageContent container
    document.getElementById('page-content').onclick = (e) => {
        if (e.target.id === 'add-product-btn') {
            fetchAndInjectHTML('./pages/add-product-modal.html', document.getElementById('modal-container')).then(() => {
                 document.getElementById('close-add-product-modal-btn').addEventListener('click', closeModal);
                 document.getElementById('add-product-form').addEventListener('submit', handleAddProduct);
            });
        }
    };
    
    listenForInventoryUpdates();
};
