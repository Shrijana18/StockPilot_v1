#!/usr/bin/env node

/**
 * Setup script for FLYP Shop (Customer App) iOS
 * 
 * This script initializes the ios-customer directory by:
 * 1. Creating a new Capacitor iOS project with customer bundle ID
 * 2. Configuring it for the customer app
 * 
 * Usage:
 *   npm run setup:ios:customer
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🛍️  FLYP Shop - iOS Customer App Setup\n');
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
  const iosCustomerDir = path.join(rootDir, 'ios-customer');
  
  // Check if ios-customer already exists
  if (fs.existsSync(iosCustomerDir)) {
    console.log('\n⚠️  ios-customer directory already exists.');
    console.log('   If you want to recreate it, please delete it first:');
    console.log(`   rm -rf ${iosCustomerDir}`);
    process.exit(0);
  }

  // Step 1: Temporarily update capacitor.config.json for customer app
  console.log('\n📝 Step 1: Preparing Capacitor config...');
  const capacitorConfigPath = path.join(rootDir, 'capacitor.config.json');
  const originalConfig = fs.existsSync(capacitorConfigPath) 
    ? fs.readFileSync(capacitorConfigPath, 'utf8')
    : null;

  const customerConfig = {
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
        "maps.googleapis.com",
        "graph.facebook.com",
        "*.whatsapp.com"
      ],
      cleartext: true
    },
    ios: {
      backgroundColor: "#0a0f1c",
      contentInset: "automatic",
      allowsLinkPreview: true,
      scrollEnabled: true
    },
    plugins: {
      SplashScreen: {
        launchShowDuration: 2000,
        launchAutoHide: true,
        backgroundColor: "#0a0f1c",
        showSpinner: false,
        splashFullScreen: true,
        splashImmersive: true
      },
      StatusBar: {
        style: "DARK",
        backgroundColor: "#0a0f1c"
      },
      Keyboard: {
        resize: "body",
        resizeOnFullScreen: true
      }
    }
  };

  fs.writeFileSync(capacitorConfigPath, JSON.stringify(customerConfig, null, 2));
  console.log('   ✓ Updated capacitor.config.json for customer app');

  // Step 2: Add iOS platform with customer bundle ID
  console.log('\n📱 Step 2: Creating iOS project...');
  
  // Check if ios directory exists (main app)
  const iosDir = path.join(rootDir, 'ios');
  if (fs.existsSync(iosDir)) {
    console.log('   ℹ️  Main ios directory exists. Creating ios-customer separately...');
    
    // Use Capacitor to add iOS, then rename it
    if (run('npx cap add ios')) {
      // Check if a new ios directory was created (it might not if one exists)
      // In that case, we'll need to create it manually
      if (fs.existsSync(iosDir)) {
        // Check if it's the same as before (by checking a unique file)
        const testFile = path.join(iosDir, 'App', 'App', 'Info.plist');
        if (fs.existsSync(testFile)) {
          const infoPlist = fs.readFileSync(testFile, 'utf8');
          // If it has the customer bundle ID, we're good
          if (infoPlist.includes('com.flypnow.shop')) {
            console.log('   ✓ iOS project created with customer bundle ID');
          } else {
            // We need to create ios-customer manually
            console.log('   ℹ️  Creating ios-customer from template...');
            // Copy ios to ios-customer and modify
            fs.cpSync(iosDir, iosCustomerDir, { recursive: true });
            console.log('   ✓ Copied ios to ios-customer');
            
            // Update bundle ID in project.pbxproj
            const pbxprojPath = path.join(iosCustomerDir, 'App', 'App.xcodeproj', 'project.pbxproj');
            if (fs.existsSync(pbxprojPath)) {
              let pbxproj = fs.readFileSync(pbxprojPath, 'utf8');
              pbxproj = pbxproj.replace(/com\.flypnow\.ios/g, 'com.flypnow.shop');
              fs.writeFileSync(pbxprojPath, pbxproj);
              console.log('   ✓ Updated bundle ID in Xcode project');
            }
            
            // Update Info.plist
            const infoPlistPath = path.join(iosCustomerDir, 'App', 'App', 'Info.plist');
            if (fs.existsSync(infoPlistPath)) {
              let infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
              infoPlist = infoPlist.replace(/<string>FLYP<\/string>/g, '<string>FLYP Shop</string>');
              fs.writeFileSync(infoPlistPath, infoPlist);
              console.log('   ✓ Updated app name in Info.plist');
            }
          }
        }
      }
    } else {
      console.log('   ⚠ Capacitor add ios failed. Creating manually...');
      // Manual creation would be complex, so we'll guide the user
      console.log('\n   Please run manually:');
      console.log('   1. Temporarily rename ios to ios-backup');
      console.log('   2. Run: npx cap add ios');
      console.log('   3. Rename ios to ios-customer');
      console.log('   4. Rename ios-backup back to ios');
      console.log('   5. Update ios-customer/App/App.xcodeproj/project.pbxproj');
      console.log('      Replace com.flypnow.ios with com.flypnow.shop');
      console.log('   6. Update ios-customer/App/App/Info.plist');
      console.log('      Replace FLYP with FLYP Shop');
      process.exit(1);
    }
  } else {
    // No ios directory, can add directly
    if (run('npx cap add ios')) {
      // Rename to ios-customer
      if (fs.existsSync(iosDir)) {
        fs.renameSync(iosDir, iosCustomerDir);
        console.log('   ✓ Created and renamed to ios-customer');
      }
    }
  }

  // Step 3: Restore original capacitor config
  if (originalConfig) {
    fs.writeFileSync(capacitorConfigPath, originalConfig);
    console.log('\n📝 Step 3: Restored original capacitor.config.json');
  }

  // Step 4: Update Info.plist with customer app details
  console.log('\n⚙️  Step 4: Configuring iOS app...');
  const infoPlistPath = path.join(iosCustomerDir, 'App', 'App', 'Info.plist');
  if (fs.existsSync(infoPlistPath)) {
    let infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
    
    // Update display name
    infoPlist = infoPlist.replace(
      /<key>CFBundleDisplayName<\/key>\s*<string>.*?<\/string>/,
      '<key>CFBundleDisplayName</key>\n\t<string>FLYP Shop</string>'
    );
    
    // Ensure bundle ID is set (might be in project settings)
    fs.writeFileSync(infoPlistPath, infoPlist);
    console.log('   ✓ Updated Info.plist');
  }

  console.log('\n' + '━'.repeat(50));
  console.log('✅ iOS Customer App setup complete!\n');
  console.log('📍 Next steps:');
  console.log('   1. Run: npm run build:customer');
  console.log('   2. Run: npm run ios:customer');
  console.log('   3. Open ios-customer/App/App.xcworkspace in Xcode');
  console.log('   4. Select your device or simulator');
  console.log('   5. Click Run ▶️ to build and install\n');

} catch (error) {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
}
