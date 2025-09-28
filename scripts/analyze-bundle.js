/**
 * T061: Bundle size analysis script
 * Analyzes build output to ensure optimal bundle sizes
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const DIST_DIR = './dist';
const MAX_CHUNK_SIZE = 1024 * 1024; // 1MB
const MAX_TOTAL_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Analyze directory recursively
 */
function analyzeDirectory(dir, results = { files: [], totalSize: 0 }) {
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        analyzeDirectory(fullPath, results);
      } else {
        const size = stat.size;
        results.files.push({
          path: fullPath.replace('./dist/', ''),
          size: size,
          formatted: formatBytes(size)
        });
        results.totalSize += size;
      }
    }
  } catch (error) {
    console.warn(`Could not analyze directory ${dir}:`, error.message);
  }
  
  return results;
}

/**
 * Main analysis function
 */
function analyzeBuild() {
  console.log('🔍 Analyzing bundle size...\n');
  
  const results = analyzeDirectory(DIST_DIR);
  
  if (results.files.length === 0) {
    console.error('❌ No build files found. Run `npm run build` first.');
    process.exit(1);
  }
  
  // Sort files by size (largest first)
  results.files.sort((a, b) => b.size - a.size);
  
  console.log('📊 Bundle Analysis Results');
  console.log('==========================\n');
  
  // Show total size
  console.log(`📦 Total bundle size: ${formatBytes(results.totalSize)}`);
  console.log(`🎯 Target: < ${formatBytes(MAX_TOTAL_SIZE)}`);
  console.log(`${results.totalSize > MAX_TOTAL_SIZE ? '❌' : '✅'} ${results.totalSize > MAX_TOTAL_SIZE ? 'OVER LIMIT' : 'Within limits'}\n`);
  
  // Show largest files
  console.log('📋 Largest files:');
  const topFiles = results.files.slice(0, 15);
  topFiles.forEach((file, index) => {
    const warning = file.size > MAX_CHUNK_SIZE ? ' ⚠️' : '';
    console.log(`${(index + 1).toString().padStart(2)}. ${file.formatted.padEnd(10)} ${file.path}${warning}`);
  });
  
  // Categorize files
  const categories = {
    javascript: results.files.filter(f => f.path.endsWith('.js')),
    css: results.files.filter(f => f.path.endsWith('.css')),
    images: results.files.filter(f => /\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(f.path)),
    fonts: results.files.filter(f => /\.(woff|woff2|ttf|otf|eot)$/i.test(f.path)),
    html: results.files.filter(f => f.path.endsWith('.html')),
    other: results.files.filter(f => 
      !f.path.endsWith('.js') && 
      !f.path.endsWith('.css') && 
      !f.path.endsWith('.html') &&
      !/\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|eot)$/i.test(f.path)
    )
  };
  
  console.log('\n📈 Size by category:');
  Object.entries(categories).forEach(([category, files]) => {
    if (files.length > 0) {
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      const percentage = ((totalSize / results.totalSize) * 100).toFixed(1);
      console.log(`  ${category.padEnd(12)}: ${formatBytes(totalSize).padEnd(10)} (${percentage}%) - ${files.length} files`);
    }
  });
  
  // Check for potential issues
  console.log('\n🔍 Potential optimizations:');
  const largeChunks = results.files.filter(f => f.size > MAX_CHUNK_SIZE);
  if (largeChunks.length > 0) {
    console.log(`⚠️  ${largeChunks.length} files are larger than ${formatBytes(MAX_CHUNK_SIZE)}:`);
    largeChunks.forEach(file => {
      console.log(`   - ${file.path}: ${file.formatted}`);
    });
  }
  
  const duplicateNames = {};
  results.files.forEach(file => {
    const name = file.path.split('/').pop()?.replace(/-[a-f0-9]+\.(js|css)$/, '.$1');
    if (name) {
      duplicateNames[name] = (duplicateNames[name] || 0) + 1;
    }
  });
  
  const duplicates = Object.entries(duplicateNames).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('\n🔄 Potential duplicate chunks:');
    duplicates.forEach(([name, count]) => {
      console.log(`   - ${name}: ${count} variations`);
    });
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (results.totalSize > MAX_TOTAL_SIZE) {
    console.log('   - Consider lazy loading for non-critical features');
    console.log('   - Implement dynamic imports for large dependencies');
    console.log('   - Use CDN for large libraries if possible');
  }
  
  if (largeChunks.length > 0) {
    console.log('   - Split large chunks using dynamic imports');
    console.log('   - Consider code splitting for vendor libraries');
  }
  
  const jsSize = categories.javascript.reduce((sum, f) => sum + f.size, 0);
  const cssSize = categories.css.reduce((sum, f) => sum + f.size, 0);
  
  if (jsSize > cssSize * 5) {
    console.log('   - JavaScript bundle is significantly larger than CSS');
    console.log('   - Consider removing unused JavaScript code');
  }
  
  console.log('\n✅ Analysis complete!');
  
  // Exit with error if over size limits
  if (results.totalSize > MAX_TOTAL_SIZE) {
    console.log('\n❌ Bundle size exceeds limits');
    process.exit(1);
  }
}

// Run analysis
analyzeBuild();