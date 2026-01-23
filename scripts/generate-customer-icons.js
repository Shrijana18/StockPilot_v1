#!/usr/bin/env node

/**
 * Generate FLYP Shop app icons
 * Creates icons in various sizes for Android and PWA
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// SVG icon template for FLYP Shop (shopping cart icon with gradient)
const createIconSVG = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10B981"/>
      <stop offset="100%" style="stop-color:#14B8A6"/>
    </linearGradient>
    <linearGradient id="cartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFFFFF"/>
      <stop offset="100%" style="stop-color:#F0FDF4"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="512" height="512" rx="108" fill="url(#bgGradient)"/>
  
  <!-- Cart Icon -->
  <g transform="translate(100, 100) scale(1.2)">
    <!-- Cart body -->
    <path d="M40 60 L60 60 L65 80 M80 200 L220 200 L280 80 L65 80 M80 200 L60 80 M80 200 L50 240 C45 250 50 260 60 260 L220 260" 
          fill="none" 
          stroke="white" 
          stroke-width="24" 
          stroke-linecap="round" 
          stroke-linejoin="round"/>
    
    <!-- Cart wheels -->
    <circle cx="100" cy="300" r="28" fill="white"/>
    <circle cx="200" cy="300" r="28" fill="white"/>
    
    <!-- Speed lines -->
    <line x1="260" y1="100" x2="300" y2="100" stroke="white" stroke-width="12" stroke-linecap="round" opacity="0.7"/>
    <line x1="270" y1="140" x2="310" y2="140" stroke="white" stroke-width="12" stroke-linecap="round" opacity="0.5"/>
    <line x1="260" y1="180" x2="290" y2="180" stroke="white" stroke-width="12" stroke-linecap="round" opacity="0.3"/>
  </g>
</svg>`;

// Android icon sizes
const androidSizes = [
  { name: 'mdpi', size: 48 },
  { name: 'hdpi', size: 72 },
  { name: 'xhdpi', size: 96 },
  { name: 'xxhdpi', size: 144 },
  { name: 'xxxhdpi', size: 192 },
];

// PWA icon sizes
const pwaSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create directories
const publicAssetsDir = path.join(rootDir, 'public/assets');
const resourcesDir = path.join(rootDir, 'resources');

if (!fs.existsSync(publicAssetsDir)) {
  fs.mkdirSync(publicAssetsDir, { recursive: true });
}
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

console.log('🎨 Generating FLYP Shop icons...\n');

// Generate PWA icons
console.log('📱 PWA Icons:');
pwaSizes.forEach(size => {
  const svg = createIconSVG(size);
  const filename = `flyp_shop_icon_${size}.svg`;
  fs.writeFileSync(path.join(publicAssetsDir, filename), svg);
  console.log(`   ✓ ${filename}`);
});

// Generate main icon
const mainIcon = createIconSVG(512);
fs.writeFileSync(path.join(publicAssetsDir, 'flyp_shop_icon.svg'), mainIcon);
fs.writeFileSync(path.join(resourcesDir, 'icon-customer.svg'), mainIcon);
console.log('   ✓ flyp_shop_icon.svg (main)');

// Create splash screen SVG
const splashSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="2732" height="2732" viewBox="0 0 2732 2732" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="splashGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10B981"/>
      <stop offset="100%" style="stop-color:#14B8A6"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="2732" height="2732" fill="url(#splashGradient)"/>
  
  <!-- Center icon -->
  <g transform="translate(1016, 966)">
    ${createIconSVG(700).replace(/<\?xml.*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
  </g>
  
  <!-- App name -->
  <text x="1366" y="2000" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="120" 
        font-weight="700" 
        fill="white" 
        text-anchor="middle">
    FLYP Shop
  </text>
  
  <!-- Tagline -->
  <text x="1366" y="2120" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="48" 
        fill="rgba(255,255,255,0.8)" 
        text-anchor="middle">
    Quick delivery from local stores
  </text>
</svg>`;

fs.writeFileSync(path.join(resourcesDir, 'splash-customer.svg'), splashSVG);
console.log('\n🌅 Splash Screen:');
console.log('   ✓ splash-customer.svg');

console.log('\n✅ Icons generated successfully!');
console.log('\n📝 Note: To convert SVG to PNG, you can use:');
console.log('   - Online: svgtopng.com');
console.log('   - CLI: npm install -g svgexport && svgexport icon.svg icon.png');
console.log('   - Or Android Studio will auto-convert during build');
