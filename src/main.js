function closeModal(modalId = 'sign-in-modal') {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
  } else {
    console.warn(`Modal with ID '${modalId}' not found.`);
  }
}

// ✅ Rebind sign-in modal on load if it's already in HTML
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('sign-in-modal')) {
    initSignInModal();
  }
  if (document.getElementById('registration-modal')) {
    initRegistrationModal();
  }
});

console.log("✅ main.js loaded successfully");

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE",
  authDomain: "stockpilotv1.firebaseapp.com",
  databaseURL: "https://stockpilotv1-default-rtdb.firebaseio.com",
  projectId: "stockpilotv1",
  storageBucket: "stockpilotv1.firebasestorage.app",
  messagingSenderId: "30934537475",
  appId: "1:30934537475:web:84a2f76609dbb1db290536",
  measurementId: "G-SENFJ2HSBW"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp); // ensure correct Firebase Auth instance

import { initInventoryPage, handleAddProduct } from './js/inventory.js';
import { initBillingPage } from './js/billing.js';


let currentUser;
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

  if (page === 'inventory') {
    console.log("🔧 Inventory page init with:", db, currentUser);
    initInventoryPage(db, currentUser);
  }
  if (page === 'billing') {
    try {
      if (!db || typeof db !== 'object' || typeof db._databaseId === 'undefined') {
  throw new Error("❌ Firestore instance is invalid (modular SDK check)");
}
      if (!auth || typeof auth !== 'object') {
        throw new Error("❌ Auth instance is invalid");
      }
      if (!currentUser || typeof currentUser.uid !== 'string') {
        throw new Error("❌ currentUser is invalid or UID is missing");
      }

      console.log("✅ Initializing Billing Module with:", { db, auth, currentUser });
      initBillingPage(db, auth, currentUser);
    } catch (err) {
      console.error("❌ Failed to initialize billing page. Error:", err);
      const container = document.getElementById('page-content');
      if (container) {
        container.innerHTML = `<div class="p-6 bg-red-800 text-white rounded">❌ Billing failed to load. Firebase may not be ready.</div>`;
      }
    }
  }
};

const initSignInModal = () => {
  const signInModal = document.getElementById('sign-in-modal');
  if (!signInModal) {
    console.error("❌ Sign-in modal not found in DOM");
    return;
  }

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

    if (!auth || !db) {
      errorEl.textContent = "Authentication system not initialized.";
      return;
    }

    try {
      const emailInput = form.querySelector('#login-email');
      const passwordInput = form.querySelector('#login-password');

      if (!emailInput || !passwordInput) {
        errorEl.textContent = "Email or password field not found.";
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
      const userDocRef = doc(db, "businesses", userCredential.user.uid);
      let userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // If Firestore profile doesn't exist, create one with basic fallback data
        await setDoc(userDocRef, {
          email: userCredential.user.email || '',
          role: 'retailer', // default fallback role
          createdAt: new Date().toISOString()
        });
        userDocSnap = await getDoc(userDocRef);
      }

      const userData = userDocSnap.data();
      closeModal();
      form.reset();

      currentUser = userCredential.user;
      const userId = currentUser.uid;
      showView('dashboard');

      if (userData.role === 'retailer') {
        await loadPage('inventory');
      } else if (userData.role === 'distributor') {
        if (db && currentUser && currentUser.uid) {
          await loadPage('billing');
        } else {
          console.warn("❌ Cannot load billing: Missing db or user context");
        }
      } else {
        await loadPage('inventory');
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

            if (!auth || !db) {
              alert("Authentication system not initialized.");
              return;
            }

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
                if (db && currentUser && currentUser.uid) {
                  await loadPage('billing');
                } else {
                  console.warn("❌ Cannot load billing: Missing db or user context");
                }
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
  console.log("📥 Showing modal:", modalName);
  await fetchAndInjectHTML(`./src/modals/${modalName}.html`, elements.modalContainer);
  if (modalName === 'sign-in-modal') initSignInModal();
  if (modalName === 'registration-modal') initRegistrationModal();
};

// Replace the dummy handler fallback with a safer check
if (typeof handleAddProduct !== 'function') {
  console.warn("⚠️ handleAddProduct is not implemented. Manual inventory form may not submit properly.");
}

// Add-product modal logic (updated per instructions)
const showAddInventoryOptionsModal = async () => {
  if (!elements.modalContainer) return;

  // Clear previous modal content before injecting a new one
  elements.modalContainer.innerHTML = '';

  // Load modal HTML
  await fetchAndInjectHTML('./src/modals/add-inventory-options-modal.html', elements.modalContainer);

  // Wait for next frame to ensure DOM is ready
  requestAnimationFrame(() => {
    const manualBtn = document.getElementById('open-manual-entry-form');
    const ocrBtn = document.getElementById('ocr-upload-btn');
    const aiBtn = document.getElementById('ai-autogen-btn');
    const cancelBtn = document.getElementById('close-add-inventory-options-modal-btn');

    // Cancel button closes modal and resets inventory panel
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        elements.modalContainer.innerHTML = '';
        const container = document.getElementById('inventory-panel');
        if (container) {
          container.innerHTML = `<p class="text-gray-400 italic">Please select a tab above to get started.</p>`;
        }
      });
    }

    // Manual entry opens form in #inventory-panel
    if (manualBtn) {
      manualBtn.addEventListener('click', async () => {
        const container = document.getElementById('inventory-panel');
        if (!container) return;

        // Load form into panel, clear modal
        await fetchAndInjectHTML('./src/modals/manual-entry-form.html', container);
        elements.modalContainer.innerHTML = '';

        requestAnimationFrame(() => {
          const closeManual = document.getElementById('close-add-product-modal-btn');
          const form = document.getElementById('add-product-form');

          if (closeManual) {
            closeManual.addEventListener('click', () => {
              container.innerHTML = `<p class="text-gray-400 italic">Please select a tab above to get started.</p>`;
            });
          }

          if (form) {
            form.addEventListener('submit', handleAddProduct);
          }
        });
      });
    }

    // OCR and AI forms
    if (ocrBtn) {
      ocrBtn.addEventListener('click', async () => {
        await fetchAndInjectHTML('./src/modals/ocr-upload-form.html', elements.modalContainer);
        requestAnimationFrame(() => {
          document.getElementById('close-ocr-upload-modal-btn')?.addEventListener('click', closeModal);
        });
      });
    }

    if (aiBtn) {
      aiBtn.addEventListener('click', async () => {
        await fetchAndInjectHTML('./src/modals/ai-autogen-form.html', elements.modalContainer);
        requestAnimationFrame(() => {
          document.getElementById('close-ai-autogen-modal-btn')?.addEventListener('click', closeModal);
        });
      });
    }
  });
};

const attachEventListeners = () => {
  document.body.addEventListener('click', (e) => {
    // ✅ Delegated listener for Add Inventory modal Cancel
    if (e.target.closest('#close-add-inventory-options-modal-btn')) {
      closeModal();
      return;
    }
    const registerBtn = e.target.closest('#register-btn, #register-btn-hero');
    const signInBtn = e.target.closest('#sign-in-btn');
    const signOutBtn = e.target.closest('#sign-out-btn');
    const navLink = e.target.closest('.dashboard-nav-link');

    if (registerBtn) {
      selectedBusinessRole = '';
      showModal('registration-modal');
    }
    if (signInBtn) {
      console.log("🧩 Sign In button clicked");
      showModal('sign-in-modal');
    }
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

    // Add-product modal logic (enhanced for clarity)
    const addProductBtn = e.target.closest('#add-product-btn');
    if (addProductBtn) {
      showAddInventoryOptionsModal();
    }
  });

  // ✅ Inventory tab navigation (delegated)
  document.body.addEventListener('click', async (e) => {
    const tabButton = e.target.closest('#tab-add, #tab-view, #tab-group, #tab-alerts');
    if (!tabButton) return;

    const tabId = tabButton.id;
    const contentMap = {
      'tab-add': './src/modals/add-inventory-options-modal.html',
      'tab-view': './src/views/inventory-view.html',
      'tab-group': './src/views/item-group.html',
      'tab-alerts': './src/views/low-stock-alert.html'
    };
    const container = document.getElementById('inventory-tab-content');
    if (!container) return;

    container.innerHTML = '';

    if (tabId === 'tab-add') {
      const { loadAddInventoryOptions } = await import('./js/inventory.js');
      loadAddInventoryOptions();
    } else {
      await fetchAndInjectHTML(contentMap[tabId], container);
    }
  });
};

const showView = (view) => {
  elements.landingPageView?.classList.toggle('hidden-view', view !== 'landing');
  elements.dashboardView?.classList.toggle('hidden-view', view !== 'dashboard');
};

const initializeAppLogic = async () => {
  cacheDOMElements();

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
      else if (role === 'distributor') {
        if (db && currentUser && currentUser.uid) {
          await loadPage('billing');
        } else {
          console.warn("❌ Cannot load billing: Missing db or user context");
        }
      }
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

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      const userDoc = await getDoc(doc(db, "businesses", user.uid));
      const role = userDoc.exists() ? userDoc.data().role : null;

      showView('dashboard');

      if (role === 'retailer') {
        await loadPage('inventory');
      } else if (role === 'distributor') {
        // Ensure currentUser is set before calling loadPage('billing')
        if (db && currentUser && currentUser.uid) {
          await loadPage('billing');
        } else {
          console.warn("❌ Cannot load billing: Missing db or user context");
        }
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
