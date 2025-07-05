import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";

// 🔹 Create or update a customer
export const saveCustomer = async (db, userId, customerData) => {
  const customerRef = doc(db, `businesses/${userId}/customers`, customerData.phone);
  await setDoc(customerRef, customerData, { merge: true });
};

// 🔹 Fetch all customers
export const getCustomers = async (db, userId) => {
  const q = collection(db, `businesses/${userId}/customers`);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
};

// 🔹 Save a finalized invoice
export const saveInvoice = async (db, userId, invoiceData) => {
  const invoiceRef = collection(db, `businesses/${userId}/finalizedInvoices`);
  await addDoc(invoiceRef, invoiceData);
};

// 🔹 Get all invoices
export const getAllInvoices = async (db, userId) => {
  const q = collection(db, `businesses/${userId}/finalizedInvoices`);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 🔹 Fetch product list from inventory
export const getProducts = async (db, userId) => {
  const q = collection(db, `businesses/${userId}/products`);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 🔹 Update product stock after billing
export const updateProductStock = async (db, userId, productId, newQuantity) => {
  const productRef = doc(db, `businesses/${userId}/products`, productId);
  await updateDoc(productRef, { quantity: newQuantity });
};

// 🔹 Add a new product to inventory
export const handleAddProduct = async (db, userId, productData) => {
  try {
    const productsRef = collection(db, `businesses/${userId}/products`);
    await addDoc(productsRef, productData);
  } catch (error) {
    console.error("Error adding product:", error);
  }
};