console.log("✅ main.js loaded successfully");

import { closeModal } from './utils.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { initInventoryPage } from './inventory.js';
import { initBillingPage } from './billing.js';

const firebaseConfig = {
  apiKey: "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE",
  authDomain: "stockpilotv1.firebaseapp.com",
  projectId: "stockpilotv1",
  storageBucket: "stockpilotv1.firebasestorage.app",
  messagingSenderId: "30934537475",
  appId: "1:30934537475:web:84a2f76609dbb1db290536",
  measurementId: "G-SENFJ2HSBW"
};

let app, auth, db, currentUser;
const elements = {};

const cacheDOMElements = () => {
  elements.landingPageView = document.getElementById('landing-page-view');
  elements.dashboardView = document.getElementById('dashboard-view');
  elements.modalContainer = document.getElementById('modal-container');
  elements.pageContent = document.getElementById('page-content');
};

const fetchAndInjectHTML = async (filePath, targetElement) => {
  try {
    const res = await fetch(filePath.startsWith('./') ? filePath : `./pages/${filePath}`);
    if (!res.ok) throw new Error(`Could not fetch ${filePath}`);
    const html = await res.text();
    targetElement.innerHTML = html;
    console.log(`✅ Loaded ${filePath}`);
  } catch (error) {
    console.error("HTML Injection Error:", error);
    targetElement.innerHTML = `<div class="p-6 bg-red-900 text-white rounded">❌ Failed to load: ${filePath}</div>`;
  }
};

const loadPage = async (page) => {
  if (page === 'landing') {
    if (!elements.landingPageView) {
      console.warn("Landing page view container not found");
      return;
    }
    await fetchAndInjectHTML('landing-page.html', elements.landingPageView);
    showView('landing');
    return;
  }

  if (!elements.pageContent) {
    console.error("❌ pageContent container not found");
    return;
  }

  // Clear content before injecting new page
  elements.pageContent.innerHTML = '';

  document.querySelectorAll('.dashboard-nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${page}`);
  });

  await fetchAndInjectHTML(`./pages/${page}.html`, elements.pageContent);

  if (page === 'inventory') initInventoryPage(db, currentUser);
  if (page === 'billing') initBillingPage(db, currentUser);
};

const initRegistrationModal = () => {
  const registrationModal = document.getElementById('registration-modal');
  if (!registrationModal) return;

  registrationModal.querySelector('#close-modal-btn').addEventListener('click', closeModal);

  registrationModal.querySelector('#details-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorEl = form.querySelector('#form-error');
    errorEl.textContent = '';
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, form.email.value, form.password.value);
      const businessRole = form['business-role'].value;

      await setDoc(doc(db, "businesses", userCredential.user.uid), {
        ownerId: userCredential.user.uid,
        businessName: form['business-name'].value,
        role: businessRole,
        createdAt: new Date()
      });

      closeModal();

      // Redirect to dashboard and load specific module if needed
      showView('dashboard');
      if (businessRole === 'retailer') {
        loadPage('inventory');
      } else if (businessRole === 'distributor') {
        loadPage('billing');
      } else {
        loadPage('dashboard');
      }
    } catch (error) {
      errorEl.textContent = error.message;
    }
  });
};

const initSignInModal = () => {
  const signInModal = document.getElementById('sign-in-modal');
  if (!signInModal) return;

  signInModal.querySelector('#close-modal-btn').addEventListener('click', closeModal);

  signInModal.querySelector('#sign-in-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorEl = form.querySelector('#form-error');
    errorEl.textContent = '';
    try {
      const userCredential = await signInWithEmailAndPassword(auth, form.email.value, form.password.value);
      const userDocRef = doc(db, "businesses", userCredential.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        closeModal();
        showView('dashboard');
        if (userData.role === 'retailer') {
          loadPage('inventory');
        } else if (userData.role === 'distributor') {
          loadPage('billing');
        } else {
          loadPage('dashboard');
        }
      } else {
        errorEl.textContent = "User profile not found.";
      }
    } catch (error) {
      errorEl.textContent = error.message;
    }
  });
};

const showModal = async (modalName) => {
  await fetchAndInjectHTML(`./pages/${modalName}.html`, elements.modalContainer);
  if (modalName === 'registration-modal') initRegistrationModal();
  if (modalName === 'sign-in-modal') initSignInModal();
};

const attachEventListeners = () => {
  document.body.addEventListener('click', (e) => {
    const registerBtn = e.target.closest('#register-btn, #register-btn-hero');
    const signInBtn = e.target.closest('#sign-in-btn');
    const navLink = e.target.closest('.dashboard-nav-link');

    if (registerBtn) showModal('registration-modal');
    if (signInBtn) showModal('sign-in-modal');
    if (navLink) {
      e.preventDefault();
      const page = navLink.getAttribute('href').substring(1);
      loadPage(page);
    }
  });
};

const showView = (view) => {
  elements.landingPageView?.classList.toggle('hidden-view', view !== 'landing');
  elements.dashboardView?.classList.toggle('hidden-view', view !== 'dashboard');
};

const initializeAppLogic = async () => {
  cacheDOMElements();
  console.log("Initializing AppLogic with views:", {
    landing: elements.landingPageView,
    dashboard: elements.dashboardView,
    pageContent: elements.pageContent
  });
  console.log("📦 Cached Elements:", elements);

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase init failed:", e);
    document.body.innerHTML = `<div class="p-10 bg-red-900 text-white">FATAL ERROR: Firebase not configured</div>`;
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    console.log("👤 Auth State Changed:", user);

    if (user) {
      showView('dashboard');
      await loadPage('inventory');
    } else {
      await loadPage('landing');
    }
    attachEventListeners();
  });
};

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 DOM Ready. Initializing app...");
  if (!window.location.hash) {
    window.location.hash = '#landing';
  }
  initializeAppLogic();
});