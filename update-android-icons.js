#!/usr/bin/env node

/**
 * Script to generate Android adaptive icons from the new FLYP app icon
 * Android adaptive icons: 108dp canvas, safe zone is center 66% (17% padding on all sides)
 */

import sharp from 'sharp';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const densities = {
  ldpi: { canvas: 81, safe: 54 },
  mdpi: { canvas: 108, safe: 72 },
  hdpi: { canvas: 162, safe: 108 },
  xhdpi: { canvas: 216, safe: 144 },
  xxhdpi: { canvas: 324, safe: 216 },
  xxxhdpi: { canvas: 432, safe: 288 }
};

const referenceIcon = path.join(__dirname, 'public/assets/3339_101125_FLYP_BS-png-04 (2).png');
const sourceIcon = path.join(__dirname, 'public/assets/flyp_app_icon.png');
const resDir = path.join(__dirname, 'android/app/src/main/res');

console.log('🎨 Generating Android adaptive icons from reference FLYP icon...\n');

// Check if reference icon exists
if (!fs.existsSync(referenceIcon)) {
  console.error(`❌ Reference icon not found: ${referenceIcon}`);
  process.exit(1);
}

console.log(`✅ Reference icon found: ${referenceIcon}`);

async function generateIcons() {
  try {
    // First, prepare the source icon: resize reference to 1024x1024 for consistency
    console.log('📐 Preparing source icon (1024x1024)...');
    await sharp(referenceIcon)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(sourceIcon);
    console.log(`✅ Source icon prepared: ${sourceIcon}\n`);
    
    for (const [density, sizes] of Object.entries(densities)) {
      const { canvas, safe } = sizes;
      const padding = Math.round((canvas - safe) / 2);
      
      const mipmapDir = path.join(resDir, `mipmap-${density}`);
      
      // Ensure directory exists
      if (!fs.existsSync(mipmapDir)) {
        fs.mkdirSync(mipmapDir, { recursive: true });
      }
      
      const fgPath = path.join(mipmapDir, 'ic_launcher_foreground.png');
      const bgPath = path.join(mipmapDir, 'ic_launcher_background.png');
      
      // Create foreground: Use the full icon (with green background + F design)
      // Resize to safe zone size, then pad to canvas with transparent padding
      // This ensures the icon stays within the safe zone while maintaining aspect ratio
      await sharp(sourceIcon)
        .resize(safe, safe, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(fgPath);
      
      // Create background: Use a matching green color from the icon's gradient
      // This provides a seamless background for the adaptive icon
      const bgColor = '#4CAF50'; // Main green color matching the icon
      await sharp({
        create: {
          width: canvas,
          height: canvas,
          channels: 4,
          background: { r: 76, g: 175, b: 80, alpha: 1 } // #4CAF50
        }
      })
        .png()
        .toFile(bgPath);
      
      console.log(`✅ ${density}: Canvas ${canvas}x${canvas}, Icon ${safe}x${safe} (safe zone)`);
    }
    
    console.log('\n✅ All Android adaptive icons generated successfully!');
    console.log('📦 Ready to build .aab file');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();

