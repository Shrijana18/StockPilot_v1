#!/usr/bin/env node

/**
 * Setup script for FLYP Employee iOS App
 * Creates ios-employee directory and configures it for employee app
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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
  const iosEmployeeDir = path.join(rootDir, 'ios-employee');
  
  // Check if ios-employee already exists
  if (fs.existsSync(iosEmployeeDir)) {
    console.log('\n⚠️  ios-employee directory already exists.');
    console.log('   If you want to recreate it, please delete it first:');
    console.log(`   rm -rf ${iosEmployeeDir}`);
    process.exit(0);
  }

  // Step 1: Temporarily update capacitor.config.json for employee app
  console.log('\n📝 Step 1: Preparing Capacitor config...');
  const capacitorConfigPath = path.join(rootDir, 'capacitor.config.json');
  const originalConfig = fs.existsSync(capacitorConfigPath) 
    ? fs.readFileSync(capacitorConfigPath, 'utf8')
    : null;

  const employeeConfig = {
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

  fs.writeFileSync(capacitorConfigPath, JSON.stringify(employeeConfig, null, 2));
  console.log('   ✓ Updated capacitor.config.json for employee app');

  // Step 2: Add iOS platform with employee bundle ID
  console.log('\n📱 Step 2: Creating iOS project...');
  
  // Check if ios directory exists (main app)
  const iosDir = path.join(rootDir, 'ios');
  if (fs.existsSync(iosDir)) {
    console.log('   ℹ️  Main ios directory exists. Creating ios-employee separately...');
    
    // Use Capacitor to add iOS, then rename it
    if (run('npx cap add ios')) {
      // Check if a new ios directory was created (it might not if one exists)
      // In that case, we'll need to create it manually
      if (fs.existsSync(iosDir)) {
        // Check if it's the same as before (by checking a unique file)
        const testFile = path.join(iosDir, 'App', 'App', 'Info.plist');
        if (fs.existsSync(testFile)) {
          const infoPlist = fs.readFileSync(testFile, 'utf8');
          // If it has the employee bundle ID, we're good
          if (infoPlist.includes('com.flypnow.employee')) {
            console.log('   ✓ iOS project created with employee bundle ID');
            // Rename to ios-employee
            if (fs.existsSync(iosDir) && !fs.existsSync(iosEmployeeDir)) {
              fs.renameSync(iosDir, iosEmployeeDir);
              console.log('   ✓ Renamed to ios-employee');
            }
          } else {
            // We need to create ios-employee manually
            console.log('   ℹ️  Creating ios-employee from template...');
            // Copy ios to ios-employee and modify
            fs.cpSync(iosDir, iosEmployeeDir, { recursive: true });
            console.log('   ✓ Copied ios to ios-employee');
            
            // Update bundle ID in project.pbxproj
            const pbxprojPath = path.join(iosEmployeeDir, 'App', 'App.xcodeproj', 'project.pbxproj');
            if (fs.existsSync(pbxprojPath)) {
              let pbxproj = fs.readFileSync(pbxprojPath, 'utf8');
              pbxproj = pbxproj.replace(/com\.flypnow\.ios/g, 'com.flypnow.employee');
              pbxproj = pbxproj.replace(/com\.flypnow\.shop/g, 'com.flypnow.employee');
              fs.writeFileSync(pbxprojPath, pbxproj);
              console.log('   ✓ Updated bundle ID in Xcode project');
            }
            
            // Update Info.plist
            const infoPlistPath = path.join(iosEmployeeDir, 'App', 'App', 'Info.plist');
            if (fs.existsSync(infoPlistPath)) {
              let infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
              infoPlist = infoPlist.replace(/<string>FLYP<\/string>/g, '<string>FLYP Employee</string>');
              infoPlist = infoPlist.replace(/<string>FLYP Shop<\/string>/g, '<string>FLYP Employee</string>');
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
      console.log('   3. Rename ios to ios-employee');
      console.log('   4. Rename ios-backup back to ios');
      console.log('   5. Update ios-employee/App/App.xcodeproj/project.pbxproj');
      console.log('      Replace com.flypnow.ios with com.flypnow.employee');
      console.log('   6. Update ios-employee/App/App/Info.plist');
      console.log('      Replace FLYP with FLYP Employee');
      process.exit(1);
    }
  } else {
    // No ios directory, can add directly
    if (run('npx cap add ios')) {
      // Rename to ios-employee
      if (fs.existsSync(iosDir)) {
        fs.renameSync(iosDir, iosEmployeeDir);
        console.log('   ✓ Created and renamed to ios-employee');
      }
    }
  }

  // Step 3: Restore original capacitor config
  if (originalConfig) {
    fs.writeFileSync(capacitorConfigPath, originalConfig);
    console.log('\n📝 Step 3: Restored original capacitor.config.json');
  }

  // Step 4: Update Info.plist with employee app details
  console.log('\n⚙️  Step 4: Configuring iOS app...');
  const infoPlistPath = path.join(iosEmployeeDir, 'App', 'App', 'Info.plist');
  if (fs.existsSync(infoPlistPath)) {
    let infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
    
    // Update display name
    infoPlist = infoPlist.replace(
      /<key>CFBundleDisplayName<\/key>\s*<string>.*?<\/string>/,
      '<key>CFBundleDisplayName</key>\n\t<string>FLYP Employee</string>'
    );
    
    // Ensure bundle ID is set (might be in project settings)
    fs.writeFileSync(infoPlistPath, infoPlist);
    console.log('   ✓ Updated Info.plist');
  }

  console.log('\n' + '━'.repeat(50));
  console.log('✅ iOS Employee App setup complete!\n');
  console.log('📍 Next steps:');
  console.log('   1. Run: npm run build:employee');
  console.log('   2. Run: npm run ios:employee');
  console.log('   3. Open ios-employee/App/App.xcworkspace in Xcode');
  console.log('   4. Select your device or simulator');
  console.log('   5. Click Run ▶️ to build and install\n');

} catch (error) {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
}
