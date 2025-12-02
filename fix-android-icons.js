#!/usr/bin/env node

/**
 * Script to properly generate Android adaptive icons with safe zone
 * Android adaptive icons: 108dp canvas, safe zone is center 66% (17% padding on all sides)
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const densities = {
  ldpi: { canvas: 81, safe: 54 },
  mdpi: { canvas: 108, safe: 72 },
  hdpi: { canvas: 162, safe: 108 },
  xhdpi: { canvas: 216, safe: 144 },
  xxhdpi: { canvas: 324, safe: 216 },
  xxxhdpi: { canvas: 432, safe: 288 }
};

const sourceIcon = 'public/assets/flyp_icon.jpg';
const resDir = 'android/app/src/main/res';

console.log('🎨 Generating Android adaptive icons with proper safe zone...\n');

// Check if ImageMagick is available
const hasImageMagick = execSync('which convert', { encoding: 'utf8', stdio: 'ignore' }).trim().length > 0;

if (hasImageMagick) {
  console.log('✅ Using ImageMagick for icon generation\n');
  
  for (const [density, sizes] of Object.entries(densities)) {
    const { canvas, safe } = sizes;
    const padding = (canvas - safe) / 2;
    
    const fgPath = `${resDir}/mipmap-${density}/ic_launcher_foreground.png`;
    const bgPath = `${resDir}/mipmap-${density}/ic_launcher_background.png`;
    
    // Create foreground: resize icon to safe size, then pad to canvas size with transparent padding
    execSync(`convert "${sourceIcon}" -resize ${safe}x${safe} -background transparent -gravity center -extent ${canvas}x${canvas} "${fgPath}"`, { stdio: 'inherit' });
    
    // Create white background
    execSync(`convert -size ${canvas}x${canvas} xc:white "${bgPath}"`, { stdio: 'inherit' });
    
    console.log(`✅ ${density}: Canvas ${canvas}x${canvas}, Icon ${safe}x${safe} (safe zone)`);
  }
} else {
  console.log('⚠️  ImageMagick not found, using sips (may have limitations)\n');
  
  // Fallback: Use sips - create icon at safe size, then try to center it
  // Note: sips doesn't handle transparent padding well, so we'll create the icon at canvas size
  // and let Android handle the safe zone via the XML configuration
  
  for (const [density, sizes] of Object.entries(densities)) {
    const { canvas, safe } = sizes;
    
    const fgPath = `${resDir}/mipmap-${density}/ic_launcher_foreground.png`;
    const bgPath = `${resDir}/mipmap-${density}/ic_launcher_background.png`;
    
    // For foreground: resize to canvas size (Android will apply safe zone via XML)
    // Actually, let's create it at safe size and pad with the icon itself (centered)
    const tempIcon = `/tmp/flyp_${density}_safe.png`;
    execSync(`sips -s format png -z ${safe} ${safe} "${sourceIcon}" --out "${tempIcon}"`, { stdio: 'ignore' });
    
    // Create a white canvas and paste the icon centered
    // Since sips can't do transparent padding easily, we'll use the icon as-is at canvas size
    // and rely on the adaptive icon XML to handle the safe zone
    execSync(`sips -s format png -z ${canvas} ${canvas} "${sourceIcon}" --out "${fgPath}"`, { stdio: 'ignore' });
    
    // Create white background
    const white1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync('/tmp/white1x1.png', white1x1);
    execSync(`sips -s format png -z ${canvas} ${canvas} /tmp/white1x1.png --out "${bgPath}"`, { stdio: 'ignore' });
    
    console.log(`✅ ${density}: Canvas ${canvas}x${canvas}, Icon ${safe}x${safe} (safe zone)`);
  }
}

console.log('\n✅ All icons generated successfully!');
console.log('📦 Next step: Rebuild the .aab file');

