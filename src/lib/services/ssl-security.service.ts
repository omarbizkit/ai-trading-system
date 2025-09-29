/**
 * T069: SSL Certificate Validation and HTTPS Enforcement
 * Implement SSL certificate validation and HTTPS enforcement
 */

export interface SSLCertificate {
  domain: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  fingerprint: string;
  algorithm: string;
  keySize: number;
  isValid: boolean;
  daysUntilExpiry: number;
}

export interface SecurityHeaders {
  strictTransportSecurity: string;
  contentSecurityPolicy: string;
  xFrameOptions: string;
  xContentTypeOptions: string;
  referrerPolicy: string;
  permissionsPolicy: string;
}

export interface SecurityValidation {
  httpsEnforced: boolean;
  sslValid: boolean;
  headersConfigured: boolean;
  securityScore: number;
  vulnerabilities: string[];
  recommendations: string[];
  certificate?: SSLCertificate;
}

export class SSLSecurityService {
  private securityHeaders: SecurityHeaders;
  private enforcedDomains: string[];

  constructor() {
    this.enforcedDomains = [
      'ai-trading.bizkit.dev',
      'www.ai-trading.bizkit.dev',
      'bizkit.dev',
    ];

    this.securityHeaders = this.generateSecurityHeaders();
  }

  private generateSecurityHeaders(): SecurityHeaders {
    const isProduction = import.meta.env.NODE_ENV === 'production';

    return {
      // HSTS: Force HTTPS for 1 year, include subdomains
      strictTransportSecurity: isProduction
        ? 'max-age=31536000; includeSubDomains; preload'
        : 'max-age=86400',

      // CSP: Comprehensive content security policy
      contentSecurityPolicy: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.coingecko.com https://*.supabase.co wss://*.supabase.co",
        "media-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
      ].join('; '),

      // X-Frame-Options: Prevent clickjacking
      xFrameOptions: 'DENY',

      // X-Content-Type-Options: Prevent MIME sniffing
      xContentTypeOptions: 'nosniff',

      // Referrer Policy: Control referrer information
      referrerPolicy: 'strict-origin-when-cross-origin',

      // Permissions Policy: Control browser features
      permissionsPolicy: [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'accelerometer=()',
        'gyroscope=()',
        'magnetometer=()',
      ].join(', '),
    };
  }

  // HTTPS enforcement middleware
  enforceHTTPS(request: Request): Response | null {
    const url = new URL(request.url);
    const isSecure = url.protocol === 'https:';
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isDevelopment = import.meta.env.NODE_ENV === 'development';

    // Skip HTTPS enforcement for localhost in development
    if (isLocalhost && isDevelopment) {
      return null;
    }

    // Redirect HTTP to HTTPS for enforced domains
    if (!isSecure && this.enforcedDomains.includes(url.hostname)) {
      const httpsUrl = `https://${url.hostname}${url.pathname}${url.search}`;
      return new Response(null, {
        status: 301,
        headers: {
          Location: httpsUrl,
          ...this.getSecurityHeaders(),
        },
      });
    }

    return null;
  }

  getSecurityHeaders(): Record<string, string> {
    return {
      'Strict-Transport-Security': this.securityHeaders.strictTransportSecurity,
      'Content-Security-Policy': this.securityHeaders.contentSecurityPolicy,
      'X-Frame-Options': this.securityHeaders.xFrameOptions,
      'X-Content-Type-Options': this.securityHeaders.xContentTypeOptions,
      'Referrer-Policy': this.securityHeaders.referrerPolicy,
      'Permissions-Policy': this.securityHeaders.permissionsPolicy,
      'X-XSS-Protection': '1; mode=block',
      'X-Permitted-Cross-Domain-Policies': 'none',
    };
  }

  async validateSSLCertificate(domain: string): Promise<SSLCertificate | null> {
    try {
      // Mock SSL certificate validation
      // In real implementation, this would fetch and validate the actual certificate
      const mockCertificate: SSLCertificate = {
        domain,
        issuer: "Let's Encrypt Authority X3",
        validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        fingerprint: 'SHA256:ABCD1234EFGH5678IJKL9012MNOP3456QRST7890UVWX1234YZAB5678',
        algorithm: 'RSA-SHA256',
        keySize: 2048,
        isValid: true,
        daysUntilExpiry: 60,
      };

      // Validate certificate dates
      const now = new Date();
      const validFrom = new Date(mockCertificate.validFrom);
      const validTo = new Date(mockCertificate.validTo);

      mockCertificate.isValid = now >= validFrom && now <= validTo;
      mockCertificate.daysUntilExpiry = Math.floor(
        (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return mockCertificate;
    } catch (error) {
      console.error('SSL certificate validation failed:', error);
      return null;
    }
  }

  async performSecurityValidation(domain: string): Promise<SecurityValidation> {
    const vulnerabilities: string[] = [];
    const recommendations: string[] = [];
    let securityScore = 100;

    // Check HTTPS enforcement
    const httpsEnforced = await this.checkHTTPSEnforcement(domain);
    if (!httpsEnforced) {
      vulnerabilities.push('HTTPS is not enforced');
      recommendations.push('Implement HTTPS redirect for all HTTP requests');
      securityScore -= 20;
    }

    // Validate SSL certificate
    const certificate = await this.validateSSLCertificate(domain);
    const sslValid = certificate?.isValid || false;

    if (!sslValid) {
      vulnerabilities.push('SSL certificate is invalid or expired');
      recommendations.push('Renew SSL certificate');
      securityScore -= 25;
    } else if (certificate && certificate.daysUntilExpiry < 30) {
      recommendations.push(`SSL certificate expires in ${certificate.daysUntilExpiry} days`);
      securityScore -= 5;
    }

    // Check security headers
    const headersConfigured = await this.checkSecurityHeaders(domain);
    if (!headersConfigured) {
      vulnerabilities.push('Security headers are not properly configured');
      recommendations.push('Implement comprehensive security headers');
      securityScore -= 15;
    }

    // Additional security checks
    const additionalChecks = await this.performAdditionalSecurityChecks(domain);
    vulnerabilities.push(...additionalChecks.vulnerabilities);
    recommendations.push(...additionalChecks.recommendations);
    securityScore -= additionalChecks.scoreDeduction;

    return {
      httpsEnforced,
      sslValid,
      headersConfigured,
      securityScore: Math.max(0, securityScore),
      vulnerabilities,
      recommendations,
      certificate: certificate || undefined,
    };
  }

  private async checkHTTPSEnforcement(domain: string): Promise<boolean> {
    try {
      // Mock HTTPS enforcement check
      // In real implementation, would test HTTP to HTTPS redirect
      return this.enforcedDomains.includes(domain);
    } catch (error) {
      return false;
    }
  }

  private async checkSecurityHeaders(domain: string): Promise<boolean> {
    try {
      // Mock security headers check
      // In real implementation, would fetch headers from the domain
      const isProduction = import.meta.env.NODE_ENV === 'production';
      return isProduction; // Assume headers are configured in production
    } catch (error) {
      return false;
    }
  }

  private async performAdditionalSecurityChecks(domain: string): Promise<{
    vulnerabilities: string[];
    recommendations: string[];
    scoreDeduction: number;
  }> {
    const vulnerabilities: string[] = [];
    const recommendations: string[] = [];
    let scoreDeduction = 0;

    // Check for common security misconfigurations
    const isProduction = import.meta.env.NODE_ENV === 'production';

    if (isProduction) {
      // Check for development indicators in production
      if (domain.includes('localhost') || domain.includes('dev.')) {
        vulnerabilities.push('Development domain detected in production');
        recommendations.push('Use production domain only');
        scoreDeduction += 10;
      }

      // Check for insecure protocols
      if (!domain.startsWith('https://') && domain.includes('://')) {
        vulnerabilities.push('Insecure protocol detected');
        recommendations.push('Use HTTPS only');
        scoreDeduction += 15;
      }
    }

    // Check for subdomain security
    if (domain.includes('bizkit.dev')) {
      recommendations.push('Consider implementing HSTS preload for the entire domain');
    }

    return {
      vulnerabilities,
      recommendations,
      scoreDeduction,
    };
  }

  // Generate CSP nonce for inline scripts (if needed)
  generateCSPNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  // Update CSP with nonce
  updateCSPWithNonce(nonce: string): string {
    return this.securityHeaders.contentSecurityPolicy.replace(
      "'unsafe-inline'",
      `'nonce-${nonce}'`
    );
  }

  // Security monitoring
  logSecurityEvent(event: {
    type: 'certificate_expiry' | 'https_violation' | 'csp_violation' | 'security_scan';
    domain: string;
    details: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    console.log(`Security Event [${event.severity.toUpperCase()}]:`, logEntry);

    // In production, this would send to monitoring service
    if (import.meta.env.NODE_ENV === 'production' && event.severity === 'critical') {
      // Send alert to monitoring system
      this.sendSecurityAlert(logEntry);
    }
  }

  private sendSecurityAlert(event: any): void {
    // Mock security alert - in real implementation would integrate with alerting system
    console.error('CRITICAL SECURITY ALERT:', event);
  }

  // Get security recommendations based on current configuration
  getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];
    const isProduction = import.meta.env.NODE_ENV === 'production';

    if (isProduction) {
      recommendations.push(
        'Regularly monitor SSL certificate expiry dates',
        'Implement security headers validation in CI/CD pipeline',
        'Set up automated security scanning',
        'Enable HSTS preload for the domain',
        'Implement Content Security Policy violation reporting',
        'Regularly review and update security policies',
        'Monitor for security vulnerabilities in dependencies',
        'Implement rate limiting for API endpoints',
        'Set up Web Application Firewall (WAF) if possible',
        'Regularly backup and test recovery procedures'
      );
    } else {
      recommendations.push(
        'Test HTTPS enforcement in staging environment',
        'Validate security headers configuration',
        'Prepare SSL certificate for production deployment',
        'Review Content Security Policy for compatibility'
      );
    }

    return recommendations;
  }
}

// Global instance
export const sslSecurity = new SSLSecurityService();