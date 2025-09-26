#!/usr/bin/env node
/**
 * Quickstart Test Scenarios Validation Script
 * Runs comprehensive end-to-end tests to validate AI Trading System functionality
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:4321',
  portfolioUrl: process.env.PORTFOLIO_URL || 'https://bizkit.dev',
  headless: process.env.HEADLESS !== 'false',
  browsers: ['chromium', 'firefox', 'webkit'],
  testTimeout: 60000,
  retries: 2,
};

// Test scenarios mapping
const SCENARIOS = {
  'guest-simulation': 'Scenario 1: Guest User Simulation',
  'authenticated-backtesting': 'Scenario 2: Authenticated Backtesting',
  'realtime-dashboard': 'Scenario 3: Real-time Trading Dashboard',
  'risk-management': 'Scenario 4: Risk Management Protocols',
  'cross-domain-navigation': 'Scenario 5: Cross-domain Navigation',
  'mobile-responsiveness': 'Scenario 6: Mobile Responsiveness',
  'performance-validation': 'Performance Validation Tests',
  'error-handling': 'Error Handling Scenarios'
};

/**
 * Logger utility
 */
class Logger {
  static info(message) {
    console.log(`ℹ️  ${new Date().toISOString()} - ${message}`);
  }

  static success(message) {
    console.log(`✅ ${new Date().toISOString()} - ${message}`);
  }

  static error(message) {
    console.error(`❌ ${new Date().toISOString()} - ${message}`);
  }

  static warn(message) {
    console.warn(`⚠️  ${new Date().toISOString()} - ${message}`);
  }
}

/**
 * Check prerequisites before running tests
 */
async function checkPrerequisites() {
  Logger.info('Checking test prerequisites...');

  const checks = [
    {
      name: 'Node.js version',
      check: () => {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        return major >= 16;
      }
    },
    {
      name: 'Playwright installation',
      check: () => {
        try {
          execSync('npx playwright --version', { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      name: 'Project dependencies',
      check: () => fs.existsSync(path.join(__dirname, '..', 'node_modules'))
    },
    {
      name: 'Test files exist',
      check: () => fs.existsSync(path.join(__dirname, '..', 'tests', 'e2e', 'quickstart-scenarios.test.ts'))
    },
    {
      name: 'Development server accessibility',
      check: async () => {
        if (CONFIG.baseUrl.includes('localhost')) {
          try {
            const response = await fetch(CONFIG.baseUrl);
            return response.ok || response.status === 200;
          } catch {
            return false;
          }
        }
        return true; // Skip for production URLs
      }
    }
  ];

  let allPassed = true;

  for (const { name, check } of checks) {
    try {
      const result = await check();
      if (result) {
        Logger.success(`${name}: OK`);
      } else {
        Logger.error(`${name}: FAILED`);
        allPassed = false;
      }
    } catch (error) {
      Logger.error(`${name}: ERROR - ${error.message}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    Logger.error('Prerequisites check failed. Please fix issues before running tests.');
    process.exit(1);
  }

  Logger.success('All prerequisites satisfied.');
  return true;
}

/**
 * Install Playwright browsers if needed
 */
async function installPlaywrightBrowsers() {
  Logger.info('Checking Playwright browsers...');

  try {
    execSync('npx playwright install --with-deps', {
      stdio: 'inherit',
      timeout: 120000 // 2 minutes timeout
    });
    Logger.success('Playwright browsers ready.');
  } catch (error) {
    Logger.error(`Failed to install Playwright browsers: ${error.message}`);
    throw error;
  }
}

/**
 * Run specific test scenario
 */
async function runTestScenario(scenarioName, browser = 'chromium') {
  const testFile = 'tests/e2e/quickstart-scenarios.test.ts';
  const scenarioTitle = SCENARIOS[scenarioName] || scenarioName;

  Logger.info(`Running ${scenarioTitle} on ${browser}...`);

  return new Promise((resolve, reject) => {
    const args = [
      'playwright', 'test',
      testFile,
      `--grep="${scenarioTitle}"`,
      `--project=${browser}`,
      `--reporter=json`,
      `--timeout=${CONFIG.testTimeout}`,
      `--retries=${CONFIG.retries}`,
      CONFIG.headless ? '--headed=false' : '--headed=true'
    ];

    const env = {
      ...process.env,
      BASE_URL: CONFIG.baseUrl,
      PORTFOLIO_URL: CONFIG.portfolioUrl,
      CI: process.env.CI || 'false'
    };

    const child = spawn('npx', args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      env
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const result = {
        scenario: scenarioName,
        browser,
        success: code === 0,
        stdout,
        stderr,
        exitCode: code
      };

      if (code === 0) {
        Logger.success(`${scenarioTitle} passed on ${browser}`);
        resolve(result);
      } else {
        Logger.error(`${scenarioTitle} failed on ${browser} (exit code: ${code})`);
        if (stderr) {
          Logger.error(`Error output: ${stderr}`);
        }
        resolve(result); // Don't reject to continue with other tests
      }
    });

    child.on('error', (error) => {
      Logger.error(`Failed to run ${scenarioTitle}: ${error.message}`);
      resolve({
        scenario: scenarioName,
        browser,
        success: false,
        error: error.message,
        exitCode: -1
      });
    });
  });
}

/**
 * Run all test scenarios
 */
async function runAllScenarios() {
  const results = [];
  const scenarios = Object.keys(SCENARIOS);
  const browsers = CONFIG.browsers;

  Logger.info(`Running ${scenarios.length} scenarios across ${browsers.length} browsers...`);

  for (const scenario of scenarios) {
    for (const browser of browsers) {
      try {
        const result = await runTestScenario(scenario, browser);
        results.push(result);
      } catch (error) {
        Logger.error(`Error running scenario ${scenario} on ${browser}: ${error.message}`);
        results.push({
          scenario,
          browser,
          success: false,
          error: error.message,
          exitCode: -1
        });
      }
    }
  }

  return results;
}

/**
 * Generate test report
 */
function generateReport(results) {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;

  Logger.info('Generating test report...');

  const report = {
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: ((passedTests / totalTests) * 100).toFixed(1),
      timestamp: new Date().toISOString()
    },
    scenarios: {},
    browsers: {}
  };

  // Group by scenario
  for (const result of results) {
    if (!report.scenarios[result.scenario]) {
      report.scenarios[result.scenario] = {
        total: 0,
        passed: 0,
        failed: 0,
        browsers: {}
      };
    }

    report.scenarios[result.scenario].total++;
    report.scenarios[result.scenario].browsers[result.browser] = result.success;

    if (result.success) {
      report.scenarios[result.scenario].passed++;
    } else {
      report.scenarios[result.scenario].failed++;
    }
  }

  // Group by browser
  for (const result of results) {
    if (!report.browsers[result.browser]) {
      report.browsers[result.browser] = {
        total: 0,
        passed: 0,
        failed: 0
      };
    }

    report.browsers[result.browser].total++;
    if (result.success) {
      report.browsers[result.browser].passed++;
    } else {
      report.browsers[result.browser].failed++;
    }
  }

  // Save detailed report
  const reportsDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportFile = path.join(reportsDir, `quickstart-validation-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('QUICKSTART VALIDATION REPORT');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${report.summary.successRate}%)`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Report saved: ${reportFile}`);
  console.log('='.repeat(60));

  // Print scenario breakdown
  console.log('\nScenario Results:');
  for (const [scenario, data] of Object.entries(report.scenarios)) {
    const status = data.failed === 0 ? '✅' : '❌';
    console.log(`${status} ${SCENARIOS[scenario] || scenario}: ${data.passed}/${data.total} passed`);
  }

  // Print browser breakdown
  console.log('\nBrowser Results:');
  for (const [browser, data] of Object.entries(report.browsers)) {
    const status = data.failed === 0 ? '✅' : '❌';
    console.log(`${status} ${browser}: ${data.passed}/${data.total} passed`);
  }

  return report;
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    console.log('🚀 AI Trading System - Quickstart Validation');
    console.log('='.repeat(50));

    // Check prerequisites
    await checkPrerequisites();

    // Install browsers if needed
    await installPlaywrightBrowsers();

    let results;

    if (command === 'scenario' && args[1]) {
      // Run specific scenario
      const scenario = args[1];
      const browser = args[2] || 'chromium';

      if (!SCENARIOS[scenario]) {
        Logger.error(`Unknown scenario: ${scenario}`);
        Logger.info(`Available scenarios: ${Object.keys(SCENARIOS).join(', ')}`);
        process.exit(1);
      }

      const result = await runTestScenario(scenario, browser);
      results = [result];
    } else {
      // Run all scenarios
      results = await runAllScenarios();
    }

    // Generate report
    const report = generateReport(results);

    // Exit with appropriate code
    const allPassed = results.every(r => r.success);
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    Logger.error(`Validation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(error => {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runTestScenario,
  runAllScenarios,
  generateReport,
  CONFIG,
  SCENARIOS
};