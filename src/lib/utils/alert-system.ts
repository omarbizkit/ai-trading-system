/**
 * Automated Alerting System for Critical System Failures
 * Provides intelligent alerting, escalation, and notification management
 */

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  category: AlertCategory;
  source: AlertSource;
  timestamp: Date;
  status: AlertStatus;
  metadata?: Record<string, any>;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  escalationLevel: number;
  suppressUntil?: Date;
  tags?: string[];
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum AlertCategory {
  SYSTEM_FAILURE = 'system_failure',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  SECURITY_BREACH = 'security_breach',
  DATA_INCONSISTENCY = 'data_inconsistency',
  API_FAILURE = 'api_failure',
  DATABASE_ISSUE = 'database_issue',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  DEPLOYMENT_FAILURE = 'deployment_failure',
  EXTERNAL_SERVICE_FAILURE = 'external_service_failure',
  RESOURCE_EXHAUSTION = 'resource_exhaustion'
}

export enum AlertSource {
  ERROR_LOGGER = 'error_logger',
  PERFORMANCE_MONITOR = 'performance_monitor',
  HEALTH_CHECK = 'health_check',
  API_MONITOR = 'api_monitor',
  DATABASE_MONITOR = 'database_monitor',
  SECURITY_MONITOR = 'security_monitor',
  USER_REPORT = 'user_report',
  AUTOMATED_TEST = 'automated_test'
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
  ESCALATED = 'escalated'
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  category: AlertCategory;
  enabled: boolean;
  cooldownPeriod: number; // minutes
  escalationRules: EscalationRule[];
  notificationChannels: NotificationChannel[];
  suppressionRules?: SuppressionRule[];
}

export interface AlertCondition {
  type: 'threshold' | 'pattern' | 'absence' | 'rate' | 'anomaly';
  metric?: string;
  threshold?: number;
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  pattern?: string;
  timeWindow?: number; // minutes
  occurrences?: number;
}

export interface EscalationRule {
  level: number;
  delayMinutes: number;
  channels: NotificationChannel[];
  condition?: string; // Additional condition for escalation
}

export interface NotificationChannel {
  type: NotificationChannelType;
  config: Record<string, any>;
  enabled: boolean;
}

export enum NotificationChannelType {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  BROWSER_NOTIFICATION = 'browser_notification',
  CONSOLE_LOG = 'console_log',
  LOCAL_STORAGE = 'local_storage',
  TOAST_NOTIFICATION = 'toast_notification'
}

export interface SuppressionRule {
  condition: string;
  duration: number; // minutes
  reason: string;
}

export interface AlertMetrics {
  totalAlerts: number;
  activeAlerts: number;
  criticalAlerts: number;
  averageResolutionTime: number;
  escalationRate: number;
  alertsByCategory: Record<AlertCategory, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  recentAlerts: Alert[];
}

/**
 * Alert System Implementation
 */
export class AlertSystem {
  private static instance: AlertSystem;
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();
  private suppressionCache: Map<string, Date> = new Map();
  private notificationHistory: Map<string, Date[]> = new Map();
  private isInitialized = false;

  private constructor() {
    this.initializeDefaultRules();
    this.startMaintenanceTasks();
  }

  static getInstance(): AlertSystem {
    if (!AlertSystem.instance) {
      AlertSystem.instance = new AlertSystem();
    }
    return AlertSystem.instance;
  }

  private initializeDefaultRules(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Critical system failure rule
    this.addRule({
      id: 'critical_system_failure',
      name: 'Critical System Failure',
      description: 'Alert when critical system components fail',
      condition: {
        type: 'pattern',
        pattern: 'critical|system.*failure|database.*down|api.*unavailable'
      },
      severity: AlertSeverity.CRITICAL,
      category: AlertCategory.SYSTEM_FAILURE,
      enabled: true,
      cooldownPeriod: 5,
      escalationRules: [
        {
          level: 1,
          delayMinutes: 0,
          channels: [
            { type: NotificationChannelType.BROWSER_NOTIFICATION, config: {}, enabled: true },
            { type: NotificationChannelType.CONSOLE_LOG, config: {}, enabled: true }
          ]
        },
        {
          level: 2,
          delayMinutes: 15,
          channels: [
            { type: NotificationChannelType.WEBHOOK, config: { url: '/api/alerts/escalation' }, enabled: true }
          ]
        }
      ],
      notificationChannels: [
        { type: NotificationChannelType.TOAST_NOTIFICATION, config: {}, enabled: true }
      ]
    });

    // Performance degradation rule
    this.addRule({
      id: 'performance_degradation',
      name: 'Performance Degradation',
      description: 'Alert when system performance degrades significantly',
      condition: {
        type: 'threshold',
        metric: 'response_time',
        threshold: 3000,
        operator: 'gt',
        timeWindow: 5,
        occurrences: 3
      },
      severity: AlertSeverity.HIGH,
      category: AlertCategory.PERFORMANCE_DEGRADATION,
      enabled: true,
      cooldownPeriod: 10,
      escalationRules: [
        {
          level: 1,
          delayMinutes: 30,
          channels: [
            { type: NotificationChannelType.CONSOLE_LOG, config: {}, enabled: true }
          ]
        }
      ],
      notificationChannels: [
        { type: NotificationChannelType.TOAST_NOTIFICATION, config: {}, enabled: true }
      ]
    });

    // API failure rule
    this.addRule({
      id: 'api_failure_rate',
      name: 'High API Failure Rate',
      description: 'Alert when API failure rate exceeds threshold',
      condition: {
        type: 'rate',
        metric: 'api_failures',
        threshold: 0.1, // 10% failure rate
        operator: 'gt',
        timeWindow: 10
      },
      severity: AlertSeverity.HIGH,
      category: AlertCategory.API_FAILURE,
      enabled: true,
      cooldownPeriod: 15,
      escalationRules: [],
      notificationChannels: [
        { type: NotificationChannelType.BROWSER_NOTIFICATION, config: {}, enabled: true }
      ]
    });

    // Database connection rule
    this.addRule({
      id: 'database_connectivity',
      name: 'Database Connection Issues',
      description: 'Alert when database connectivity problems occur',
      condition: {
        type: 'pattern',
        pattern: 'database.*connection|supabase.*error|connection.*timeout'
      },
      severity: AlertSeverity.CRITICAL,
      category: AlertCategory.DATABASE_ISSUE,
      enabled: true,
      cooldownPeriod: 5,
      escalationRules: [
        {
          level: 1,
          delayMinutes: 0,
          channels: [
            { type: NotificationChannelType.BROWSER_NOTIFICATION, config: {}, enabled: true }
          ]
        }
      ],
      notificationChannels: [
        { type: NotificationChannelType.TOAST_NOTIFICATION, config: {}, enabled: true }
      ]
    });

    // Authentication failure rule
    this.addRule({
      id: 'auth_failure_spike',
      name: 'Authentication Failure Spike',
      description: 'Alert when authentication failures spike',
      condition: {
        type: 'rate',
        metric: 'auth_failures',
        threshold: 5,
        operator: 'gt',
        timeWindow: 5
      },
      severity: AlertSeverity.MEDIUM,
      category: AlertCategory.AUTHENTICATION_FAILURE,
      enabled: true,
      cooldownPeriod: 10,
      escalationRules: [],
      notificationChannels: [
        { type: NotificationChannelType.CONSOLE_LOG, config: {}, enabled: true }
      ]
    });
  }

  private startMaintenanceTasks(): void {
    // Clean up old alerts every hour
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000);

    // Check for suppression expiry every 5 minutes
    setInterval(() => {
      this.checkSuppressionExpiry();
    }, 5 * 60 * 1000);

    // Cleanup notification history every day
    setInterval(() => {
      this.cleanupNotificationHistory();
    }, 24 * 60 * 60 * 1000);
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    this.rules.set(ruleId, { ...rule, ...updates });
    return true;
  }

  async createAlert(
    title: string,
    description: string,
    severity: AlertSeverity,
    category: AlertCategory,
    source: AlertSource,
    metadata?: Record<string, any>
  ): Promise<string> {
    const id = this.generateAlertId();
    const alert: Alert = {
      id,
      title,
      description,
      severity,
      category,
      source,
      timestamp: new Date(),
      status: AlertStatus.ACTIVE,
      metadata,
      escalationLevel: 0,
      tags: this.generateTags(title, description, category, metadata)
    };

    // Check for suppression
    if (this.isAlertSuppressed(alert)) {
      alert.status = AlertStatus.SUPPRESSED;
      alert.suppressUntil = this.getSuppressUntil(alert);
    }

    this.alerts.set(id, alert);

    // Trigger notifications if not suppressed
    if (alert.status === AlertStatus.ACTIVE) {
      await this.processAlert(alert);
    }

    // Save to local storage for persistence
    this.persistAlert(alert);

    return id;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTags(title: string, description: string, category: AlertCategory, metadata?: Record<string, any>): string[] {
    const tags: string[] = [];

    // Add category tag
    tags.push(`category:${category}`);

    // Add environment tag
    tags.push(`env:${process.env.NODE_ENV || 'unknown'}`);

    // Add metadata-based tags
    if (metadata) {
      if (metadata.component) tags.push(`component:${metadata.component}`);
      if (metadata.endpoint) tags.push(`endpoint:${metadata.endpoint}`);
      if (metadata.user) tags.push(`user:${metadata.user}`);
    }

    // Add content-based tags
    const content = `${title} ${description}`.toLowerCase();
    if (content.includes('api')) tags.push('api');
    if (content.includes('database')) tags.push('database');
    if (content.includes('auth')) tags.push('auth');
    if (content.includes('performance')) tags.push('performance');

    return tags;
  }

  private async processAlert(alert: Alert): Promise<void> {
    // Find matching rules
    const matchingRules = this.findMatchingRules(alert);

    for (const rule of matchingRules) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (this.isInCooldown(rule.id, alert)) continue;

      // Send initial notifications
      await this.sendNotifications(alert, rule.notificationChannels);

      // Set up escalation if rules exist
      if (rule.escalationRules.length > 0) {
        this.scheduleEscalation(alert, rule);
      }

      // Update cooldown tracking
      this.updateCooldownTracking(rule.id);
    }
  }

  private findMatchingRules(alert: Alert): AlertRule[] {
    const matchingRules: AlertRule[] = [];

    for (const rule of this.rules.values()) {
      if (this.doesAlertMatchRule(alert, rule)) {
        matchingRules.push(rule);
      }
    }

    return matchingRules;
  }

  private doesAlertMatchRule(alert: Alert, rule: AlertRule): boolean {
    // Check category match
    if (rule.category !== alert.category) return false;

    // Check severity level (rule should trigger for equal or higher severity)
    const severityLevels = {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.LOW]: 1,
      [AlertSeverity.MEDIUM]: 2,
      [AlertSeverity.HIGH]: 3,
      [AlertSeverity.CRITICAL]: 4
    };

    if (severityLevels[alert.severity] < severityLevels[rule.severity]) return false;

    // Check condition match
    return this.evaluateCondition(alert, rule.condition);
  }

  private evaluateCondition(alert: Alert, condition: AlertCondition): boolean {
    switch (condition.type) {
      case 'pattern':
        if (!condition.pattern) return false;
        const regex = new RegExp(condition.pattern, 'i');
        return regex.test(`${alert.title} ${alert.description}`);

      case 'threshold':
        if (!condition.metric || !alert.metadata) return false;
        const value = alert.metadata[condition.metric];
        if (typeof value !== 'number' || !condition.threshold) return false;

        switch (condition.operator) {
          case 'gt': return value > condition.threshold;
          case 'gte': return value >= condition.threshold;
          case 'lt': return value < condition.threshold;
          case 'lte': return value <= condition.threshold;
          case 'eq': return value === condition.threshold;
          default: return false;
        }

      case 'rate':
        // This would require historical data analysis
        // For now, return true if the alert matches the pattern
        return true;

      case 'absence':
        // This would require checking for absence of expected events
        return false;

      case 'anomaly':
        // This would require anomaly detection algorithms
        return false;

      default:
        return false;
    }
  }

  private isInCooldown(ruleId: string, alert: Alert): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    const history = this.notificationHistory.get(ruleId) || [];
    const cooldownPeriodMs = rule.cooldownPeriod * 60 * 1000;
    const cutoffTime = new Date(Date.now() - cooldownPeriodMs);

    return history.some(timestamp => timestamp > cutoffTime);
  }

  private updateCooldownTracking(ruleId: string): void {
    const history = this.notificationHistory.get(ruleId) || [];
    history.push(new Date());

    // Keep only recent history (last 24 hours)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentHistory = history.filter(timestamp => timestamp > cutoffTime);

    this.notificationHistory.set(ruleId, recentHistory);
  }

  private async sendNotifications(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    for (const channel of channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendNotification(alert, channel);
      } catch (error) {
        console.error(`Failed to send notification via ${channel.type}:`, error);
      }
    }
  }

  private async sendNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    switch (channel.type) {
      case NotificationChannelType.BROWSER_NOTIFICATION:
        await this.sendBrowserNotification(alert);
        break;

      case NotificationChannelType.CONSOLE_LOG:
        this.sendConsoleNotification(alert);
        break;

      case NotificationChannelType.TOAST_NOTIFICATION:
        this.sendToastNotification(alert);
        break;

      case NotificationChannelType.WEBHOOK:
        await this.sendWebhookNotification(alert, channel.config);
        break;

      case NotificationChannelType.LOCAL_STORAGE:
        this.sendLocalStorageNotification(alert);
        break;

      case NotificationChannelType.EMAIL:
        await this.sendEmailNotification(alert, channel.config);
        break;
    }
  }

  private async sendBrowserNotification(alert: Alert): Promise<void> {
    if (!('Notification' in window)) return;

    // Request permission if needed
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      const severityEmojis = {
        [AlertSeverity.CRITICAL]: '🚨',
        [AlertSeverity.HIGH]: '⚠️',
        [AlertSeverity.MEDIUM]: '📢',
        [AlertSeverity.LOW]: 'ℹ️',
        [AlertSeverity.INFO]: '💡'
      };

      new Notification(`${severityEmojis[alert.severity]} ${alert.title}`, {
        body: alert.description,
        icon: '/favicon.ico',
        tag: alert.id,
        requireInteraction: alert.severity === AlertSeverity.CRITICAL
      });
    }
  }

  private sendConsoleNotification(alert: Alert): void {
    const severityStyles = {
      [AlertSeverity.CRITICAL]: 'color: red; font-weight: bold; font-size: 14px;',
      [AlertSeverity.HIGH]: 'color: orange; font-weight: bold;',
      [AlertSeverity.MEDIUM]: 'color: yellow; font-weight: bold;',
      [AlertSeverity.LOW]: 'color: blue;',
      [AlertSeverity.INFO]: 'color: green;'
    };

    console.group(`%c[ALERT ${alert.severity.toUpperCase()}] ${alert.title}`, severityStyles[alert.severity]);
    console.log(`📅 Time: ${alert.timestamp.toISOString()}`);
    console.log(`📝 Description: ${alert.description}`);
    console.log(`🏷️ Category: ${alert.category}`);
    console.log(`🔗 Source: ${alert.source}`);
    console.log(`🆔 ID: ${alert.id}`);

    if (alert.metadata) {
      console.log(`📊 Metadata:`, alert.metadata);
    }

    if (alert.tags) {
      console.log(`🏷️ Tags: ${alert.tags.join(', ')}`);
    }

    console.groupEnd();
  }

  private sendToastNotification(alert: Alert): void {
    // Create toast notification element
    const toast = document.createElement('div');
    const severityClasses = {
      [AlertSeverity.CRITICAL]: 'bg-red-500/20 border-red-500/50 text-red-400',
      [AlertSeverity.HIGH]: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
      [AlertSeverity.MEDIUM]: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
      [AlertSeverity.LOW]: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
      [AlertSeverity.INFO]: 'bg-green-500/20 border-green-500/50 text-green-400'
    };

    const severityEmojis = {
      [AlertSeverity.CRITICAL]: '🚨',
      [AlertSeverity.HIGH]: '⚠️',
      [AlertSeverity.MEDIUM]: '📢',
      [AlertSeverity.LOW]: 'ℹ️',
      [AlertSeverity.INFO]: '💡'
    };

    toast.className = `fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-lg border backdrop-blur-md ${severityClasses[alert.severity]}`;
    toast.innerHTML = `
      <div class="flex items-start space-x-3">
        <span class="text-xl">${severityEmojis[alert.severity]}</span>
        <div class="flex-1">
          <h4 class="font-bold">${alert.title}</h4>
          <p class="text-sm opacity-75 mt-1">${alert.description}</p>
        </div>
        <button class="ml-2 opacity-50 hover:opacity-100" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    document.body.appendChild(toast);

    // Auto-remove after delay based on severity
    const delays = {
      [AlertSeverity.CRITICAL]: 10000,
      [AlertSeverity.HIGH]: 8000,
      [AlertSeverity.MEDIUM]: 6000,
      [AlertSeverity.LOW]: 4000,
      [AlertSeverity.INFO]: 3000
    };

    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, delays[alert.severity]);
  }

  private async sendWebhookNotification(alert: Alert, config: Record<string, any>): Promise<void> {
    if (!config.url) return;

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      source: 'ai-trading-system'
    };

    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(payload)
    });
  }

  private sendLocalStorageNotification(alert: Alert): void {
    try {
      const alerts = JSON.parse(localStorage.getItem('alertNotifications') || '[]');
      alerts.unshift({
        ...alert,
        timestamp: alert.timestamp.toISOString()
      });

      // Keep only last 50 alerts
      if (alerts.length > 50) {
        alerts.splice(50);
      }

      localStorage.setItem('alertNotifications', JSON.stringify(alerts));
    } catch (error) {
      console.error('Failed to save alert to localStorage:', error);
    }
  }

  private async sendEmailNotification(alert: Alert, config: Record<string, any>): Promise<void> {
    // This would integrate with an email service
    // For now, we'll send to a webhook endpoint that handles email
    if (!config.emailEndpoint) return;

    const payload = {
      to: config.recipients || [],
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      body: `
        Alert Details:
        - Title: ${alert.title}
        - Description: ${alert.description}
        - Severity: ${alert.severity}
        - Category: ${alert.category}
        - Source: ${alert.source}
        - Timestamp: ${alert.timestamp.toISOString()}
        - Alert ID: ${alert.id}

        ${alert.metadata ? `Metadata: ${JSON.stringify(alert.metadata, null, 2)}` : ''}
      `,
      alert
    };

    await fetch(config.emailEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  private scheduleEscalation(alert: Alert, rule: AlertRule): void {
    for (const escalationRule of rule.escalationRules) {
      const delay = escalationRule.delayMinutes * 60 * 1000;
      const timerId = setTimeout(async () => {
        // Check if alert is still active and not resolved
        const currentAlert = this.alerts.get(alert.id);
        if (!currentAlert || currentAlert.status !== AlertStatus.ACTIVE) {
          return;
        }

        // Update escalation level
        currentAlert.escalationLevel = escalationRule.level;
        currentAlert.status = AlertStatus.ESCALATED;

        // Send escalation notifications
        await this.sendNotifications(currentAlert, escalationRule.channels);

        // Clean up timer
        this.escalationTimers.delete(alert.id);
      }, delay);

      this.escalationTimers.set(`${alert.id}_${escalationRule.level}`, timerId);
    }
  }

  private isAlertSuppressed(alert: Alert): boolean {
    // Check global suppression
    const globalSuppression = this.suppressionCache.get('global');
    if (globalSuppression && globalSuppression > new Date()) {
      return true;
    }

    // Check category-specific suppression
    const categorySuppression = this.suppressionCache.get(`category:${alert.category}`);
    if (categorySuppression && categorySuppression > new Date()) {
      return true;
    }

    // Check tag-based suppression
    if (alert.tags) {
      for (const tag of alert.tags) {
        const tagSuppression = this.suppressionCache.get(`tag:${tag}`);
        if (tagSuppression && tagSuppression > new Date()) {
          return true;
        }
      }
    }

    return false;
  }

  private getSuppressUntil(alert: Alert): Date {
    const suppressions: Date[] = [];

    // Check all applicable suppression rules
    const globalSuppression = this.suppressionCache.get('global');
    if (globalSuppression) suppressions.push(globalSuppression);

    const categorySuppression = this.suppressionCache.get(`category:${alert.category}`);
    if (categorySuppression) suppressions.push(categorySuppression);

    if (alert.tags) {
      for (const tag of alert.tags) {
        const tagSuppression = this.suppressionCache.get(`tag:${tag}`);
        if (tagSuppression) suppressions.push(tagSuppression);
      }
    }

    // Return the earliest suppression end time
    return suppressions.length > 0 ? new Date(Math.min(...suppressions.map(d => d.getTime()))) : new Date();
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== AlertStatus.ACTIVE) {
      return false;
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    // Cancel escalation timers
    this.cancelEscalation(alertId);

    this.persistAlert(alert);
    return true;
  }

  resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedBy = resolvedBy;
    alert.resolvedAt = new Date();

    // Cancel escalation timers
    this.cancelEscalation(alertId);

    this.persistAlert(alert);
    return true;
  }

  suppressAlerts(
    type: 'global' | 'category' | 'tag',
    value: string,
    durationMinutes: number,
    reason: string
  ): void {
    const key = type === 'global' ? 'global' : `${type}:${value}`;
    const suppressUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    this.suppressionCache.set(key, suppressUntil);

    // Log suppression
    console.log(`Alert suppression active: ${key} until ${suppressUntil.toISOString()} (${reason})`);
  }

  private cancelEscalation(alertId: string): void {
    for (const [key, timer] of this.escalationTimers.entries()) {
      if (key.startsWith(alertId)) {
        clearTimeout(timer);
        this.escalationTimers.delete(key);
      }
    }
  }

  private persistAlert(alert: Alert): void {
    try {
      const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
      const existingIndex = alerts.findIndex((a: any) => a.id === alert.id);

      const alertData = {
        ...alert,
        timestamp: alert.timestamp.toISOString(),
        acknowledgedAt: alert.acknowledgedAt?.toISOString(),
        resolvedAt: alert.resolvedAt?.toISOString(),
        suppressUntil: alert.suppressUntil?.toISOString()
      };

      if (existingIndex >= 0) {
        alerts[existingIndex] = alertData;
      } else {
        alerts.unshift(alertData);
      }

      // Keep only last 100 alerts
      if (alerts.length > 100) {
        alerts.splice(100);
      }

      localStorage.setItem('alerts', JSON.stringify(alerts));
    } catch (error) {
      console.error('Failed to persist alert:', error);
    }
  }

  private cleanupOldAlerts(): void {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffTime && alert.status === AlertStatus.RESOLVED) {
        this.alerts.delete(id);
      }
    }
  }

  private checkSuppressionExpiry(): void {
    const now = new Date();

    for (const [key, suppressUntil] of this.suppressionCache.entries()) {
      if (suppressUntil <= now) {
        this.suppressionCache.delete(key);
      }
    }
  }

  private cleanupNotificationHistory(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    for (const [ruleId, history] of this.notificationHistory.entries()) {
      const recentHistory = history.filter(timestamp => timestamp > cutoffTime);
      if (recentHistory.length === 0) {
        this.notificationHistory.delete(ruleId);
      } else {
        this.notificationHistory.set(ruleId, recentHistory);
      }
    }
  }

  getAlerts(status?: AlertStatus, limit?: number): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (status) {
      alerts = alerts.filter(alert => alert.status === status);
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      alerts = alerts.slice(0, limit);
    }

    return alerts;
  }

  getAlertMetrics(): AlertMetrics {
    const allAlerts = Array.from(this.alerts.values());
    const activeAlerts = allAlerts.filter(a => a.status === AlertStatus.ACTIVE);
    const criticalAlerts = allAlerts.filter(a => a.severity === AlertSeverity.CRITICAL);
    const resolvedAlerts = allAlerts.filter(a => a.status === AlertStatus.RESOLVED);

    // Calculate average resolution time
    const resolutionTimes = resolvedAlerts
      .filter(a => a.resolvedAt && a.timestamp)
      .map(a => a.resolvedAt!.getTime() - a.timestamp.getTime());

    const averageResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
      : 0;

    // Calculate escalation rate
    const escalatedAlerts = allAlerts.filter(a => a.escalationLevel > 0);
    const escalationRate = allAlerts.length > 0 ? escalatedAlerts.length / allAlerts.length : 0;

    // Group by category and severity
    const alertsByCategory = {} as Record<AlertCategory, number>;
    const alertsBySeverity = {} as Record<AlertSeverity, number>;

    Object.values(AlertCategory).forEach(category => {
      alertsByCategory[category] = allAlerts.filter(a => a.category === category).length;
    });

    Object.values(AlertSeverity).forEach(severity => {
      alertsBySeverity[severity] = allAlerts.filter(a => a.severity === severity).length;
    });

    // Get recent alerts (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = allAlerts
      .filter(a => a.timestamp >= oneDayAgo)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalAlerts: allAlerts.length,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      averageResolutionTime: averageResolutionTime / 1000 / 60, // Convert to minutes
      escalationRate,
      alertsByCategory,
      alertsBySeverity,
      recentAlerts
    };
  }
}

// Export singleton instance
export const alertSystem = AlertSystem.getInstance();

// Integration helpers for other monitoring systems
export function integrateWithErrorLogger() {
  // This would integrate with the error logger to automatically create alerts
  // for critical errors
}

export function integrateWithPerformanceMonitor() {
  // This would integrate with the performance monitor to create alerts
  // for performance threshold violations
}

export function integrateWithHealthCheck() {
  // This would integrate with health check systems to create alerts
  // for system health issues
}

// Utility functions
export function createQuickAlert(
  title: string,
  description: string,
  severity: AlertSeverity = AlertSeverity.MEDIUM
): Promise<string> {
  return alertSystem.createAlert(
    title,
    description,
    severity,
    AlertCategory.SYSTEM_FAILURE,
    AlertSource.USER_REPORT
  );
}

export function createAPIAlert(endpoint: string, error: string, responseTime?: number): Promise<string> {
  return alertSystem.createAlert(
    `API Error: ${endpoint}`,
    error,
    AlertSeverity.HIGH,
    AlertCategory.API_FAILURE,
    AlertSource.API_MONITOR,
    { endpoint, responseTime }
  );
}

export function createPerformanceAlert(metric: string, value: number, threshold: number): Promise<string> {
  return alertSystem.createAlert(
    `Performance Threshold Exceeded: ${metric}`,
    `${metric} is ${value}, exceeding threshold of ${threshold}`,
    AlertSeverity.MEDIUM,
    AlertCategory.PERFORMANCE_DEGRADATION,
    AlertSource.PERFORMANCE_MONITOR,
    { metric, value, threshold }
  );
}