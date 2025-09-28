/**
 * T064: Image and Font Compression Utilities
 * Handles optimization and compression for static assets
 */

/**
 * Image optimization utilities
 */
export class ImageOptimizer {
  private static readonly SUPPORTED_FORMATS = {
    webp: { quality: 80, format: 'webp' },
    avif: { quality: 75, format: 'avif' },
    jpg: { quality: 85, format: 'jpeg' },
    png: { quality: 90, format: 'png' }
  };

  private static readonly RESPONSIVE_SIZES = [320, 480, 768, 1024, 1200, 1440, 1920];

  /**
   * Generate responsive image configuration
   */
  static generateResponsiveConfig(originalPath: string, alt: string = '') {
    const basename = originalPath.split('/').pop()?.split('.')[0] || 'image';
    
    return {
      // Modern formats first
      sources: [
        {
          srcset: this.RESPONSIVE_SIZES
            .map(size => `/optimized/${basename}-${size}w.webp ${size}w`)
            .join(', '),
          type: 'image/webp',
          sizes: '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
        },
        {
          srcset: this.RESPONSIVE_SIZES
            .map(size => `/optimized/${basename}-${size}w.avif ${size}w`)
            .join(', '),
          type: 'image/avif',
          sizes: '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
        }
      ],
      // Fallback
      img: {
        src: `/optimized/${basename}-768w.jpg`,
        srcset: this.RESPONSIVE_SIZES
          .map(size => `/optimized/${basename}-${size}w.jpg ${size}w`)
          .join(', '),
        sizes: '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw',
        alt,
        loading: 'lazy' as const,
        decoding: 'async' as const
      }
    };
  }

  /**
   * Generate critical image configuration (above-the-fold)
   */
  static generateCriticalConfig(originalPath: string, alt: string = '') {
    const basename = originalPath.split('/').pop()?.split('.')[0] || 'image';
    
    return {
      ...this.generateResponsiveConfig(originalPath, alt),
      img: {
        ...this.generateResponsiveConfig(originalPath, alt).img,
        loading: 'eager' as const,
        fetchpriority: 'high' as const
      }
    };
  }

  /**
   * Generate image preload links for critical images
   */
  static generatePreloadLink(imagePath: string, format: 'webp' | 'avif' | 'jpg' = 'webp'): string {
    const basename = imagePath.split('/').pop()?.split('.')[0] || 'image';
    
    return `<link rel="preload" as="image" href="/optimized/${basename}-768w.${format}" type="image/${format}">`;
  }

  /**
   * Lazy loading observer setup
   */
  static getLazyLoadScript(): string {
    return `
      <script>
        if ('IntersectionObserver' in window) {
          const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                  img.src = img.dataset.src;
                  img.removeAttribute('data-src');
                }
                if (img.dataset.srcset) {
                  img.srcset = img.dataset.srcset;
                  img.removeAttribute('data-srcset');
                }
                img.classList.remove('lazy');
                observer.unobserve(img);
              }
            });
          });

          document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
          });
        }
      </script>
    `;
  }
}

/**
 * Font optimization utilities
 */
export class FontOptimizer {
  private static readonly FONT_STRATEGIES = {
    // Critical fonts - load immediately
    critical: {
      display: 'block',
      preload: true,
      prefetch: false
    },
    // Important fonts - load with swap
    important: {
      display: 'swap',
      preload: true,
      prefetch: false
    },
    // Optional fonts - load when convenient
    optional: {
      display: 'optional',
      preload: false,
      prefetch: true
    }
  };

  /**
   * Generate font face CSS with optimization
   */
  static generateFontFace(
    family: string,
    src: string,
    weight: number | string = 400,
    style: string = 'normal',
    display: 'block' | 'swap' | 'fallback' | 'optional' = 'swap'
  ): string {
    return `
      @font-face {
        font-family: '${family}';
        src: url('${src}.woff2') format('woff2'),
             url('${src}.woff') format('woff');
        font-weight: ${weight};
        font-style: ${style};
        font-display: ${display};
        unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
      }
    `;
  }

  /**
   * Generate preload links for critical fonts
   */
  static generatePreloadLinks(fonts: Array<{ href: string; type?: string }>): string {
    return fonts
      .map(font => 
        `<link rel="preload" href="${font.href}" as="font" type="${font.type || 'font/woff2'}" crossorigin>`
      )
      .join('\n');
  }

  /**
   * Generate font fallback CSS
   */
  static generateFallbackCSS(): string {
    return `
      /* Font fallback optimizations */
      .font-mono {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-optical-sizing: auto;
      }
      
      .font-sans {
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-optical-sizing: auto;
      }
      
      /* Prevent layout shift during font loading */
      .font-loading {
        visibility: hidden;
      }
      
      .font-loaded .font-loading {
        visibility: visible;
      }
      
      /* Size adjust for better font metrics matching */
      @font-face {
        font-family: 'fallback-sans';
        size-adjust: 94%;
        ascent-override: 110%;
        src: local('Arial');
      }
    `;
  }

  /**
   * Font loading detection script
   */
  static getFontLoadScript(): string {
    return `
      <script>
        // Font loading detection
        if ('fonts' in document) {
          Promise.all([
            document.fonts.load('400 16px Inter'),
            document.fonts.load('600 16px Inter'),
            document.fonts.load('400 14px Monaco')
          ]).then(() => {
            document.documentElement.classList.add('font-loaded');
          }).catch(() => {
            // Fallback if font loading fails
            setTimeout(() => {
              document.documentElement.classList.add('font-loaded');
            }, 3000);
          });
        } else {
          // Fallback for browsers without Font Loading API
          setTimeout(() => {
            document.documentElement.classList.add('font-loaded');
          }, 2000);
        }
      </script>
    `;
  }
}

/**
 * Asset compression utilities
 */
export class AssetCompressor {
  /**
   * Generate Brotli/Gzip configuration for static assets
   */
  static getCompressionConfig() {
    return {
      // File types to compress
      compressibleTypes: [
        'text/html',
        'text/css',
        'text/javascript',
        'application/javascript',
        'application/json',
        'text/xml',
        'application/xml',
        'image/svg+xml',
        'text/plain'
      ],
      
      // Compression levels
      gzip: {
        level: 6,
        threshold: 1024 // Only compress files larger than 1KB
      },
      
      brotli: {
        level: 6,
        threshold: 1024
      },
      
      // Cache headers for compressed assets
      cacheHeaders: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Vary': 'Accept-Encoding'
      }
    };
  }

  /**
   * Generate optimized asset headers
   */
  static getAssetHeaders(filePath: string): Record<string, string> {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const config = this.getCompressionConfig();
    
    const baseHeaders = {
      'Vary': 'Accept-Encoding'
    };

    switch (ext) {
      case 'css':
      case 'js':
        return {
          ...baseHeaders,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Type': ext === 'css' ? 'text/css' : 'application/javascript'
        };
      
      case 'woff2':
      case 'woff':
        return {
          ...baseHeaders,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Type': `font/${ext}`,
          'Access-Control-Allow-Origin': '*'
        };
      
      case 'webp':
      case 'avif':
      case 'jpg':
      case 'jpeg':
      case 'png':
        return {
          ...baseHeaders,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`
        };
      
      default:
        return baseHeaders;
    }
  }
}

/**
 * Critical resource inlining utilities
 */
export class CriticalResourceInliner {
  /**
   * Generate critical CSS inline style
   */
  static generateCriticalCSS(): string {
    return `
      <style>
        /* Critical CSS - Above the fold styles */
        * {
          box-sizing: border-box;
        }
        
        html {
          font-family: system-ui, -apple-system, sans-serif;
          background: #0a0a0f;
          color: #ffffff;
        }
        
        body {
          margin: 0;
          padding: 0;
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
        }
        
        /* Loading skeleton */
        .skeleton {
          background: linear-gradient(90deg, #1a1a2e 25%, #2a2a4e 50%, #1a1a2e 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
        }
        
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        /* Critical navigation styles */
        nav {
          background: rgba(10, 10, 15, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(0, 255, 255, 0.2);
        }
        
        /* Critical layout */
        .container {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 1rem;
        }
        
        /* Hide non-critical content initially */
        .non-critical {
          display: none;
        }
        
        .loaded .non-critical {
          display: block;
        }
      </style>
    `;
  }

  /**
   * Generate resource hints
   */
  static generateResourceHints(): string {
    return `
      <!-- DNS prefetch for external domains -->
      <link rel="dns-prefetch" href="//fonts.googleapis.com">
      <link rel="dns-prefetch" href="//api.coingecko.com">
      
      <!-- Preconnect to critical domains -->
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      
      <!-- Prefetch critical routes -->
      <link rel="prefetch" href="/simulation">
      <link rel="prefetch" href="/backtesting">
      
      <!-- Preload critical assets -->
      <link rel="modulepreload" href="/assets/js/main.js">
    `;
  }
}

/**
 * Performance monitoring for assets
 */
export class AssetPerformanceMonitor {
  /**
   * Generate performance monitoring script
   */
  static getPerformanceScript(): string {
    return `
      <script>
        // Monitor asset loading performance
        window.addEventListener('load', () => {
          if ('performance' in window) {
            const perfData = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            
            // Log critical metrics
            console.group('🚀 Asset Performance');
            console.log('DOM Content Loaded:', perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart, 'ms');
            console.log('Load Complete:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
            
            // Analyze resource loading
            const slowResources = resources.filter(resource => resource.duration > 1000);
            if (slowResources.length > 0) {
              console.warn('⚠️ Slow resources (>1s):', slowResources.map(r => ({ name: r.name, duration: r.duration })));
            }
            
            // Monitor font loading
            if ('fonts' in document) {
              console.log('Fonts loaded:', document.fonts.status);
            }
            
            console.groupEnd();
          }
        });
        
        // Monitor Largest Contentful Paint
        if ('PerformanceObserver' in window) {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            console.log('🎯 LCP:', lastEntry.startTime, 'ms');
          }).observe({ entryTypes: ['largest-contentful-paint'] });
        }
      </script>
    `;
  }
}

// Export utility functions
export const compressionHelpers = {
  /**
   * Get optimized image markup
   */
  getOptimizedImage: ImageOptimizer.generateResponsiveConfig,
  
  /**
   * Get critical image markup
   */
  getCriticalImage: ImageOptimizer.generateCriticalConfig,
  
  /**
   * Get font preload links
   */
  getFontPreloads: FontOptimizer.generatePreloadLinks,
  
  /**
   * Get asset headers
   */
  getAssetHeaders: AssetCompressor.getAssetHeaders
};