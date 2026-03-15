#!/usr/bin/env node

/**
 * Build script for FLYP Shop (Customer App) iOS
 * 
 * This script:
 * 1. Builds the customer web app
 * 2. Renames index.customer.html to index.html
 * 3. Syncs assets to ios-customer using Capacitor
 * 4. Updates capacitor config
 * 5. Optionally opens Xcode
 * 
 * Usage:
 *   npm run ios:customer         - Build and sync assets
 *   npm run ios:customer -- --open - Also open Xcode
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
const openXcode = args.includes('--open');

console.log('🛍️  FLYP Shop - iOS Build Script\n');
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
  // Step 3: Update Capacitor config for customer app
  // ============================================
  console.log('\n⚙️  Step 3: Updating Capacitor config...');
  const configPath = path.join(rootDir, 'capacitor.config.json');
  const originalConfig = fs.existsSync(configPath) 
    ? fs.readFileSync(configPath, 'utf8')
    : null;
  
  const capacitorConfig = {
    appId: "com.flypnow.ordernow",
    appName: "FLYP Shop",
    webDir: "dist",
    bundledWebRuntime: false,
    server: {
      iosScheme: "http",
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
        "maps.googleapis.com",
        "graph.facebook.com",
        "*.whatsapp.com",
        "checkout.razorpay.com",
        "api.razorpay.com"
      ],
      cleartext: true
    },
    android: {
      backgroundColor: "#0a0f1c",
      allowMixedContent: true,
      captureInput: true,
      webContentsDebuggingEnabled: false
    },
    ios: {
      backgroundColor: "#0a0f1c",
      contentInset: "never",
      allowsLinkPreview: true,
      scrollEnabled: false
    },
    plugins: {
      PushNotifications: {
        presentationOptions: ["badge", "sound", "alert"]
      },
      FirebaseMessaging: {
        presentationOptions: ["badge", "sound", "alert"]
      },
      SplashScreen: {
        launchShowDuration: 2000,
        launchAutoHide: true,
        backgroundColor: "#0a0f1c",
        androidSplashResourceName: "splash",
        androidScaleType: "CENTER_CROP",
        showSpinner: false,
        splashFullScreen: true,
        splashImmersive: true
      },
      StatusBar: {
        style: "DARK",
        backgroundColor: "#0a0f1c"
      },
      Keyboard: {
        resize: "none",
        resizeOnFullScreen: false
      }
    }
  };

  fs.writeFileSync(configPath, JSON.stringify(capacitorConfig, null, 2));
  console.log('   ✓ Updated capacitor.config.json');

  // ============================================
  // Step 4: Sync to iOS using Capacitor
  // ============================================
  console.log('\n📱 Step 4: Syncing to iOS project...');
  
  // Check if ios-customer directory exists
  const iosCustomerDir = path.join(rootDir, 'ios-customer');
  const iosDir = path.join(rootDir, 'ios');
  
  if (!fs.existsSync(iosCustomerDir)) {
    console.log('   ⚠ ios-customer directory not found.');
    console.log('   Please run setup first: npm run setup:ios:customer');
    console.log('   Or create it manually by copying and modifying the ios directory.');
    throw new Error('ios-customer directory not found. Run npm run setup:ios:customer first.');
  }

  // Temporarily rename ios to ios-backup if it exists
  const iosBackupDir = path.join(rootDir, 'ios-backup');
  let iosWasRenamed = false;
  if (fs.existsSync(iosDir) && !fs.existsSync(iosBackupDir)) {
    fs.renameSync(iosDir, iosBackupDir);
    iosWasRenamed = true;
    console.log('   ℹ️  Temporarily renamed ios to ios-backup');
  }

  // Rename ios-customer to ios temporarily for Capacitor sync
  fs.renameSync(iosCustomerDir, iosDir);
  console.log('   ℹ️  Temporarily renamed ios-customer to ios for Capacitor sync');

  try {
    // Sync using Capacitor CLI (it will sync to ios directory)
    if (!run('npx cap sync ios')) {
      console.log('   ⚠ Capacitor sync failed. Using manual copy...');
      // Manual sync: copy dist to ios/App/App/public
      const iosPublicDir = path.join(iosDir, 'App', 'App', 'public');
      if (!fs.existsSync(iosPublicDir)) {
        fs.mkdirSync(iosPublicDir, { recursive: true });
      }
      fs.cpSync(distDir, iosPublicDir, { recursive: true });
      console.log('   ✓ Manually copied dist → ios/App/App/public');
    } else {
      console.log('   ✓ Synced assets to iOS project');
    }
  } finally {
    // Always restore directory names
    if (fs.existsSync(iosDir) && !fs.existsSync(iosCustomerDir)) {
      fs.renameSync(iosDir, iosCustomerDir);
      console.log('   ✓ Restored ios-customer directory name');
    } else if (fs.existsSync(iosCustomerDir)) {
      console.log('   ℹ️  ios-customer already present, skip restore rename');
    }
    
    if (iosWasRenamed) {
      if (fs.existsSync(iosBackupDir) && !fs.existsSync(iosDir)) {
        fs.renameSync(iosBackupDir, iosDir);
        console.log('   ✓ Restored ios directory name');
      } else if (fs.existsSync(iosDir)) {
        console.log('   ℹ️  ios already present, skip backup restore rename');
      }
    }

    // Re-run pod install after restoring ios-customer path so Xcode refs stay valid
    const iosCustomerAppDir = path.join(rootDir, 'ios-customer', 'App');
    if (fs.existsSync(iosCustomerAppDir)) {
      console.log('\n🔧 Step 4b: Refreshing CocoaPods in ios-customer...');
      if (!run('pod install', { cwd: iosCustomerAppDir })) {
        console.log('   ⚠ pod install failed in ios-customer/App. You may need to run it manually.');
      } else {
        console.log('   ✓ Refreshed Pods for ios-customer');
      }
    }
  }

  // ============================================
  // Step 5: Restore original capacitor config
  // ============================================
  if (originalConfig) {
    fs.writeFileSync(configPath, originalConfig);
    console.log('\n📝 Step 5: Restored original capacitor.config.json');
  }

  // ============================================
  // Step 6: Open Xcode (optional)
  // ============================================
  if (openXcode && fs.existsSync(iosCustomerDir)) {
    console.log('\n🔨 Step 5: Opening Xcode...');
    const workspacePath = path.join(iosCustomerDir, 'App', 'App.xcworkspace');
    if (fs.existsSync(workspacePath)) {
      run(`open "${workspacePath}"`);
      console.log('   ✓ Opened Xcode workspace');
    } else {
      const projectPath = path.join(iosCustomerDir, 'App', 'App.xcodeproj');
      if (fs.existsSync(projectPath)) {
        run(`open "${projectPath}"`);
        console.log('   ✓ Opened Xcode project');
      } else {
        console.log('   ⚠ Xcode project/workspace not found');
      }
    }
  } else if (openXcode) {
    // Restore config before exiting
    if (originalConfig) {
      fs.writeFileSync(configPath, originalConfig);
    }
  }

  // ============================================
  // Done!
  // ============================================
  console.log('\n' + '━'.repeat(50));
  console.log('✅ FLYP Shop iOS build complete!\n');
  
  if (!openXcode) {
    console.log('📍 Next steps:');
    console.log('   • Open ios-customer/App/App.xcworkspace in Xcode');
    console.log('   • Select your device or simulator');
    console.log('   • Click Run ▶️ to build and install');
    console.log('');
    console.log('   Or run with --open flag to open Xcode automatically:');
    console.log('   npm run ios:customer -- --open');
  }

} catch (error) {
  // Restore original config on error
  const configPath = path.join(rootDir, 'capacitor.config.json');
  const originalConfigPath = path.join(rootDir, 'capacitor.config.json.backup');
  if (fs.existsSync(originalConfigPath)) {
    fs.copyFileSync(originalConfigPath, configPath);
    fs.unlinkSync(originalConfigPath);
  }
  
  // Restore directory names on error
  const iosCustomerDir = path.join(rootDir, 'ios-customer');
  const iosDir = path.join(rootDir, 'ios');
  const iosBackupDir = path.join(rootDir, 'ios-backup');
  
  if (fs.existsSync(iosDir) && !fs.existsSync(iosCustomerDir)) {
    // ios-customer was renamed to ios, restore it
    fs.renameSync(iosDir, iosCustomerDir);
  }
  if (fs.existsSync(iosBackupDir) && !fs.existsSync(iosDir)) {
    fs.renameSync(iosBackupDir, iosDir);
  }
  
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
