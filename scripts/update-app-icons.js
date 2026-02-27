#!/usr/bin/env node

/**
 * Update App Icons for all FLYP apps
 * Generates Android and iOS icons from source images
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Icon configurations – zoom tuned to fill icon and eliminate blue border on edges.
const iconConfigs = {
  main: {
    source: (() => {
      const png = path.join(rootDir, 'public/assets/FLYP(icon).png');
      const jpg = path.join(rootDir, 'public/assets/FLYP(icon).jpg');
      return fs.existsSync(png) ? png : jpg;
    })(),
    android: 'android/app/src/main/res',
    ios: 'ios/App/App/Assets.xcassets/AppIcon.appiconset',
    name: 'FLYP - Business (main)',
    iconZoom: 1.52 // Slightly more zoom to remove blue border
  },
  employee: {
    source: path.join(rootDir, 'public/assets/DELIVERY.png'),
    android: 'android-employee/app/src/main/res',
    ios: 'ios-employee/App/App/Assets.xcassets/AppIcon.appiconset',
    name: 'FLYP - Delivery (employee)',
    iconZoom: 1.52 // Slightly more zoom to remove thin blue border around icon
  },
  customer: {
    source: path.join(rootDir, 'public/assets/FLYP_SHOP.png'),
    android: 'android-customer/app/src/main/res',
    ios: 'ios-customer/App/App/Assets.xcassets/AppIcon.appiconset',
    name: 'FLYP (customer)',
    iconZoom: 1.52 // Slightly more zoom to remove blue border
  }
};

// Android icon sizes (mipmap folders)
const androidSizes = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 }
];

// iOS icon sizes
const iosSizes = [
  { name: 'AppIcon-1024.png', size: 1024 },
  { name: 'AppIcon-512@2x.png', size: 1024 } // 512@2x = 1024
];

/**
 * Generate Android icons
 * Uses SOURCE image dimensions for zoom so center crop is truly zoomed (removes blue border).
 */
async function generateAndroidIcons(config) {
  const androidResDir = path.join(rootDir, config.android);
  
  console.log(`\n📱 Generating Android icons for ${config.name}...`);
  
  if (!fs.existsSync(config.source)) {
    console.error(`   ❌ Source image not found: ${config.source}`);
    return false;
  }

  const meta = await sharp(config.source).metadata();
  const sourceDim = Math.max(meta.width || 1024, meta.height || 1024);
  const zoom = config.iconZoom || 1;
  const scaledSize = zoom > 1 ? Math.ceil(sourceDim * zoom) : sourceDim;
  
  // Generate icons for each mipmap folder
  for (const { folder, size } of androidSizes) {
    const mipmapDir = path.join(androidResDir, folder);
    
    if (!fs.existsSync(mipmapDir)) {
      console.error(`   ❌ Mipmap folder not found: ${mipmapDir}`);
      continue;
    }
    
    const extractOpt = zoom > 1 && scaledSize > size
      ? { left: Math.round((scaledSize - size) / 2), top: Math.round((scaledSize - size) / 2), width: size, height: size }
      : null;
    const resizeAndMaybeCrop = (s) => {
      let p = sharp(config.source).resize(scaledSize, scaledSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
      if (extractOpt) p = p.extract(extractOpt); else if (scaledSize !== size) p = p.resize(size, size);
      return p.png().toFile(s);
    };

    // Generate ic_launcher.png
    const launcherPath = path.join(mipmapDir, 'ic_launcher.png');
    await resizeAndMaybeCrop(launcherPath);
    
    // Generate ic_launcher_round.png (same as regular)
    const roundPath = path.join(mipmapDir, 'ic_launcher_round.png');
    await resizeAndMaybeCrop(roundPath);
    
    // Generate ic_launcher_foreground.png (for adaptive icons)
    const foregroundPath = path.join(mipmapDir, 'ic_launcher_foreground.png');
    await resizeAndMaybeCrop(foregroundPath);
    
    // Generate ic_launcher_background.png (transparent or solid color)
    const backgroundPath = path.join(mipmapDir, 'ic_launcher_background.png');
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      }
    })
      .png()
      .toFile(backgroundPath);
    
    console.log(`   ✓ ${folder}/ic_launcher.png (${size}x${size})`);
  }
  
  // Generate Play Store icon (512x512) in xxxhdpi – use same source-based zoom
  const playStoreScaled = zoom > 1 ? Math.ceil(sourceDim * zoom) : 512;
  const playStoreExtract = zoom > 1 && playStoreScaled > 512
    ? { left: Math.round((playStoreScaled - 512) / 2), top: Math.round((playStoreScaled - 512) / 2), width: 512, height: 512 }
    : null;
  let playStorePipe = sharp(config.source).resize(playStoreScaled, playStoreScaled, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (playStoreExtract) playStorePipe = playStorePipe.extract(playStoreExtract); else if (playStoreScaled !== 512) playStorePipe = playStorePipe.resize(512, 512);
  await playStorePipe.png().toFile(path.join(androidResDir, 'mipmap-xxxhdpi', 'ic_launcher_play_store.png'));
  console.log(`   ✓ mipmap-xxxhdpi/ic_launcher_play_store.png (512x512)`);
  
  return true;
}

/**
 * Generate iOS icons
 * Uses SOURCE image dimensions for zoom so center crop is truly zoomed (removes blue border).
 */
async function generateIOSIcons(config) {
  const iosIconDir = path.join(rootDir, config.ios);
  
  console.log(`\n🍎 Generating iOS icons for ${config.name}...`);
  
  if (!fs.existsSync(config.source)) {
    console.error(`   ❌ Source image not found: ${config.source}`);
    return false;
  }
  if (!fs.existsSync(iosIconDir)) {
    console.error(`   ❌ iOS icon directory not found: ${iosIconDir}`);
    return false;
  }

  const meta = await sharp(config.source).metadata();
  const sourceDim = Math.max(meta.width || 1024, meta.height || 1024);
  const zoom = config.iconZoom || 1;
  const scaledSize = zoom > 1 ? Math.ceil(sourceDim * zoom) : sourceDim;

  for (const { name, size } of iosSizes) {
    const iconPath = path.join(iosIconDir, name);
    const ext = zoom > 1 && scaledSize > size
      ? { left: Math.round((scaledSize - size) / 2), top: Math.round((scaledSize - size) / 2), width: size, height: size }
      : null;
    let pipe = sharp(config.source).resize(scaledSize, scaledSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    if (ext) pipe = pipe.extract(ext); else if (scaledSize !== size) pipe = pipe.resize(size, size);
    await pipe.png().toFile(iconPath);
    console.log(`   ✓ ${name} (${size}x${size})${zoom > 1 ? ` zoom ${zoom}x (source ${sourceDim}→${scaledSize})` : ''}`);
  }
  
  return true;
}

/**
 * Main function
 */
async function main() {
  console.log('🎨 FLYP App Icon Generator');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  for (const [key, config] of Object.entries(iconConfigs)) {
    console.log(`\n📦 Processing ${config.name}...`);
    
    // Generate Android icons
    const androidSuccess = await generateAndroidIcons(config);
    
    // Generate iOS icons
    const iosSuccess = await generateIOSIcons(config);
    
    if (androidSuccess && iosSuccess) {
      console.log(`\n✅ ${config.name} icons generated successfully!`);
    } else {
      console.log(`\n⚠️  ${config.name} icons generation had issues.`);
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All app icons updated successfully!');
  console.log('\n📝 Next steps:');
  console.log('   • Rebuild Android apps to see new icons');
  console.log('   • Rebuild iOS apps in Xcode to see new icons');
  console.log('   • Icons will appear after app reinstall');
}

// Run the script
main().catch(error => {
  console.error('❌ Error generating icons:', error);
  process.exit(1);
});
