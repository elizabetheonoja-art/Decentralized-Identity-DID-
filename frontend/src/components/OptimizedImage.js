import React, { useState, useEffect, useRef } from 'react';
import { getResponsiveImage, checkWebPSupport, preloadImage } from '../utils/imageHelper';

const OptimizedImage = ({ 
  imageName, 
  alt, 
  className = '', 
  size = 'medium',
  lazy = true,
  placeholder = null,
  onLoad = null,
  onError = null 
}) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [webPSupported, setWebPSupported] = useState(true);
  const imageRef = useRef();

  useEffect(() => {
    // Check WebP support
    checkWebPSupport().then(supported => {
      setWebPSupported(supported);
    });
  }, []);

  useEffect(() => {
    if (!imageName) return;

    const format = webPSupported ? 'webp' : 'jpeg';
    const src = getResponsiveImage(imageName, size, format);

    if (lazy) {
      // Lazy loading with Intersection Observer
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              loadImage(src);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 }
      );

      if (imageRef.current) {
        observer.observe(imageRef.current);
      }

      return () => {
        if (imageRef.current) {
          observer.unobserve(imageRef.current);
        }
      };
    } else {
      loadImage(src);
    }
  }, [imageName, size, webPSupported, lazy]);

  const loadImage = async (src) => {
    try {
      await preloadImage(src);
      setImageSrc(src);
      setIsLoading(false);
      setHasError(false);
      onLoad?.();
    } catch (error) {
      console.error('Error loading image:', error);
      setHasError(true);
      setIsLoading(false);
      onError?.(error);
    }
  };

  // Generate responsive picture element for non-lazy images
  if (!lazy) {
    const baseName = imageName.split('.')[0];
    
    return (
      <picture className={className}>
        {/* WebP sources */}
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
        {/* Fallback JPEG sources */}
        <source
          srcSet={getResponsiveImage(baseName, 'small', 'jpeg')}
          media="(max-width: 320px)"
          type="image/jpeg"
        />
        <source
          srcSet={getResponsiveImage(baseName, 'medium', 'jpeg')}
          media="(max-width: 768px)"
          type="image/jpeg"
        />
        <source
          srcSet={getResponsiveImage(baseName, 'large', 'jpeg')}
          media="(max-width: 1024px)"
          type="image/jpeg"
        />
        <source
          srcSet={getResponsiveImage(baseName, 'xlarge', 'jpeg')}
          media="(min-width: 1025px)"
          type="image/jpeg"
        />
        <img
          src={getResponsiveImage(baseName, 'medium', 'jpeg')}
          alt={alt}
          className={className}
          loading="lazy"
          onLoad={onLoad}
          onError={onError}
        />
      </picture>
    );
  }

  // Lazy loading version
  return (
    <div className={`optimized-image-container ${className}`}>
      {isLoading && !hasError && (
        <div className="image-placeholder">
          {placeholder || (
            <div className="skeleton-loader" style={{
              width: '100%',
              height: '200px',
              background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
              backgroundSize: '200% 100%',
              animation: 'loading 1.5s infinite'
            }} />
          )}
        </div>
      )}
      
      {hasError ? (
        <div className="image-error">
          <span>Failed to load image</span>
        </div>
      ) : (
        <img
          ref={imageRef}
          src={imageSrc}
          alt={alt}
          className={`${className} ${isLoading ? 'hidden' : ''}`}
          onLoad={() => {
            setIsLoading(false);
            onLoad?.();
          }}
          onError={(error) => {
            setHasError(true);
            setIsLoading(false);
            onError?.(error);
          }}
        />
      )}
      
      <style jsx>{`
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        .optimized-image-container {
          position: relative;
        }
        
        .hidden {
          display: none;
        }
        
        .image-placeholder {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        
        .image-error {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 200px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          color: #666;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default OptimizedImage;
