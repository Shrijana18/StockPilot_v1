// src/components/PhoneAuthUI.jsx
import React, { useEffect, useRef } from 'react';
import * as firebaseui from 'firebaseui';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { app } from '../firebase/firebaseConfig';

/**
 * FirebaseUI wrapper that renders Phone + Google sign-in and
 * lets FirebaseUI manage the full reCAPTCHA + OTP flow.
 *
 * Props:
 *  - onSignedIn(user): callback with the Firebase user after successful sign-in
 *  - onError(error): optional callback for surfacing FirebaseUI/OTP errors
 *  - preferInvisible: boolean (default true) -> invisible reCAPTCHA when true
 *  - defaultCountry: e.g. 'IN' (defaults to 'IN')
 */
function PhoneAuthUI({ onSignedIn, onError, preferInvisible = true, defaultCountry = 'IN' }) {
  const containerRef = useRef(null);
  const uiRef = useRef(null);
  const onSignedInRef = useRef(onSignedIn);
  const onErrorRef = useRef(onError);

  // Keep the latest callbacks without re-initializing UI
  useEffect(() => { onSignedInRef.current = onSignedIn; }, [onSignedIn]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    // Use compat Auth for FirebaseUI (expects namespaced api: firebase.auth())
    const compatApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(app.options);
    const auth = compatApp.auth();

    // Reuse a singleton instance across mounts
    uiRef.current = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);

    // Ensure the container is empty before starting UI (avoid duplicate widgets)
    try { if (containerRef.current) containerRef.current.innerHTML = ''; } catch {}

    const uiConfig = {
      signInFlow: 'popup',
      signInOptions: [
        {
          provider: firebase.auth.PhoneAuthProvider.PROVIDER_ID,
          defaultCountry,
          recaptchaParameters: {
            size: preferInvisible ? 'invisible' : 'normal',
            badge: 'bottomright',
          },
        },
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      ],
      callbacks: {
        uiShown: () => {
          // Try focusing the phone input when the UI renders.
          try {
            const input = containerRef.current?.querySelector('input[type="tel"]');
            input?.focus();
          } catch {}
        },
        signInSuccessWithAuthResult: (result) => {
          try { onSignedInRef.current?.(result.user); } catch {}
          return false; // Prevent redirect
        },
      },
      // We keep these blank to avoid unexpected navigation; customize if needed.
      tosUrl: undefined,
      privacyPolicyUrl: undefined,
    };

    // Start FirebaseUI
    try {
      uiRef.current.start(containerRef.current, uiConfig);
    } catch (err) {
      try { onErrorRef.current?.(err); } catch {}
    }

    // Cleanup on unmount
    return () => {
      try { uiRef.current?.reset(); } catch {}
      try { if (containerRef.current) containerRef.current.innerHTML = ''; } catch {}
    };
    // Intentionally not depending on preferInvisible/defaultCountry to avoid re-mount churn.
    // Re-mount this component if you need to change those at runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} id="firebaseui-auth-container" />;
}

export default React.memo(PhoneAuthUI);