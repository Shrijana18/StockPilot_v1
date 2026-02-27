# FLYP Business iOS – Resubmission Checklist

Use this after fixing the **4.8 Login Services** and **5.1.1 Privacy – Data Collection** rejection issues.

---

## 1. What’s already done in code

- **Sign in with Apple:** Shown on Login and Register. On **iOS** the app uses native Sign in with Apple (Capacitor plugin); on web it uses the popup.
- **Account deletion:** In **Profile** there is a **“Delete account”** section in the nav (sidebar/tabs). Path: **Profile → Delete account → Delete my account** (then confirm and re-auth).
- **iOS project:** `App.entitlements` includes the Sign in with Apple capability; build and sync are set up.

---

## 2. In Xcode (on your Mac)

1. **Open the project**
   ```bash
   open ios/App/App.xcworkspace
   ```
   (Use the **.xcworkspace** file, not the .xcodeproj.)

2. **Confirm Sign in with Apple**
   - Select the **App** target → **Signing & Capabilities**.
   - If you don’t see **Sign in with Apple**, click **+ Capability** and add **Sign in with Apple**.
   - The project already has `App/App.entitlements` with this capability; Xcode may show it under the entitlements file.

3. **Signing**
   - Set your **Team** and ensure **Automatically manage signing** is on (or configure provisioning for release).

4. **Run on a real device**
   - Choose your iPhone/iPad as the run destination.
   - Build and run (⌘R).
   - Test:
     - **Login:** Tap “Sign in with Apple” and complete the flow.
     - **Account deletion:** Go to **Profile** → **Delete account** → **Delete my account** and run through the confirmation flow (you can cancel before actually deleting).

5. **Archive for App Store**
   - Select **Any iOS Device (arm64)** as destination.
   - **Product → Archive**.
   - In Organizer: **Distribute App** → **App Store Connect** → **Upload**.

---

## 3. Apple Developer Portal (developer.apple.com)

- **App ID:** For the app’s Bundle ID (e.g. `com.flypnow.ios`), ensure **Sign in with Apple** is enabled in the App ID capabilities.
- If you use a separate **Services ID** for Firebase Apple sign-in, keep it configured as required by Firebase.

---

## 4. Firebase Console

- **Authentication → Sign-in method → Apple:** Enable and configure (Services ID, Team ID, Key ID, Private Key) so Sign in with Apple works in the app.

---

## 5. App Store Connect (appstoreconnect.apple.com)

1. **New version (if needed)**
   - If you’re submitting a new build for the same version (e.g. 1.1), you can add a new build to the same version.
   - If you prefer a new version (e.g. 1.2), create it and attach the new build.

2. **Reply to App Review (recommended)**
   - Open your app → **App Store** tab → **Resolution Center** (or the message thread for the rejection).
   - **Reply** and briefly state, for example:
     - *“We have addressed the issues: (1) Sign in with Apple is now offered on the login screen alongside Google and uses the native iOS flow. (2) Account deletion is available at Profile → Delete account → Delete my account, with confirmation and re-authentication.”*
   - This helps the reviewer find the changes quickly.

3. **Screenshots**
   - If the login or profile screens look different, update the **screenshots** for the relevant device sizes so they match the current app.

4. **Privacy / Data Collection (5.1.1)**
   - In **App Privacy** (and any **Data Collection**-related sections), ensure:
     - You describe what data you collect and how it’s used.
     - If the app allows account deletion, that’s consistent with your privacy description (e.g. “Users can delete their account and data from Profile → Delete account”).

5. **Submit for review**
   - Select the new build, complete any required fields (e.g. export compliance, content rights), and submit.

---

## 6. Quick command reference (from project root)

```bash
# Build web app and sync to iOS
npm run build
npx cap sync ios

# Open in Xcode
open ios/App/App.xcworkspace
```

---

## 7. If you need to bump the build/version

- **Xcode:** App target → **General** → **Version** (e.g. 1.1) and **Build** (e.g. 2 or 3). Use a new build number for each upload.
- **App Store Connect:** When you upload a new archive, the build number must be higher than any previously uploaded for that version.
