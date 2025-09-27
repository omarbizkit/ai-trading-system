/**
 * Test Execution Endpoint
 * 
 * POST /api/debug/run-tests
 * Execute test suite and return results
 */

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json();
    const { test_types = ['unit'], timeout = 300 } = body;
    
    // Validate test types
    const validTestTypes = ['unit', 'integration', 'e2e', 'performance', 'contract'];
    const invalidTypes = test_types.filter((type: string) => !validTestTypes.includes(type));
    
    if (invalidTypes.length > 0) {
      return new Response(JSON.stringify({
        error: `Invalid test types: ${invalidTypes.join(', ')}. Valid types: ${validTestTypes.join(', ')}`,
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Validate timeout
    if (timeout < 10 || timeout > 1800) {
      return new Response(JSON.stringify({
        error: 'Timeout must be between 10 and 1800 seconds',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Run tests
    const testResults = await runTestSuites(test_types, timeout);
    
    // Determine overall status
    const overallStatus = determineOverallTestStatus(testResults);
    
    const response = {
      overall_status: overallStatus,
      test_results: testResults,
      total_tests: testResults.reduce((sum, result) => sum + result.test_count, 0),
      total_failures: testResults.reduce((sum, result) => sum + result.failure_count, 0),
      total_duration: testResults.reduce((sum, result) => sum + result.duration, 0),
      executed_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Failed to run tests:', error);
    
    const errorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      overall_status: 'failed',
      test_results: [],
      total_tests: 0,
      total_failures: 0,
      total_duration: 0,
      executed_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};

/**
 * Run test suites
 */
async function runTestSuites(testTypes: string[], timeout: number) {
  const results = [];
  
  for (const testType of testTypes) {
    try {
      const result = await runTestSuite(testType, timeout);
      results.push(result);
    } catch (error) {
      results.push({
        test_type: testType,
        status: 'failed',
        duration: 0,
        test_count: 0,
        failure_count: 1,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

/**
 * Run individual test suite
 */
async function runTestSuite(testType: string, timeout: number) {
  const startTime = Date.now();
  
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Determine test command based on type
    const testCommand = getTestCommand(testType);
    
    if (!testCommand) {
      throw new Error(`Test type '${testType}' is not supported`);
    }
    
    // Run the test command
    const { stdout, stderr } = await execAsync(testCommand, {
      cwd: process.cwd(),
      timeout: timeout * 1000 // Convert to milliseconds
    });
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    // Parse test results from output
    const testResults = parseTestOutput(stdout, stderr, testType);
    
    return {
      test_type: testType,
      status: testResults.failureCount === 0 ? 'passed' : 'failed',
      duration,
      test_count: testResults.testCount,
      failure_count: testResults.failureCount,
      error_message: testResults.errorMessage
    };
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    return {
      test_type: testType,
      status: 'failed',
      duration,
      test_count: 0,
      failure_count: 1,
      error_message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get test command for test type
 */
function getTestCommand(testType: string): string | null {
  switch (testType) {
    case 'unit':
      return 'npm run test:unit';
    case 'integration':
      return 'npm run test:integration';
    case 'e2e':
      return 'npm run test:e2e';
    case 'performance':
      return 'npm run test:performance';
    case 'contract':
      return 'npm run test:contract';
    default:
      return null;
  }
}

/**
 * Parse test output to extract results
 */
function parseTestOutput(stdout: string, stderr: string, testType: string) {
  const output = stdout + stderr;
  
  // Common patterns for different test runners
  const patterns = {
    // Vitest patterns
    vitest: {
      testCount: /✓\s+(\d+)\s+passed/,
      failureCount: /✗\s+(\d+)\s+failed/,
      errorPattern: /Error:|Failed:|FAIL/
    },
    // Jest patterns
    jest: {
      testCount: /Tests:\s+(\d+)\s+passed/,
      failureCount: /Tests:\s+.*?(\d+)\s+failed/,
      errorPattern: /Error:|Failed:|FAIL/
    },
    // Playwright patterns
    playwright: {
      testCount: /(\d+)\s+passed/,
      failureCount: /(\d+)\s+failed/,
      errorPattern: /Error:|Failed:|FAIL/
    }
  };
  
  // Try to detect test runner and parse accordingly
  let testCount = 0;
  let failureCount = 0;
  let errorMessage = '';
  
  if (output.includes('vitest') || output.includes('vite')) {
    const vitestMatch = output.match(patterns.vitest.testCount);
    const vitestFailMatch = output.match(patterns.vitest.failureCount);
    
    testCount = vitestMatch ? parseInt(vitestMatch[1], 10) : 0;
    failureCount = vitestFailMatch ? parseInt(vitestFailMatch[1], 10) : 0;
  } else if (output.includes('jest')) {
    const jestMatch = output.match(patterns.jest.testCount);
    const jestFailMatch = output.match(patterns.jest.failureCount);
    
    testCount = jestMatch ? parseInt(jestMatch[1], 10) : 0;
    failureCount = jestFailMatch ? parseInt(jestFailMatch[1], 10) : 0;
  } else if (output.includes('playwright')) {
    const playwrightMatch = output.match(patterns.playwright.testCount);
    const playwrightFailMatch = output.match(patterns.playwright.failureCount);
    
    testCount = playwrightMatch ? parseInt(playwrightMatch[1], 10) : 0;
    failureCount = playwrightFailMatch ? parseInt(playwrightFailMatch[1], 10) : 0;
  } else {
    // Fallback: try to extract numbers from output
    const numberMatches = output.match(/(\d+)\s+(passed|failed|tests)/g);
    if (numberMatches) {
      for (const match of numberMatches) {
        const parts = match.split(/\s+/);
        const count = parseInt(parts[0], 10);
        const type = parts[1];
        
        if (type === 'passed' || type === 'tests') {
          testCount += count;
        } else if (type === 'failed') {
          failureCount += count;
        }
      }
    }
  }
  
  // Extract error message if there are failures
  if (failureCount > 0) {
    const errorLines = output.split('\n').filter(line => 
      line.includes('Error:') || 
      line.includes('Failed:') || 
      line.includes('FAIL') ||
      line.includes('✗') ||
      line.includes('❌')
    );
    
    if (errorLines.length > 0) {
      errorMessage = errorLines.slice(0, 5).join('; '); // First 5 error lines
    }
  }
  
  return {
    testCount,
    failureCount,
    errorMessage
  };
}

/**
 * Determine overall test status
 */
function determineOverallTestStatus(testResults: any[]): 'passed' | 'failed' | 'partial' {
  if (testResults.length === 0) return 'failed';
  
  const passedTests = testResults.filter(result => result.status === 'passed').length;
  const totalTests = testResults.length;
  
  if (passedTests === totalTests) return 'passed';
  if (passedTests > 0) return 'partial';
  return 'failed';
}
