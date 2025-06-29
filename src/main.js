console.log("✅ main.js loaded successfully");

import { closeModal } from './utils.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { initInventoryPage } from './js/inventory.js';
import { initBillingPage } from './js/billing.js';

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
let selectedBusinessRole = '';
const elements = {};

const cacheDOMElements = () => {
  elements.landingPageView = document.getElementById('landing-page-view');
  elements.dashboardView = document.getElementById('dashboard-view');
  elements.modalContainer = document.getElementById('modal-container');
  elements.pageContent = document.getElementById('page-content');
};

const fetchAndInjectHTML = async (filePath, targetElement) => {
  try {
    const res = await fetch(filePath.startsWith('./') ? filePath : `./src/views/${filePath}`);
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
    await fetchAndInjectHTML('./src/views/landing-page.html', elements.landingPageView);
    showView('landing');
    return;
  }

  if (!elements.pageContent) {
    console.error("❌ pageContent container not found");
    return;
  }

  elements.pageContent.innerHTML = '';

  document.querySelectorAll('.dashboard-nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${page}`);
  });

  await fetchAndInjectHTML(`./src/views/${page}.html`, elements.pageContent);

  if (page === 'inventory') initInventoryPage(db, currentUser);
  if (page === 'billing') initBillingPage(db, currentUser);
};

const initSignInModal = () => {
  const signInModal = document.getElementById('sign-in-modal');
  if (!signInModal) return;

  signInModal.querySelector('#close-modal-btn').addEventListener('click', () => {
    signInModal.querySelector('#sign-in-form')?.reset();
    signInModal.querySelector('#form-error').textContent = '';
    closeModal();
  });

  signInModal.querySelector('#sign-in-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorEl = form.querySelector('#form-error');
    errorEl.textContent = '';
    try {
      const userCredential = await signInWithEmailAndPassword(auth, form['login-email'].value, form['login-password'].value);
      const userDocRef = doc(db, "businesses", userCredential.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        closeModal();
        form.reset();

        currentUser = userCredential.user;

        showView('dashboard');

        if (userData.role === 'retailer') {
          await loadPage('inventory');
        } else if (userData.role === 'distributor') {
          await loadPage('billing');
        } else {
          await loadPage('inventory');
        }
      } else {
        errorEl.textContent = "User profile not found.";
      }
    } catch (error) {
      errorEl.textContent = error.message;
    }
  });
};

const initRegistrationModal = () => {
  const roleCards = document.querySelectorAll('.role-card');
  const continueBtn = document.getElementById('next-to-details');
  const closeBtn = document.getElementById('close-modal-btn');

  roleCards.forEach(card => {
    card.addEventListener('click', () => {
      roleCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedBusinessRole = card.getAttribute('data-role');

      const roleInput = document.getElementById('selected-role');
      if (roleInput) roleInput.value = selectedBusinessRole;
    });
  });

  continueBtn?.addEventListener('click', async () => {
    if (!selectedBusinessRole) {
      alert("Please select a role to continue.");
      return;
    }

    const roleInput = document.getElementById('selected-role');
    if (roleInput) roleInput.value = selectedBusinessRole;

    const stepContainer = document.getElementById('registration-modal');
    if (stepContainer) {
      const res = await fetch('./src/views/registration-form.html');
      const formHtml = await res.text();
      stepContainer.innerHTML = formHtml;

      setTimeout(() => {
        const roleInputInjected = document.getElementById('selected-role');
        if (roleInputInjected) roleInputInjected.value = selectedBusinessRole;

        const form = document.getElementById('registration-form');
        if (form) {
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, form['register-email'].value, form['register-password'].value);
              const userId = userCredential.user.uid;
              await setDoc(doc(db, 'businesses', userId), {
                businessName: form['business-name'].value,
                ownerName: form['owner-name'].value,
                email: form['register-email'].value,
                phone: form['phone'].value,
                city: form['city'].value,
                role: selectedBusinessRole,
                createdAt: new Date().toISOString(),
              });
              closeModal();
              elements.modalContainer.innerHTML = '';
              showView('dashboard');
              if (selectedBusinessRole === 'retailer') {
                await loadPage('inventory');
              } else if (selectedBusinessRole === 'distributor') {
                await loadPage('billing');
              } else {
                await loadPage('inventory');
              }
              selectedBusinessRole = '';
            } catch (err) {
              alert(err.message);
            }
          });
        }
      }, 0);
    }
  });

  closeBtn?.addEventListener('click', () => {
    closeModal();
  });
};

const showModal = async (modalName) => {
  await fetchAndInjectHTML(`./src/modals/${modalName}.html`, elements.modalContainer);
  if (modalName === 'sign-in-modal') initSignInModal();
  if (modalName === 'registration-modal') initRegistrationModal();
};

const attachEventListeners = () => {
  document.body.addEventListener('click', (e) => {
    const registerBtn = e.target.closest('#register-btn, #register-btn-hero');
    const signInBtn = e.target.closest('#sign-in-btn');
    const signOutBtn = e.target.closest('#sign-out-btn');
    const navLink = e.target.closest('.dashboard-nav-link');

    if (registerBtn) {
      selectedBusinessRole = '';
      showModal('registration-modal');
    }
    if (signInBtn) showModal('sign-in-modal');
    if (signOutBtn) {
      signOut(auth)
        .then(async () => {
          currentUser = null;
          showView('landing');
          await loadPage('landing');
          attachEventListeners();
        })
        .catch((error) => console.error("Sign out failed:", error));
    }
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
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    const urlParams = new URLSearchParams(window.location.search);
    const loginEmail = urlParams.get("login-email");
    const loginPassword = urlParams.get("login-password");

    if (loginEmail && loginPassword) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        currentUser = userCredential.user;
        const userDoc = await getDoc(doc(db, "businesses", currentUser.uid));
        const role = userDoc.exists() ? userDoc.data().role : null;

        showView('dashboard');
        if (role === 'retailer') await loadPage('inventory');
        else if (role === 'distributor') await loadPage('billing');
        else await loadPage('inventory');

        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname + "#dashboard");
        attachEventListeners();
        return;
      } catch (err) {
        console.error("Auto-login from URL failed", err);
        alert("Login failed. Please try again.");
        await loadPage('landing');
      }
    } else {
      await loadPage('landing');
    }

    attachEventListeners();
  } catch (e) {
    console.error("Firebase init failed:", e);
    document.body.innerHTML = `<div class="p-10 bg-red-900 text-white">FATAL ERROR: Firebase not configured</div>`;
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      const userDoc = await getDoc(doc(db, "businesses", user.uid));
      const role = userDoc.exists() ? userDoc.data().role : null;

      showView('dashboard');

      if (role === 'retailer') {
        await loadPage('inventory');
      } else if (role === 'distributor') {
        await loadPage('billing');
      } else {
        await loadPage('inventory');
      }
    } else {
      await loadPage('landing');
    }

    attachEventListeners();
  });
};

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.hash) {
    window.location.hash = '#landing';
  }
  initializeAppLogic();
});