#!/usr/bin/env node

/**
 * Build script for FLYP Employee (Delivery Partner App) iOS
 * 
 * This script:
 * 1. Builds the employee web app
 * 2. Renames index.employee.html to index.html
 * 3. Syncs assets to ios-employee using Capacitor
 * 4. Updates capacitor config
 * 5. Optionally opens Xcode
 * 
 * Usage:
 *   npm run ios:employee         - Build and sync assets
 *   npm run ios:employee -- --open - Also open Xcode
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

console.log('👷  FLYP Employee - iOS Build Script\n');
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
  // Step 1: Build employee web app
  // ============================================
  console.log('\n📦 Step 1: Building employee web app...');
  if (!run('npm run build:employee')) {
    throw new Error('Web build failed');
  }

  // ============================================
  // Step 2: Rename index.employee.html to index.html
  // ============================================
  console.log('\n📝 Step 2: Preparing index.html...');
  const distDir = path.join(rootDir, 'dist');
  const indexEmployee = path.join(distDir, 'index.employee.html');
  const indexHtml = path.join(distDir, 'index.html');
  
  if (fs.existsSync(indexEmployee)) {
    fs.copyFileSync(indexEmployee, indexHtml);
    console.log('   ✓ Created index.html from index.employee.html');
  } else {
    console.log('   ⚠ index.employee.html not found, checking for index.html...');
    if (!fs.existsSync(indexHtml)) {
      throw new Error('No index.html found in dist folder');
    }
  }

  // ============================================
  // Step 3: Update Capacitor config for employee app
  // ============================================
  console.log('\n⚙️  Step 3: Updating Capacitor config...');
  const configPath = path.join(rootDir, 'capacitor.config.json');
  const originalConfig = fs.existsSync(configPath) 
    ? fs.readFileSync(configPath, 'utf8')
    : null;
  
  const capacitorConfig = {
    appId: "com.flypnow.employee",
    appName: "FLYP Employee",
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
      backgroundColor: "#0f172a",
      allowMixedContent: true,
      captureInput: true,
      webContentsDebuggingEnabled: false
    },
    ios: {
      backgroundColor: "#0f172a",
      contentInset: "automatic",
      allowsLinkPreview: true,
      scrollEnabled: true
    },
    plugins: {
      SplashScreen: {
        launchShowDuration: 2000,
        launchAutoHide: true,
        backgroundColor: "#0f172a",
        androidSplashResourceName: "splash",
        androidScaleType: "CENTER_CROP",
        showSpinner: false,
        splashFullScreen: true,
        splashImmersive: true
      },
      StatusBar: {
        style: "DARK",
        backgroundColor: "#0f172a"
      },
      Keyboard: {
        resize: "body",
        resizeOnFullScreen: true
      }
    }
  };

  fs.writeFileSync(configPath, JSON.stringify(capacitorConfig, null, 2));
  console.log('   ✓ Updated capacitor.config.json');

  // ============================================
  // Step 4: Sync to iOS using Capacitor
  // ============================================
  console.log('\n📱 Step 4: Syncing to iOS project...');
  
  // Check if ios-employee directory exists
  const iosEmployeeDir = path.join(rootDir, 'ios-employee');
  const iosDir = path.join(rootDir, 'ios');
  
  if (!fs.existsSync(iosEmployeeDir)) {
    console.log('   ⚠ ios-employee directory not found.');
    console.log('   Please run setup first: npm run setup:ios:employee');
    console.log('   Or create it manually by copying and modifying the ios directory.');
    throw new Error('ios-employee directory not found. Run npm run setup:ios:employee first.');
  }

  // Temporarily rename ios to ios-backup if it exists
  const iosBackupDir = path.join(rootDir, 'ios-backup');
  let iosWasRenamed = false;
  if (fs.existsSync(iosDir) && !fs.existsSync(iosBackupDir)) {
    fs.renameSync(iosDir, iosBackupDir);
    iosWasRenamed = true;
    console.log('   ℹ️  Temporarily renamed ios to ios-backup');
  }

  // Rename ios-employee to ios temporarily for Capacitor sync
  fs.renameSync(iosEmployeeDir, iosDir);
  console.log('   ℹ️  Temporarily renamed ios-employee to ios for Capacitor sync');

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
    fs.renameSync(iosDir, iosEmployeeDir);
    console.log('   ✓ Restored ios-employee directory name');
    
    if (iosWasRenamed) {
      fs.renameSync(iosBackupDir, iosDir);
      console.log('   ✓ Restored ios directory name');
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
  if (openXcode && fs.existsSync(iosEmployeeDir)) {
    console.log('\n🔨 Step 6: Opening Xcode...');
    const workspacePath = path.join(iosEmployeeDir, 'App', 'App.xcworkspace');
    if (fs.existsSync(workspacePath)) {
      run(`open "${workspacePath}"`);
      console.log('   ✓ Opened Xcode workspace');
    } else {
      const projectPath = path.join(iosEmployeeDir, 'App', 'App.xcodeproj');
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
  console.log('✅ FLYP Employee iOS build complete!\n');
  
  if (!openXcode) {
    console.log('📍 Next steps:');
    console.log('   • Open ios-employee/App/App.xcworkspace in Xcode');
    console.log('   • Select your device or simulator');
    console.log('   • Click Run ▶️ to build and install');
    console.log('');
    console.log('   Or run with --open flag to open Xcode automatically:');
    console.log('   npm run ios:employee -- --open');
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
  const iosEmployeeDir = path.join(rootDir, 'ios-employee');
  const iosDir = path.join(rootDir, 'ios');
  const iosBackupDir = path.join(rootDir, 'ios-backup');
  
  if (fs.existsSync(iosDir) && !fs.existsSync(iosEmployeeDir)) {
    // ios-employee was renamed to ios, restore it
    fs.renameSync(iosDir, iosEmployeeDir);
  }
  if (fs.existsSync(iosBackupDir)) {
    fs.renameSync(iosBackupDir, iosDir);
  }
  
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
