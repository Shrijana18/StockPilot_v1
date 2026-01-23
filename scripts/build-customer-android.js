#!/usr/bin/env node

/**
 * Build script for FLYP Shop (Customer App) Android
 * 
 * This script:
 * 1. Builds the customer web app
 * 2. Renames index.customer.html to index.html
 * 3. Copies assets to android-customer
 * 4. Updates capacitor config
 * 5. Optionally builds APK
 * 
 * Usage:
 *   npm run android:customer         - Build and sync assets
 *   npm run android:customer -- --apk    - Also build debug APK
 *   npm run android:customer -- --install - Build APK and install on device
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Parse arguments
const args = process.argv.slice(2);
const buildApk = args.includes('--apk') || args.includes('--install');
const installApk = args.includes('--install');

console.log('🛍️  FLYP Shop - Android Build Script\n');
console.log('━'.repeat(50));

// Helper to run commands
const run = (cmd, options = {}) => {
  console.log(`\n> ${cmd}\n`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: rootDir, ...options });
    return true;
  } catch (error) {
    console.error(`❌ Command failed: ${cmd}`);
    return false;
  }
};

// Helper to run commands silently and return output
const runSilent = (cmd) => {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

try {
  // ============================================
  // Step 1: Build customer web app
  // ============================================
  console.log('\n📦 Step 1: Building customer web app...');
  if (!run('npm run build:customer')) {
    throw new Error('Web build failed');
  }

  // ============================================
  // Step 2: Rename index.customer.html to index.html
  // ============================================
  console.log('\n📝 Step 2: Preparing index.html...');
  const distDir = path.join(rootDir, 'dist');
  const indexCustomer = path.join(distDir, 'index.customer.html');
  const indexHtml = path.join(distDir, 'index.html');
  
  if (fs.existsSync(indexCustomer)) {
    fs.copyFileSync(indexCustomer, indexHtml);
    console.log('   ✓ Created index.html from index.customer.html');
  } else {
    console.log('   ⚠ index.customer.html not found, checking for index.html...');
    if (!fs.existsSync(indexHtml)) {
      throw new Error('No index.html found in dist folder');
    }
  }

  // ============================================
  // Step 3: Copy assets to android-customer
  // ============================================
  console.log('\n📋 Step 3: Copying assets to Android project...');
  const androidAssetsDir = path.join(rootDir, 'android-customer/app/src/main/assets');
  const publicDir = path.join(androidAssetsDir, 'public');

  // Remove old public folder
  if (fs.existsSync(publicDir)) {
    fs.rmSync(publicDir, { recursive: true });
  }
  fs.mkdirSync(publicDir, { recursive: true });

  // Copy dist to public
  fs.cpSync(distDir, publicDir, { recursive: true });
  console.log('   ✓ Copied dist → android-customer/app/src/main/assets/public');

  // ============================================
  // Step 4: Update Capacitor config
  // ============================================
  console.log('\n⚙️  Step 4: Updating Capacitor config...');
  const capacitorConfig = {
    appId: "com.flypnow.shop",
    appName: "FLYP Shop",
    webDir: "dist",
    bundledWebRuntime: false,
    server: {
      iosScheme: "capacitor",
      androidScheme: "https",
      allowNavigation: [
        "apis.google.com",
        "accounts.google.com",
        "www.google.com",
        "www.gstatic.com",
        "*.googleapis.com",
        "*.firebaseio.com",
        "firestore.googleapis.com",
        "firebasestorage.googleapis.com",
        "securetoken.googleapis.com",
        "identitytoolkit.googleapis.com",
        "maps.googleapis.com"
      ],
      cleartext: true
    },
    android: {
      backgroundColor: "#060D2D",
      allowMixedContent: true,
      captureInput: true,
      webContentsDebuggingEnabled: true
    },
    ios: {
      backgroundColor: "#060D2D",
      contentInset: "automatic",
      allowsLinkPreview: true,
      scrollEnabled: true
    },
    plugins: {
      SplashScreen: {
        launchShowDuration: 1500,
        launchAutoHide: true,
        backgroundColor: "#060D2D",
        androidSplashResourceName: "splash",
        androidScaleType: "CENTER_CROP",
        showSpinner: false,
        splashFullScreen: true,
        splashImmersive: true
      },
      StatusBar: {
        style: "LIGHT",
        backgroundColor: "#060D2D"
      },
      Keyboard: {
        resize: "body",
        resizeOnFullScreen: true
      }
    }
  };

  const configPath = path.join(androidAssetsDir, 'capacitor.config.json');
  fs.writeFileSync(configPath, JSON.stringify(capacitorConfig, null, 2));
  console.log('   ✓ Updated capacitor.config.json');

  // ============================================
  // Step 5: Build APK (optional)
  // ============================================
  if (buildApk) {
    console.log('\n🔨 Step 5: Building debug APK...');
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    if (!run(`${gradlew} assembleDebug`, { cwd: path.join(rootDir, 'android-customer') })) {
      throw new Error('APK build failed');
    }

    // Find the APK
    const apkPath = path.join(rootDir, 'android-customer/app/build/intermediates/apk/debug/app-debug.apk');
    const outputApkPath = path.join(rootDir, 'android-customer/app/build/outputs/apk/debug/app-debug.apk');
    
    let finalApkPath = null;
    if (fs.existsSync(outputApkPath)) {
      finalApkPath = outputApkPath;
    } else if (fs.existsSync(apkPath)) {
      finalApkPath = apkPath;
    }

    if (finalApkPath) {
      console.log(`   ✓ APK built: ${finalApkPath}`);
      
      // ============================================
      // Step 6: Install APK (optional)
      // ============================================
      if (installApk) {
        console.log('\n📱 Step 6: Installing APK...');
        
        // Check for adb
        const adbPath = path.join(process.env.HOME || '', 'Library/Android/sdk/platform-tools/adb');
        const adb = fs.existsSync(adbPath) ? adbPath : 'adb';
        
        // Get device list
        const devices = runSilent(`${adb} devices`);
        if (devices && devices.includes('device')) {
          // Install
          const installResult = runSilent(`${adb} install -r -t "${finalApkPath}"`);
          if (installResult !== null) {
            console.log('   ✓ APK installed successfully');
            
            // Launch app
            console.log('\n🚀 Launching FLYP Shop...');
            runSilent(`${adb} shell am start -n com.flypnow.shop/.MainActivity`);
            console.log('   ✓ App launched');
          } else {
            console.log('   ⚠ Multiple devices found. Install manually:');
            console.log(`      ${adb} -s <device_id> install -r -t "${finalApkPath}"`);
          }
        } else {
          console.log('   ⚠ No device connected. Connect a device or start an emulator.');
        }
      }
    }
  }

  // ============================================
  // Done!
  // ============================================
  console.log('\n' + '━'.repeat(50));
  console.log('✅ FLYP Shop Android build complete!\n');
  
  if (!buildApk) {
    console.log('📍 Next steps:');
    console.log('   • Open android-customer in Android Studio');
    console.log('   • Click Run ▶️ to install on device/emulator');
    console.log('');
    console.log('   Or run with --apk flag to build APK:');
    console.log('   npm run android:customer -- --apk');
    console.log('');
    console.log('   Or run with --install flag to build and install:');
    console.log('   npm run android:customer -- --install');
  }

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
