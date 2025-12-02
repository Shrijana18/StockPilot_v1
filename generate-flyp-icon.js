#!/usr/bin/env node

/**
 * Generate FLYP app icon matching the reference design:
 * - Square with rounded corners
 * - Green gradient (brighter in center, darker at edges)
 * - Dark blue abstract "F" design with circuit board aesthetic
 * - Three circular nodes (top-left, center, bottom-right)
 * Based on reference: 3339_101125_FLYP_BS-png-04 (2).png
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const size = 1024; // High resolution for app icon
const cornerRadius = size * 0.15; // 15% corner radius for rounded corners
const padding = size * 0.15; // 15% padding for safe zone

// Calculate positions for the "F" design based on reference
// Top bar extends from left edge towards right, stopping short
const topBarX = padding * 0.75;
const topBarY = padding * 1.25;
const topBarWidth = size * 0.6;
const topBarHeight = size * 0.085;
// Center point where diagonals meet
const centerX = size * 0.42;
const centerY = size * 0.48;
// Middle bar from center towards right
const middleBarY = centerY - topBarHeight / 2;
const middleBarWidth = size * 0.5;
// Bottom section
const bottomY = size * 0.72;
// Node sizes
const nodeSize = size * 0.04;
const centerNodeSize = size * 0.055;
const strokeWidth = size * 0.065;

// Create SVG for the icon
const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Green gradient: brighter in center, darker at edges -->
    <radialGradient id="greenGradient" cx="50%" cy="50%" r="75%">
      <stop offset="0%" style="stop-color:#66BB6A;stop-opacity:1" />
      <stop offset="40%" style="stop-color:#4CAF50;stop-opacity:1" />
      <stop offset="70%" style="stop-color:#2E7D32;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1B5E20;stop-opacity:1" />
    </radialGradient>
    
    <!-- Rounded rectangle mask -->
    <clipPath id="roundedRect">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}"/>
    </clipPath>
  </defs>
  
  <!-- Background with green gradient -->
  <rect width="${size}" height="${size}" fill="url(#greenGradient)" clip-path="url(#roundedRect)"/>
  
  <!-- Dark blue "F" design with circuit board aesthetic -->
  <!-- Using dark blue (#1565C0 - Material Blue 700) instead of black -->
  
  <!-- Top horizontal bar (extends from left edge towards right, stopping short) -->
  <rect x="${topBarX}" y="${topBarY}" width="${topBarWidth}" height="${topBarHeight}" fill="#1565C0" rx="${size * 0.02}"/>
  
  <!-- Top-left node (at top-left corner of the design) -->
  <circle cx="${topBarX + size * 0.025}" cy="${topBarY + topBarHeight / 2}" r="${nodeSize}" fill="#1565C0"/>
  
  <!-- Diagonal line from top-left area to center (forms triangular shape) -->
  <path d="M ${topBarX + size * 0.025} ${topBarY + topBarHeight / 2} L ${centerX} ${centerY}" 
        stroke="#1565C0" 
        stroke-width="${strokeWidth}" 
        stroke-linecap="round" 
        fill="none"/>
  
  <!-- Central node (larger, at the convergence point) -->
  <circle cx="${centerX}" cy="${centerY}" r="${centerNodeSize}" fill="#1565C0"/>
  
  <!-- Middle horizontal bar (from center towards right, stopping short) -->
  <rect x="${centerX}" y="${middleBarY}" width="${middleBarWidth}" height="${topBarHeight}" fill="#1565C0" rx="${size * 0.02}"/>
  
  <!-- Bottom triangular section: from center down and left, then horizontal to right -->
  <path d="M ${centerX} ${centerY + centerNodeSize} 
           L ${centerX - size * 0.07} ${bottomY} 
           L ${size - padding * 1.25} ${bottomY}" 
        stroke="#1565C0" 
        stroke-width="${strokeWidth}" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        fill="none"/>
  
  <!-- Bottom-right node -->
  <circle cx="${size - padding * 1.25}" cy="${bottomY}" r="${nodeSize}" fill="#1565C0"/>
</svg>
`;

async function generateIcon() {
  try {
    console.log('🎨 Generating FLYP app icon...');
    
    // Convert SVG to PNG
    const outputPath = path.join(__dirname, 'public/assets/flyp_app_icon.png');
    
    await sharp(Buffer.from(svg))
      .png()
      .resize(size, size)
      .toFile(outputPath);
    
    console.log(`✅ Icon generated successfully at: ${outputPath}`);
    console.log(`📐 Size: ${size}x${size}px`);
    
    // Verify the file was created
    const stats = fs.statSync(outputPath);
    console.log(`📦 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error('❌ Error generating icon:', error);
    process.exit(1);
  }
}

generateIcon();

