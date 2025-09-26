// Lighthouse CI Configuration for AI Trading System
// Performance monitoring and quality gates

module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:4321',
        'http://localhost:4321/trade',
        'http://localhost:4321/backtest',
        'http://localhost:4321/history',
        'http://localhost:4321/profile'
      ],
      // Collection settings
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        // Optimize for CI environment
        throttlingMethod: 'simulate',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        },
        // Skip slow audits in CI
        skipAudits: [
          'unused-javascript',
          'unused-css-rules',
          'non-composited-animations'
        ]
      }
    },
    assert: {
      // Performance budgets and quality gates
      assertions: {
        // Performance thresholds
        'categories:performance': ['error', {minScore: 0.8}],
        'categories:accessibility': ['error', {minScore: 0.9}],
        'categories:best-practices': ['error', {minScore: 0.8}],
        'categories:seo': ['error', {minScore: 0.8}],

        // Core Web Vitals
        'first-contentful-paint': ['error', {maxNumericValue: 2000}],
        'largest-contentful-paint': ['error', {maxNumericValue: 4000}],
        'cumulative-layout-shift': ['error', {maxNumericValue: 0.15}],
        'speed-index': ['error', {maxNumericValue: 4000}],
        'interactive': ['error', {maxNumericValue: 5000}],

        // Network and resource optimization
        'network-requests': ['error', {maxNumericValue: 50}],
        'total-byte-weight': ['error', {maxNumericValue: 2000000}], // 2MB
        'render-blocking-resources': ['error', {maxNumericValue: 3}],
        'unused-javascript': ['warn', {maxNumericValue: 40000}],

        // Image optimization
        'uses-optimized-images': 'error',
        'uses-webp-images': 'warn',
        'offscreen-images': 'error',

        // Caching and compression
        'uses-long-cache-ttl': 'warn',
        'uses-text-compression': 'error',

        // Security
        'is-on-https': 'error',
        'redirects-http': 'error',
        'uses-http2': 'warn',

        // PWA capabilities
        'installable-manifest': 'warn',
        'splash-screen': 'warn',
        'themed-omnibox': 'warn',

        // Accessibility requirements
        'color-contrast': 'error',
        'heading-order': 'error',
        'link-name': 'error',
        'button-name': 'error',
        'image-alt': 'error',
        'form-field-multiple-labels': 'error',
        'focus-traps': 'error',
        'focusable-controls': 'error',
        'interactive-element-affordance': 'error',
        'logical-tab-order': 'error',

        // Best practices
        'uses-https': 'error',
        'no-vulnerable-libraries': 'error',
        'charset': 'error',
        'doctype': 'error',
        'no-document-write': 'error',
        'external-anchors-use-rel-noopener': 'error'
      }
    },
    upload: {
      // Upload results to temporary public storage for PR comments
      target: 'temporary-public-storage'
    },
    server: {
      // Local server configuration for CI
      command: 'npm run preview',
      port: 4321
    }
  }
};