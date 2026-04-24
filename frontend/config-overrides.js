const { override } = require('customize-cra');
const path = require('path');

module.exports = override(
  (config) => {
    // Add CSP headers to production build
    if (config.mode === 'production') {
      // Ensure HTML plugin has CSP meta tag
      const htmlWebpackPlugin = config.plugins.find(
        plugin => plugin.constructor.name === 'HtmlWebpackPlugin'
      );
      
      if (htmlWebpackPlugin) {
        htmlWebpackPlugin.userOptions = {
          ...htmlWebpackPlugin.userOptions,
          meta: {
            ...htmlWebpackPlugin.userOptions.meta,
            'Content-Security-Policy': {
              'http-equiv': 'Content-Security-Policy',
              content: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
                "img-src 'self' data: https: blob:",
                "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com data:",
                "connect-src 'self' wss: https://*.stellar.org https://horizon-testnet.stellar.org https://horizon-mainnet.stellar.org",
                "frame-src 'none'",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
                "upgrade-insecure-requests"
              ].join('; ')
            }
          }
        };
      }
    }

    // Configure module resolution for optimized images
    config.resolve.alias = {
      ...config.resolve.alias,
      '@images': path.resolve(__dirname, 'public/images'),
      '@optimized': path.resolve(__dirname, 'public/images/optimized')
    };

    // Add support for WebP in file loader
    const fileLoaderRule = config.module.rules.find(
      rule => rule.test && rule.test.toString().includes('png|jpg|jpeg|gif')
    );

    if (fileLoaderRule) {
      fileLoaderRule.test = /\.(png|jpe?g|gif|webp|svg)$/i;
    }

    // Add optimization for images in production
    if (config.mode === 'production') {
      const ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');
      const imagemin = require('imagemin');
      const imageminWebp = require('imagemin-webp');
      const imageminMozjpeg = require('imagemin-mozjpeg');
      const imageminPngquant = require('imagemin-pngquant');

      config.plugins.push(
        new ImageMinimizerPlugin({
          minimizer: [
            {
              implementation: ImageMinimizerPlugin.imageminMinify,
              options: {
                plugins: [
                  imageminWebp({ quality: 80 }),
                  imageminMozjpeg({ quality: 85 }),
                  imageminPngquant({ quality: [0.8, 0.9] })
                ]
              }
            }
          ],
          generator: [
            {
              type: 'asset',
              preset: 'webp-custom-name',
              filename: '[name].[hash].[ext]',
              minimizer: {
                implementation: ImageMinimizerPlugin.imageminGenerate,
                options: {
                  plugins: [['imagemin-webp', { quality: 80 }]]
                }
              }
            }
          ]
        })
      );
    }
    
    return config;
  }
);
