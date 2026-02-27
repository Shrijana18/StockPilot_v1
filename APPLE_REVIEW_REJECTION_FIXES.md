# Apple App Store Review Rejection – FLYP Business (iOS)

This document summarizes the rejection reasons and the changes made to comply.

## Rejection 1: Guideline 4.8 – Design: Login Services

**Issue:** The app uses a third-party login (e.g. Google) but did not appear to offer an equivalent login option that:
- Limits data collection to name and email
- Allows users to keep their email private
- Does not collect interactions for advertising without consent

**Apple’s note:** Sign in with Apple meets these requirements.

**Changes made:**
- **Sign in with Apple** was already present on Login and Register (web flow). On **iOS**, the in-app WebView can block or break the web popup flow.
- **Native Sign in with Apple** is used when the app runs on iOS (Capacitor): the `@capacitor-community/apple-sign-in` plugin is used to get the Apple identity token, then Firebase Auth `signInWithCredential` is used so login works reliably in the native app.
- Login and Register screens show **both** “Sign in with Google” and “Sign in with Apple” with equal prominence so the equivalent option is clearly visible.

**Firebase:** Ensure **Apple** is enabled under Authentication → Sign-in method in Firebase Console, with your Apple Services ID, Team ID, Key ID, and Private Key configured.

---

## Rejection 2: Guideline 5.1.1(v) – Data Collection and Storage (Account Deletion)

**Issue:** The app supports account creation but did not include an option to initiate account deletion.

**Requirements:**
- Only offering to deactivate or disable an account is not sufficient.
- If deletion is completed on a website, provide a direct link to that page.
- Confirmation steps are allowed; forcing users to contact support to delete is only acceptable in highly regulated industries.

**Changes made:**
- Account deletion was already implemented in **Profile** (Retailer and Distributor):
  - **Retailer:** Profile tab → **Delete account** section (and new **Account** section in nav).
  - **Distributor:** Profile tab → **Delete account** section (and new **Account** section in nav).
- **Discoverability:** A dedicated **“Account”** (or “Delete account”) item was added to the Profile settings navigation (sidebar on desktop, tabs on mobile) so reviewers and users can find **“Delete my account”** without scrolling to the bottom.
- Deletion flow: user taps “Delete my account” → confirmation modal (type “DELETE”) → reauth (Google/Apple/password) → Firestore business document deleted → Firebase user deleted.

**For App Review:** Account deletion is located at:  
**Profile** (bottom nav) → **Account** (or **Delete account** in the section list) → **Delete my account**.

---

## iOS native setup for Sign in with Apple

1. **Capacitor sync:** After pulling these changes, run: `npx cap sync ios`
2. **Xcode:** Open `ios/App/App.xcworkspace` and add the **Sign in with Apple** capability: App target → Signing & Capabilities → + Capability → Sign in with Apple.
3. **Firebase:** In Firebase Console → Authentication → Sign-in method → Apple, enable and add your Apple Services ID, Team ID, Key ID, and Private Key.

## Checklist Before Resubmission

- [ ] Firebase: Apple sign-in method enabled with correct Apple credentials.
- [ ] Xcode: Sign in with Apple capability added to the app target.
- [ ] Run `npx cap sync ios` and rebuild the iOS app.
- [ ] Test Sign in with Apple on a real iOS device (native flow used on iOS).
- [ ] Test account deletion: Profile → Delete account (in section list) → Delete my account (confirm flow and that data is removed).
- [ ] Update App Store Connect screenshots if the login or profile UI has changed.
- [ ] In Resolution Center, you can reply to App Review and state: “Sign in with Apple is offered on the login screen alongside Google. Account deletion is available in Profile → Account → Delete my account.”
