// Import the functions you need from the Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initInventoryPage } from './inventory.js';

// --- IMPORTANT: PASTE YOUR FIREBASE CONFIG HERE ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE",
  authDomain: "stockpilotv1.firebaseapp.com",
  projectId: "stockpilotv1",
  storageBucket: "stockpilotv1.firebasestorage.app",
  messagingSenderId: "30934537475",
  appId: "1:30934537475:web:84a2f76609dbb1db290536",
  measurementId: "G-SENFJ2HSBW"
};
// --- End of Firebase Config ---

// --- Global State ---
let app, auth, db, currentUser;

// --- DOM Element Cache ---
const elements = {};

const cacheDOMElements = () => {
    elements.appContainer = document.getElementById('app-container');
    elements.landingPageView = document.getElementById('landing-page-view');
    elements.dashboardView = document.getElementById('dashboard-view');
    elements.modalContainer = document.getElementById('modal-container');
    elements.pageContent = document.getElementById('page-content');
    elements.splashScreen = document.getElementById('splash-screen');
    elements.mainApp = document.getElementById('main-app');
};

// --- Page & Modal Loading ---
const fetchAndInjectHTML = async (filePath, targetElement) => {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Could not fetch ${filePath}`);
        targetElement.innerHTML = await response.text();
    } catch (error) {
        console.error(`Failed to load content from ${filePath}:`, error);
        targetElement.innerHTML = `<p class="text-red-500 p-8">Error: Could not load required component.</p>`;
    }
};

const loadPage = async (page) => {
    if (!elements.pageContent) return;
    await fetchAndInjectHTML(`./pages/${page}.html`, elements.pageContent);
    if (page === 'inventory') {
        initInventoryPage(db, currentUser);
    }
};

const handleNavigation = () => {
    const page = window.location.hash.substring(1) || 'dashboard';
    loadPage(page);
    document.querySelectorAll('.dashboard-nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${page}`);
    });
};

const closeModal = () => {
    elements.modalContainer.innerHTML = '';
};

const initRegistrationModal = () => {
    const modal = document.getElementById('registration-modal');
    if (!modal) return;
    modal.querySelector('#close-modal-btn').addEventListener('click', closeModal);
    const detailsForm = modal.querySelector('#details-form');
    detailsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formError = modal.querySelector('#form-error');
        formError.textContent = '';
        const email = detailsForm.email.value;
        const password = detailsForm.password.value;
        const businessName = detailsForm['business-name'].value;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "businesses", userCredential.user.uid), {
                ownerId: userCredential.user.uid,
                businessName: businessName,
                createdAt: new Date()
            });
        } catch (error) {
            formError.textContent = error.message;
        }
    });
};

const loadAndShowModal = async (modalName) => {
    await fetchAndInjectHTML(`./pages/${modalName}.html`, elements.modalContainer);
    if (modalName === 'registration-modal') initRegistrationModal();
};

const attachLandingPageListeners = () => {
    document.getElementById('register-btn')?.addEventListener('click', () => loadAndShowModal('registration-modal'));
    document.getElementById('register-btn-hero')?.addEventListener('click', () => loadAndShowModal('registration-modal'));
};

const attachDashboardListeners = () => {
     document.getElementById('sign-out-btn')?.addEventListener('click', () => signOut(auth));
     document.querySelectorAll('.dashboard-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = e.currentTarget.getAttribute('href');
        });
    });
};

// --- View Management ---
const showView = async (view) => {
    elements.landingPageView.classList.toggle('hidden-view', view !== 'landing');
    elements.dashboardView.classList.toggle('hidden-view', view !== 'dashboard');

    if (view === 'landing') {
        await fetchAndInjectHTML('./pages/landing-page.html', elements.landingPageView);
        attachLandingPageListeners();
    } else if (view === 'dashboard') {
        attachDashboardListeners();
        handleNavigation();
    }
};

// --- Main Application Initialization ---
const initApp = () => { // Or startApp, or any other unique name
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        document.body.innerHTML = `<div class="w-screen h-screen flex items-center justify-center bg-red-900 text-white p-8 text-center"><h1>FATAL ERROR</h1><p>Could not connect to backend services. Please check your Firebase configuration in main.js.</p></div>`;
        return;
    }

    cacheDOMElements();

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            showView('dashboard');
        } else {
            showView('landing');
        }
    });

    // Hide splash screen AFTER everything is set up
    setTimeout(() => {
        elements.splashScreen.classList.add('splash-active');
        elements.mainApp.classList.add('content-visible');
        const mainLogoContainer = document.getElementById('main-logo');
        if(mainLogoContainer) mainLogoContainer.parentElement.classList.add('logo-visible');
    }, 500);
    // Hide splash screen AFTER everything is set up
// setTimeout(() => {
//     elements.splashScreen.classList.add('splash-active');
//     elements.mainApp.classList.add('content-visible');
//     const mainLogoContainer = document.getElementById('main-logo');
//     if(mainLogoContainer) mainLogoContainer.parentElement.classList.add('logo-visible');
// }, 500);
};

// --- Application Start ---
document.addEventListener('DOMContentLoaded', initApp); // Use the new name here too
