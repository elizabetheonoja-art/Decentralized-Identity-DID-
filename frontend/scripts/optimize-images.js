const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const config = {
  inputDir: path.join(__dirname, '../public/images'),
  outputDir: path.join(__dirname, '../public/images/optimized'),
  qualities: {
    webp: 80,
    jpeg: 85,
    png: 90
  },
  sizes: [
    { name: 'small', width: 320 },
    { name: 'medium', width: 768 },
    { name: 'large', width: 1024 },
    { name: 'xlarge', width: 1920 }
  ]
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

// Supported formats
const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];

async function optimizeImage(inputPath, outputPath, format, quality, width) {
  try {
    const transformer = sharp(inputPath);
    
    if (width) {
      transformer.resize(width, null, {
        withoutEnlargement: true,
        fit: 'inside'
      });
    }

    const options = {
      jpeg: { quality, progressive: true },
      png: { quality, compressionLevel: 9, progressive: true },
      webp: { quality, effort: 6 }
    };

    await transformer.toFormat(format, options[format]).toFile(outputPath);
    
    const inputStats = fs.statSync(inputPath);
    const outputStats = fs.statSync(outputPath);
    const savings = ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(2);
    
    console.log(`✓ ${path.basename(inputPath)} -> ${path.basename(outputPath)} (${savings}% smaller)`);
    return true;
  } catch (error) {
    console.error(`✗ Error optimizing ${inputPath}:`, error.message);
    return false;
  }
}

async function processImages() {
  console.log('🖼️  Starting image optimization...\n');
  
  if (!fs.existsSync(config.inputDir)) {
    console.log('❌ Input directory not found:', config.inputDir);
    console.log('💡 Create the directory and add some images to optimize.');
    return;
  }

  const files = fs.readdirSync(config.inputDir);
  const imageFiles = files.filter(file => 
    supportedFormats.includes(path.extname(file).toLowerCase())
  );

  if (imageFiles.length === 0) {
    console.log('❌ No supported image files found in:', config.inputDir);
    return;
  }

  console.log(`📁 Found ${imageFiles.length} image(s) to optimize\n`);

  let successCount = 0;
  let totalSavings = 0;

  for (const file of imageFiles) {
    const inputPath = path.join(config.inputDir, file);
    const baseName = path.parse(file).name;
    
    console.log(`\n🔄 Processing: ${file}`);
    
    // Create size-specific directories
    for (const size of config.sizes) {
      const sizeDir = path.join(config.outputDir, size.name);
      if (!fs.existsSync(sizeDir)) {
        fs.mkdirSync(sizeDir, { recursive: true });
      }
      
      // Generate WebP version
      const webpPath = path.join(sizeDir, `${baseName}.webp`);
      const webpSuccess = await optimizeImage(
        inputPath, 
        webpPath, 
        'webp', 
        config.qualities.webp, 
        size.width
      );
      
      if (webpSuccess) {
        const inputStats = fs.statSync(inputPath);
        const outputStats = fs.statSync(webpPath);
        totalSavings += (inputStats.size - outputStats.size);
        successCount++;
      }
      
      // Generate fallback format (JPEG for most, PNG for transparency)
      const fallbackFormat = file.toLowerCase().includes('.png') ? 'png' : 'jpeg';
      const fallbackPath = path.join(sizeDir, `${baseName}.${fallbackFormat}`);
      const fallbackSuccess = await optimizeImage(
        inputPath,
        fallbackPath,
        fallbackFormat,
        config.qualities[fallbackFormat],
        size.width
      );
      
      if (fallbackSuccess) {
        const inputStats = fs.statSync(inputPath);
        const outputStats = fs.statSync(fallbackPath);
        totalSavings += (inputStats.size - outputStats.size);
        successCount++;
      }
    }
  }

  console.log('\n📊 Optimization Summary:');
  console.log(`✅ Successfully optimized: ${successCount} files`);
  console.log(`💾 Total space saved: ${(totalSavings / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📂 Output directory: ${config.outputDir}`);
}

// Generate responsive image helper
function generateResponsiveImageHelper() {
  const helperCode = `
// Responsive Image Helper
export const getResponsiveImage = (imageName, size = 'medium', format = 'webp') => {
  return \`/images/optimized/\${size}/\${imageName.split('.')[0]}.\${format}\`;
};

export const getPictureElement = (imageName, alt, className = '') => {
  const baseName = imageName.split('.')[0];
  
  return (
    <picture className={className}>
      <source
        srcSet={getResponsiveImage(baseName, 'small', 'webp')}
        media="(max-width: 320px)"
        type="image/webp"
      />
      <source
        srcSet={getResponsiveImage(baseName, 'medium', 'webp')}
        media="(max-width: 768px)"
        type="image/webp"
      />
      <source
        srcSet={getResponsiveImage(baseName, 'large', 'webp')}
        media="(max-width: 1024px)"
        type="image/webp"
      />
      <source
        srcSet={getResponsiveImage(baseName, 'xlarge', 'webp')}
        media="(min-width: 1025px)"
        type="image/webp"
      />
      {/* Fallback for browsers that don't support WebP */}
      <img
        src={getResponsiveImage(baseName, 'medium', 'jpeg')}
        alt={alt}
        loading="lazy"
      />
    </picture>
  );
};
`;

  const helperPath = path.join(__dirname, '../src/utils/imageHelper.js');
  fs.writeFileSync(helperPath, helperCode);
  console.log('📝 Created responsive image helper:', helperPath);
}

// CLI execution
if (require.main === module) {
  processImages()
    .then(() => {
      generateResponsiveImageHelper();
      console.log('\n🎉 Image optimization completed!');
    })
    .catch(console.error);
}

module.exports = { processImages, generateResponsiveImageHelper };