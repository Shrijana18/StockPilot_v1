/**
 * Website Analytics Tracking
 * Supports Google Analytics 4 and Firebase Analytics
 */

// Google Analytics 4 Configuration
// Uses Firebase measurementId (G-SENFJ2HSBW) or environment variable override
const GA4_MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID || 'G-SENFJ2HSBW';

// Initialize Google Analytics 4
export const initGA4 = () => {
  if (!GA4_MEASUREMENT_ID || typeof window === 'undefined') return;

  // Load gtag script
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
  document.head.appendChild(script1);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA4_MEASUREMENT_ID, {
    page_path: window.location.pathname,
  });

  return gtag;
};

// Track page view
export const trackPageView = (path) => {
  const fullPath = path || window.location.pathname + window.location.search;
  
  // Google Analytics 4
  if (window.gtag) {
    window.gtag('config', GA4_MEASUREMENT_ID, {
      page_path: fullPath,
    });
  }

  // Also track in Firestore for custom analytics
  trackPageViewInFirestore(fullPath);
};

// Track custom events
export const trackEvent = (eventName, eventParams = {}) => {
  // Google Analytics 4
  if (window.gtag) {
    window.gtag('event', eventName, eventParams);
  }

  // Also track in Firestore
  trackEventInFirestore(eventName, eventParams);
};

// Track page views in Firestore (custom analytics)
const trackPageViewInFirestore = async (path) => {
  try {
    const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const { app } = await import('../firebase/firebaseConfig');
    
    const firestore = getFirestore(app);
    const pageViewsRef = collection(firestore, 'websiteAnalytics');
    
    await addDoc(pageViewsRef, {
      type: 'page_view',
      path: path,
      timestamp: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      referrer: typeof document !== 'undefined' ? (document.referrer || 'direct') : 'direct',
      screenWidth: typeof window !== 'undefined' ? window.screen.width : 0,
      screenHeight: typeof window !== 'undefined' ? window.screen.height : 0,
      language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'unknown',
    });
  } catch (error) {
    console.warn('Failed to track page view in Firestore:', error);
  }
};

// Track events in Firestore
const trackEventInFirestore = async (eventName, eventParams) => {
  try {
    const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const { app } = await import('../firebase/firebaseConfig');
    
    const firestore = getFirestore(app);
    const eventsRef = collection(firestore, 'websiteAnalytics');
    
    await addDoc(eventsRef, {
      type: 'event',
      eventName: eventName,
      eventParams: eventParams,
      timestamp: serverTimestamp(),
      path: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });
  } catch (error) {
    console.warn('Failed to track event in Firestore:', error);
  }
};

// Track demo form submissions
export const trackDemoSubmission = (formData) => {
  trackEvent('demo_form_submitted', {
    business_category: formData.businessCategory,
    role: formData.role,
  });
};

// Track button clicks
export const trackButtonClick = (buttonName, location) => {
  trackEvent('button_click', {
    button_name: buttonName,
    location: location,
  });
};

// Track section views (when user scrolls to a section)
export const trackSectionView = (sectionName) => {
  trackEvent('section_view', {
    section_name: sectionName,
  });
};

