/**
 * Database Health Service
 * 
 * Service for monitoring database connectivity and query performance
 * during the production readiness phase.
 */

import type { 
  DatabaseHealth, 
  ConnectionStatus, 
  QueryStatus, 
  Environment 
} from '../types/database-health';

export class DatabaseHealthService {
  private databaseChecks: Map<string, DatabaseHealth> = new Map();
  private connectionHistory: Map<string, DatabaseHealth[]> = new Map();
  private queryTimes: Map<string, number[]> = new Map();

  constructor() {
    this.initializeDefaultConnections();
  }

  /**
   * Initialize default database connections for monitoring
   */
  private initializeDefaultConnections(): void {
    const defaultConnections = [
      {
        connectionName: 'supabase_main',
        host: process.env.PUBLIC_SUPABASE_URL || 'localhost',
        databaseName: 'postgres'
      }
    ];

    defaultConnections.forEach(conn => {
      const id = this.generateDatabaseHealthId(conn.connectionName);
      const databaseHealth: DatabaseHealth = {
        id,
        connection_name: conn.connectionName,
        host: conn.host,
        database_name: conn.databaseName,
        connection_status: 'unknown',
        query_test_status: 'not_tested',
        last_tested: new Date(),
        environment: 'development'
      };
      
      this.databaseChecks.set(id, databaseHealth);
      this.connectionHistory.set(id, []);
      this.queryTimes.set(id, []);
    });
  }

  /**
   * Test database connection
   */
  async testConnection(
    connectionName: string,
    environment: Environment = 'development'
  ): Promise<DatabaseHealth> {
    const id = this.generateDatabaseHealthId(connectionName);
    const existingCheck = this.databaseChecks.get(id);
    
    if (!existingCheck) {
      throw new Error(`Database health check not found for connection: ${connectionName}`);
    }

    const startTime = Date.now();
    let connectionStatus: ConnectionStatus = 'unknown';
    let queryStatus: QueryStatus = 'not_tested';
    let errorMessage: string | undefined;
    let averageQueryTime: number | undefined;

    try {
      // Test basic connection
      const connectionResult = await this.testBasicConnection(existingCheck);
      connectionStatus = connectionResult.status;
      
      if (connectionResult.error) {
        errorMessage = connectionResult.error;
      }

      // If connection is successful, test query performance
      if (connectionStatus === 'connected') {
        const queryResult = await this.testQueryPerformance(existingCheck);
        queryStatus = queryResult.status;
        averageQueryTime = queryResult.averageTime;
        
        if (queryResult.error) {
          errorMessage = queryResult.error;
        }
      }

      const responseTime = Date.now() - startTime;

      // Update the database health check
      const updatedCheck: DatabaseHealth = {
        ...existingCheck,
        connection_status: connectionStatus,
        query_test_status: queryStatus,
        average_query_time: averageQueryTime,
        error_message: errorMessage,
        last_tested: new Date(),
        environment
      };

      this.databaseChecks.set(id, updatedCheck);
      this.addToHistory(id, updatedCheck);
      this.recordQueryTime(id, responseTime);

      return updatedCheck;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      connectionStatus = 'error';
      queryStatus = 'failed';

      const updatedCheck: DatabaseHealth = {
        ...existingCheck,
        connection_status: connectionStatus,
        query_test_status: queryStatus,
        error_message: errorMessage,
        last_tested: new Date(),
        environment
      };

      this.databaseChecks.set(id, updatedCheck);
      this.addToHistory(id, updatedCheck);
      this.recordQueryTime(id, responseTime);

      return updatedCheck;
    }
  }

  /**
   * Test all database connections
   */
  async testAllConnections(environment: Environment = 'development'): Promise<DatabaseHealth[]> {
    const results: DatabaseHealth[] = [];
    
    for (const [id, databaseCheck] of this.databaseChecks) {
      try {
        const result = await this.testConnection(
          databaseCheck.connection_name,
          environment
        );
        results.push(result);
      } catch (error) {
        console.error(`Failed to test connection ${databaseCheck.connection_name}:`, error);
        // Create a failed database health check
        const failedCheck: DatabaseHealth = {
          ...databaseCheck,
          connection_status: 'error',
          query_test_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          last_tested: new Date(),
          environment
        };
        results.push(failedCheck);
      }
    }

    return results;
  }

  /**
   * Test basic database connection
   */
  private async testBasicConnection(databaseCheck: DatabaseHealth): Promise<{
    status: ConnectionStatus;
    error?: string;
  }> {
    try {
      // For Supabase, we can test the connection by making a simple API call
      if (databaseCheck.connection_name === 'supabase_main') {
        return await this.testSupabaseConnection();
      }
      
      // For other database types, implement specific connection tests
      return await this.testGenericConnection(databaseCheck);
      
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown connection error'
      };
    }
  }

  /**
   * Test Supabase connection
   */
  private async testSupabaseConnection(): Promise<{
    status: ConnectionStatus;
    error?: string;
  }> {
    try {
      const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        return {
          status: 'error',
          error: 'Supabase environment variables not configured'
        };
      }

      // Test connection by making a simple query
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok) {
        return { status: 'connected' };
      } else {
        return {
          status: 'error',
          error: `Supabase API returned status ${response.status}`
        };
      }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Supabase connection failed'
      };
    }
  }

  /**
   * Test generic database connection
   */
  private async testGenericConnection(databaseCheck: DatabaseHealth): Promise<{
    status: ConnectionStatus;
    error?: string;
  }> {
    // This would be implemented for other database types
    // For now, return a placeholder
    return {
      status: 'connected',
      error: 'Generic connection test not implemented'
    };
  }

  /**
   * Test query performance
   */
  private async testQueryPerformance(databaseCheck: DatabaseHealth): Promise<{
    status: QueryStatus;
    averageTime?: number;
    error?: string;
  }> {
    try {
      const queryTimes: number[] = [];
      const testQueries = [
        'SELECT 1', // Simple test query
        'SELECT NOW()', // Timestamp query
        'SELECT COUNT(*) FROM information_schema.tables' // Metadata query
      ];

      for (const query of testQueries) {
        const startTime = Date.now();
        await this.executeTestQuery(query, databaseCheck);
        const queryTime = Date.now() - startTime;
        queryTimes.push(queryTime);
      }

      const averageTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      
      // Determine query status based on performance
      let status: QueryStatus = 'success';
      if (averageTime > 1000) { // More than 1 second
        status = 'slow';
      }

      return {
        status,
        averageTime
      };

    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Query test failed'
      };
    }
  }

  /**
   * Execute a test query
   */
  private async executeTestQuery(query: string, databaseCheck: DatabaseHealth): Promise<any> {
    if (databaseCheck.connection_name === 'supabase_main') {
      return await this.executeSupabaseQuery(query);
    }
    
    // For other database types, implement specific query execution
    throw new Error('Query execution not implemented for this database type');
  }

  /**
   * Execute Supabase query
   */
  private async executeSupabaseQuery(query: string): Promise<any> {
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables not configured');
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: query }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Supabase query failed with status ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get database health by connection name
   */
  getDatabaseHealth(connectionName: string): DatabaseHealth | undefined {
    const id = this.generateDatabaseHealthId(connectionName);
    return this.databaseChecks.get(id);
  }

  /**
   * Get all database health checks with optional filtering
   */
  getDatabaseHealthChecks(filters?: {
    connectionStatus?: ConnectionStatus;
    queryStatus?: QueryStatus;
    environment?: Environment;
  }): DatabaseHealth[] {
    let filteredChecks = Array.from(this.databaseChecks.values());

    if (filters) {
      if (filters.connectionStatus) {
        filteredChecks = filteredChecks.filter(check => 
          check.connection_status === filters.connectionStatus
        );
      }
      if (filters.queryStatus) {
        filteredChecks = filteredChecks.filter(check => 
          check.query_test_status === filters.queryStatus
        );
      }
      if (filters.environment) {
        filteredChecks = filteredChecks.filter(check => 
          check.environment === filters.environment
        );
      }
    }

    return filteredChecks.sort((a, b) => a.last_tested.getTime() - b.last_tested.getTime());
  }

  /**
   * Get connection history for a database
   */
  getConnectionHistory(connectionName: string): DatabaseHealth[] {
    const id = this.generateDatabaseHealthId(connectionName);
    return this.connectionHistory.get(id) || [];
  }

  /**
   * Get database health statistics
   */
  getDatabaseStatistics(): {
    total: number;
    connected: number;
    disconnected: number;
    error: number;
    unknown: number;
    averageQueryTime: number;
    slowQueries: number;
    failedQueries: number;
  } {
    const checks = Array.from(this.databaseChecks.values());
    const total = checks.length;
    
    const connected = checks.filter(check => check.connection_status === 'connected').length;
    const disconnected = checks.filter(check => check.connection_status === 'disconnected').length;
    const error = checks.filter(check => check.connection_status === 'error').length;
    const unknown = checks.filter(check => check.connection_status === 'unknown').length;
    
    const queryTimes = Array.from(this.queryTimes.values()).flat();
    const averageQueryTime = queryTimes.length > 0 
      ? queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length 
      : 0;
    
    const slowQueries = checks.filter(check => check.query_test_status === 'slow').length;
    const failedQueries = checks.filter(check => check.query_test_status === 'failed').length;

    return {
      total,
      connected,
      disconnected,
      error,
      unknown,
      averageQueryTime,
      slowQueries,
      failedQueries
    };
  }

  /**
   * Get problematic database connections
   */
  getProblematicConnections(): DatabaseHealth[] {
    return this.getDatabaseHealthChecks({
      connectionStatus: 'error'
    }).concat(this.getDatabaseHealthChecks({
      queryStatus: 'failed'
    }));
  }

  /**
   * Add new database connection for monitoring
   */
  addConnection(
    connectionName: string,
    host: string,
    databaseName: string
  ): DatabaseHealth {
    const id = this.generateDatabaseHealthId(connectionName);
    
    const databaseHealth: DatabaseHealth = {
      id,
      connection_name: connectionName,
      host,
      database_name: databaseName,
      connection_status: 'unknown',
      query_test_status: 'not_tested',
      last_tested: new Date(),
      environment: 'development'
    };

    this.databaseChecks.set(id, databaseHealth);
    this.connectionHistory.set(id, []);
    this.queryTimes.set(id, []);
    
    return databaseHealth;
  }

  /**
   * Generate unique database health ID
   */
  private generateDatabaseHealthId(connectionName: string): string {
    const base = `db:${connectionName}`;
    return Buffer.from(base).toString('base64').replace(/[+/=]/g, '').substring(0, 16);
  }

  /**
   * Add database health check to history
   */
  private addToHistory(id: string, databaseHealth: DatabaseHealth): void {
    const history = this.connectionHistory.get(id) || [];
    history.push(databaseHealth);
    
    // Keep only last 50 checks to prevent memory issues
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    this.connectionHistory.set(id, history);
  }

  /**
   * Record query time for performance tracking
   */
  private recordQueryTime(id: string, queryTime: number): void {
    const times = this.queryTimes.get(id) || [];
    times.push(queryTime);
    
    // Keep only last 100 query times
    if (times.length > 100) {
      times.splice(0, times.length - 100);
    }
    
    this.queryTimes.set(id, times);
  }

  /**
   * Export database health checks to JSON for debugging
   */
  exportDatabaseHealthChecks(): string {
    const checksArray = Array.from(this.databaseChecks.values());
    return JSON.stringify(checksArray, null, 2);
  }

  /**
   * Clear all database health checks (for testing or reset)
   */
  clearAllDatabaseHealthChecks(): void {
    this.databaseChecks.clear();
    this.connectionHistory.clear();
    this.queryTimes.clear();
    this.initializeDefaultConnections();
  }
}

// Export singleton instance
export const databaseHealthService = new DatabaseHealthService();
