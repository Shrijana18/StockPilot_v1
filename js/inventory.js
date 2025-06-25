import { doc, setDoc, addDoc, collection, onSnapshot, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- State ---
let db = null;
let currentUser = null;

// --- DOM Elements ---
const pageContent = document.getElementById('page-content');
const modalContainer = document.getElementById('modal-container');

// --- Functions ---
const showAddProductModal = () => {
    fetch('./pages/add-product-modal.html')
        .then(response => response.text())
        .then(html => {
            modalContainer.innerHTML = html;
            const modal = document.getElementById('add-product-modal');
            modal.classList.remove('hidden-view');
            
            // Attach event listeners for the new modal
            modal.querySelector('#close-add-product-modal-btn').addEventListener('click', closeAddProductModal);
            modal.querySelector('#add-product-form').addEventListener('submit', handleAddProduct);
        });
};

const closeAddProductModal = () => {
    modalContainer.innerHTML = '';
};

const handleAddProduct = async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorElement = form.querySelector('#add-product-form-error');
    errorElement.textContent = '';

    const productName = form.querySelector('#product-name').value;
    const productSku = form.querySelector('#product-sku').value;
    const productQuantity = form.querySelector('#product-quantity').value;

    if (!productName || !productSku || !productQuantity) {
        errorElement.textContent = 'All fields are required.';
        return;
    }

    try {
        // Create a new document in the "products" sub-collection for the current user
        await addDoc(collection(db, `businesses/${currentUser.uid}/products`), {
            name: productName,
            sku: productSku,
            quantity: Number(productQuantity),
            createdAt: new Date()
        });
        closeAddProductModal();
    } catch (error) {
        console.error("Error adding document: ", error);
        errorElement.textContent = 'Failed to save product. Please try again.';
    }
};

const renderInventoryList = (products) => {
    const inventoryListElement = document.getElementById('inventory-list');
    if (!inventoryListElement) return;

    if (products.length === 0) {
        inventoryListElement.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-gray-500">You haven't added any products yet.</td></tr>`;
        return;
    }

    inventoryListElement.innerHTML = products.map(product => `
        <tr class="border-b border-white/10">
            <td class="p-4">${product.name}</td>
            <td class="p-4">${product.sku}</td>
            <td class="p-4">${product.quantity}</td>
            <td class="p-4">
                <button class="text-indigo-400 hover:text-indigo-300">Edit</button>
            </td>
        </tr>
    `).join('');
};

const listenForInventoryUpdates = () => {
    if (!currentUser) return;
    const q = query(collection(db, `businesses/${currentUser.uid}/products`));
    
    onSnapshot(q, (querySnapshot) => {
        const products = [];
        querySnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        renderInventoryList(products);
    });
};

// --- Initialization ---
export const initInventoryPage = (firestoreDb, user) => {
    db = firestoreDb;
    currentUser = user;

    // Attach event listener for the "Add New Product" button on the inventory page
    pageContent.addEventListener('click', (e) => {
        if (e.target.id === 'add-product-btn') {
            showAddProductModal();
        }
    });

    // Start listening for real-time updates to the inventory
    listenForInventoryUpdates();
};
