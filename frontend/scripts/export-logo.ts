#!/usr/bin/env tsx
/**
 * Export RefyneMark SVG logo to PNG
 *
 * Renders the RefyneMark logo SVG to a 200x200 PNG file.
 */

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const svgContent = `<svg width="200" height="200" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="28" height="28" rx="7" fill="url(#rmark)"/>
  <path d="M9 8.5h5.5c2.2 0 3.5 1.2 3.5 3s-1.3 3-3.5 3H9V8.5z"
    stroke="rgba(255,255,255,0.9)" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M9 14.5l6 5" stroke="rgba(255,255,255,0.9)"
    stroke-width="1.6" stroke-linecap="round"/>
  <defs>
    <linearGradient id="rmark" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
      <stop stop-color="#818CF8"/>
      <stop offset="1" stop-color="#4338CA"/>
    </linearGradient>
  </defs>
</svg>`;

async function exportLogo() {
  const outputPaths = [
    '/mnt/user-data/outputs/refyne-logo-200.png',
    'scripts/refyne-logo-200.png',
  ];

  console.log('Rendering RefyneMark logo to PNG...');

  try {
    // Convert SVG to PNG using sharp
    const pngBuffer = await sharp(Buffer.from(svgContent))
      .resize(200, 200)
      .png()
      .toBuffer();

    // Write to all output paths
    for (const outputPath of outputPaths) {
      try {
        // Ensure output directory exists
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, pngBuffer);
        console.log(`✅ Logo exported to: ${outputPath}`);
      } catch (err) {
        console.log(`⚠️  Skipped: ${outputPath} (${(err as Error).message})`);
      }
    }

    console.log(`   Size: 200x200px`);
    console.log(`   Format: PNG`);
  } catch (error) {
    console.error('❌ Failed to export logo:', error);
    process.exit(1);
  }
}

exportLogo();
