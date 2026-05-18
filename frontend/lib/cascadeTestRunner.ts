/**
 * Cascade Test Runner
 *
 * A test runner that evaluates cascade configurations against sample data
 * to validate trigger conditions and provider behavior.
 */

import type { CascadeTrigger } from '@/types';
import {
  getMockResponse,
  simulateProviderCall,
  type ResponseScenario,
  type MockResponse,
} from './mockProviderData';

// ============================================
// Types
// ============================================

export interface CascadeStep {
  providerId: string;
  trigger: CascadeTrigger;
  triggerConfig?: Record<string, any>;
  timeoutMs?: number;
  retryCount?: number;
}

export interface TestCase {
  name: string;
  description?: string;
  data: Record<string, any>;
  expectedBehavior?: string;
}

export interface TestResult {
  stepIndex: number;
  providerId: string;
  triggered: boolean;
  reason: string;
  mockData: Record<string, any>;
  fieldsReturned: string[];
  duration_ms: number;
  error?: string;
  skipped?: boolean;
}

export interface CascadeTestReport {
  cascadeConfig: CascadeStep[];
  testCases: TestCase[];
  results: TestResult[][];
  summary: {
    totalTests: number;
    allProvidersReached: number;
    earlyExits: number;
    errors: number;
    avgDuration_ms: number;
  };
  generatedAt: string;
}

export interface PermutationResult {
  permutation: CascadeStep[];
  description: string;
  triggerPath: string[];
}

// ============================================
// Default Test Cases
// ============================================

export const DEFAULT_TEST_CASES: TestCase[] = [
  {
    name: 'Complete record',
    description: 'All common fields present',
    data: {
      name: 'Acme Corp',
      email: 'test@acme.com',
      phone: '555-1234',
      website: 'acme.com',
      domain: 'acme.com',
    },
    expectedBehavior: 'First provider should succeed, subsequent providers may be skipped based on triggers',
  },
  {
    name: 'Missing email',
    description: 'Email field is absent',
    data: {
      name: 'Acme Corp',
      phone: '555-1234',
      website: 'acme.com',
    },
    expectedBehavior: 'on_missing_field triggers for email should fire',
  },
  {
    name: 'Missing phone',
    description: 'Phone field is absent',
    data: {
      name: 'Acme Corp',
      email: 'test@acme.com',
      website: 'acme.com',
    },
    expectedBehavior: 'on_missing_field triggers for phone should fire',
  },
  {
    name: 'Missing website',
    description: 'Website field is absent',
    data: {
      name: 'Acme Corp',
      email: 'test@acme.com',
      phone: '555-1234',
    },
    expectedBehavior: 'on_missing_field triggers for website should fire',
  },
  {
    name: 'Minimal record',
    description: 'Only name provided',
    data: {
      name: 'Acme Corp',
    },
    expectedBehavior: 'Multiple on_missing_field triggers should fire',
  },
  {
    name: 'Empty record',
    description: 'No data provided',
    data: {},
    expectedBehavior: 'All providers should attempt enrichment',
  },
  {
    name: 'Provider error simulation',
    description: 'Simulates first provider returning an error',
    data: {
      _simulate_error: true,
      name: 'Error Test Corp',
    },
    expectedBehavior: 'on_error triggers should fire after first provider fails',
  },
];

// ============================================
// Trigger Evaluation
// ============================================

/**
 * Evaluates whether a cascade step should be triggered based on current state
 */
function evaluateTrigger(
  step: CascadeStep,
  currentData: Record<string, any>,
  previousResult: TestResult | null,
  isFirstStep: boolean
): { triggered: boolean; reason: string } {
  const { trigger, triggerConfig } = step;

  // First step always triggers
  if (isFirstStep) {
    return { triggered: true, reason: 'First step in cascade (always runs)' };
  }

  switch (trigger) {
    case 'always':
      return { triggered: true, reason: 'Trigger: always' };

    case 'on_error':
      if (previousResult?.error) {
        return {
          triggered: true,
          reason: `Previous provider "${previousResult.providerId}" errored: ${previousResult.error}`,
        };
      }
      return {
        triggered: false,
        reason: 'Previous provider succeeded (no error)',
      };

    case 'on_empty':
      if (previousResult && previousResult.fieldsReturned.length === 0) {
        return {
          triggered: true,
          reason: `Previous provider "${previousResult.providerId}" returned no data`,
        };
      }
      return {
        triggered: false,
        reason: `Previous provider returned ${previousResult?.fieldsReturned.length || 0} fields`,
      };

    case 'on_missing_field': {
      const field = triggerConfig?.field;
      if (!field) {
        return {
          triggered: false,
          reason: 'No field configured for on_missing_field trigger',
        };
      }
      const isMissing =
        currentData[field] === undefined ||
        currentData[field] === null ||
        currentData[field] === '';
      if (isMissing) {
        return {
          triggered: true,
          reason: `Field "${field}" is missing or empty`,
        };
      }
      return {
        triggered: false,
        reason: `Field "${field}" is present with value: "${currentData[field]}"`,
      };
    }

    case 'on_field_present': {
      const field = triggerConfig?.field;
      if (!field) {
        return {
          triggered: false,
          reason: 'No field configured for on_field_present trigger',
        };
      }
      const isPresent =
        currentData[field] !== undefined &&
        currentData[field] !== null &&
        currentData[field] !== '';
      if (isPresent) {
        return {
          triggered: true,
          reason: `Field "${field}" is present with value: "${currentData[field]}"`,
        };
      }
      return {
        triggered: false,
        reason: `Field "${field}" is missing or empty`,
      };
    }

    case 'on_condition': {
      // Custom condition evaluation
      const condition = triggerConfig?.condition;
      if (!condition) {
        return {
          triggered: false,
          reason: 'No condition configured for on_condition trigger',
        };
      }
      // For now, we just describe the condition
      return {
        triggered: true,
        reason: `Custom condition: ${condition}`,
      };
    }

    default:
      return {
        triggered: false,
        reason: `Unknown trigger type: ${trigger}`,
      };
  }
}

/**
 * Determines the mock scenario based on test case data
 */
function determineScenario(
  testData: Record<string, any>,
  providerId: string
): ResponseScenario {
  if (testData._simulate_error) {
    return 'error';
  }
  if (testData._simulate_empty) {
    return 'empty';
  }
  if (testData._simulate_partial) {
    return 'partial';
  }

  // Default to success
  return 'success';
}

// ============================================
// Test Runner
// ============================================

/**
 * Runs a single test case against a cascade configuration
 */
export function runCascadeTest(
  cascade: CascadeStep[],
  testCase: TestCase
): TestResult[] {
  const results: TestResult[] = [];
  let currentData = { ...testCase.data };
  let previousResult: TestResult | null = null;

  for (let i = 0; i < cascade.length; i++) {
    const step = cascade[i];
    const isFirst = i === 0;

    const startTime = Date.now();

    // Evaluate trigger
    const { triggered, reason } = evaluateTrigger(
      step,
      currentData,
      previousResult,
      isFirst
    );

    if (!triggered) {
      // Step was skipped
      results.push({
        stepIndex: i,
        providerId: step.providerId,
        triggered: false,
        reason,
        mockData: {},
        fieldsReturned: [],
        duration_ms: Date.now() - startTime,
        skipped: true,
      });
      previousResult = results[results.length - 1];
      continue;
    }

    // Determine scenario and get mock response
    const scenario = determineScenario(testCase.data, step.providerId);
    const mockResponse = getMockResponse(step.providerId, scenario);

    // Merge mock data into current data
    const fieldsReturned = Object.keys(mockResponse.data);
    currentData = { ...currentData, ...mockResponse.data };

    const result: TestResult = {
      stepIndex: i,
      providerId: step.providerId,
      triggered: true,
      reason,
      mockData: mockResponse.data,
      fieldsReturned,
      duration_ms: mockResponse.latencyMs,
      error: mockResponse.error,
    };

    results.push(result);
    previousResult = result;
  }

  return results;
}

/**
 * Runs a cascade test asynchronously with simulated delays
 */
export async function runCascadeTestAsync(
  cascade: CascadeStep[],
  testCase: TestCase
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  let currentData = { ...testCase.data };
  let previousResult: TestResult | null = null;

  for (let i = 0; i < cascade.length; i++) {
    const step = cascade[i];
    const isFirst = i === 0;

    const startTime = Date.now();

    // Evaluate trigger
    const { triggered, reason } = evaluateTrigger(
      step,
      currentData,
      previousResult,
      isFirst
    );

    if (!triggered) {
      results.push({
        stepIndex: i,
        providerId: step.providerId,
        triggered: false,
        reason,
        mockData: {},
        fieldsReturned: [],
        duration_ms: Date.now() - startTime,
        skipped: true,
      });
      previousResult = results[results.length - 1];
      continue;
    }

    // Simulate provider call with delay
    const scenario = determineScenario(testCase.data, step.providerId);
    const mockResponse = await simulateProviderCall(step.providerId, scenario);

    const fieldsReturned = Object.keys(mockResponse.data);
    currentData = { ...currentData, ...mockResponse.data };

    const result: TestResult = {
      stepIndex: i,
      providerId: step.providerId,
      triggered: true,
      reason,
      mockData: mockResponse.data,
      fieldsReturned,
      duration_ms: Date.now() - startTime,
      error: mockResponse.error,
    };

    results.push(result);
    previousResult = result;
  }

  return results;
}

/**
 * Generates a complete test report for a cascade configuration
 */
export function generateTestReport(
  cascade: CascadeStep[],
  testCases: TestCase[] = DEFAULT_TEST_CASES
): CascadeTestReport {
  const results: TestResult[][] = [];

  for (const testCase of testCases) {
    const testResults = runCascadeTest(cascade, testCase);
    results.push(testResults);
  }

  // Calculate summary statistics
  let allProvidersReached = 0;
  let earlyExits = 0;
  let errors = 0;
  let totalDuration = 0;
  let totalSteps = 0;

  for (const testResults of results) {
    const triggeredCount = testResults.filter((r) => r.triggered).length;
    const errorCount = testResults.filter((r) => r.error).length;

    if (triggeredCount === cascade.length) {
      allProvidersReached++;
    } else {
      earlyExits++;
    }

    errors += errorCount;
    totalDuration += testResults.reduce((sum, r) => sum + r.duration_ms, 0);
    totalSteps += testResults.length;
  }

  return {
    cascadeConfig: cascade,
    testCases,
    results,
    summary: {
      totalTests: testCases.length,
      allProvidersReached,
      earlyExits,
      errors,
      avgDuration_ms: totalSteps > 0 ? Math.round(totalDuration / totalSteps) : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generates all possible trigger permutations for a cascade
 */
export function getPermutations(cascade: CascadeStep[]): PermutationResult[] {
  if (cascade.length === 0) return [];

  const triggers: CascadeTrigger[] = [
    'always',
    'on_error',
    'on_empty',
    'on_missing_field',
    'on_field_present',
  ];

  const permutations: PermutationResult[] = [];

  // Generate permutations (limit to reasonable number)
  const maxPermutations = Math.min(Math.pow(triggers.length, cascade.length - 1), 50);

  // For now, generate key permutations that cover different scenarios
  const keyPermutations: CascadeTrigger[][] = [
    // All always
    cascade.map(() => 'always'),
    // Error fallback chain
    cascade.map((_, i) => (i === 0 ? 'always' : 'on_error')),
    // Empty fallback chain
    cascade.map((_, i) => (i === 0 ? 'always' : 'on_empty')),
    // Mixed: error then empty
    cascade.map((_, i) => {
      if (i === 0) return 'always';
      if (i === 1) return 'on_error';
      return 'on_empty';
    }),
    // Missing field chain
    cascade.map((_, i) => (i === 0 ? 'always' : 'on_missing_field')),
  ];

  for (const triggerSet of keyPermutations) {
    const permutation = cascade.map((step, i) => ({
      ...step,
      trigger: triggerSet[i],
    }));

    const triggerPath = triggerSet.map((t, i) => `${cascade[i].providerId}: ${t}`);

    permutations.push({
      permutation,
      description: `${triggerSet.slice(1).join(' -> ')}`,
      triggerPath,
    });
  }

  return permutations;
}

/**
 * Analyzes a test report and returns insights
 */
export function analyzeTestReport(report: CascadeTestReport): string[] {
  const insights: string[] = [];

  // Check if any providers are never reached
  const providerReachCounts: Record<string, number> = {};
  for (const step of report.cascadeConfig) {
    providerReachCounts[step.providerId] = 0;
  }

  for (const testResults of report.results) {
    for (const result of testResults) {
      if (result.triggered) {
        providerReachCounts[result.providerId]++;
      }
    }
  }

  for (const [providerId, count] of Object.entries(providerReachCounts)) {
    if (count === 0) {
      insights.push(`Provider "${providerId}" was never triggered in any test case`);
    } else if (count < report.testCases.length / 2) {
      insights.push(
        `Provider "${providerId}" was only triggered in ${count}/${report.testCases.length} test cases`
      );
    }
  }

  // Check error rate
  const errorRate = report.summary.errors / (report.summary.totalTests * report.cascadeConfig.length);
  if (errorRate > 0.3) {
    insights.push(`High error rate detected: ${Math.round(errorRate * 100)}% of steps encountered errors`);
  }

  // Check early exit rate
  const earlyExitRate = report.summary.earlyExits / report.summary.totalTests;
  if (earlyExitRate > 0.5) {
    insights.push(
      `${Math.round(earlyExitRate * 100)}% of tests exited early - consider reviewing trigger conditions`
    );
  }

  if (insights.length === 0) {
    insights.push('Cascade configuration looks good - all providers are reachable');
  }

  return insights;
}

/**
 * Creates a custom test case
 */
export function createTestCase(
  name: string,
  data: Record<string, any>,
  description?: string
): TestCase {
  return {
    name,
    description,
    data,
  };
}

/**
 * Validates a cascade configuration and returns validation issues
 */
export function validateCascade(cascade: CascadeStep[]): string[] {
  const issues: string[] = [];

  if (cascade.length === 0) {
    issues.push('Cascade has no steps configured');
    return issues;
  }

  // Check first step trigger
  if (cascade[0].trigger !== 'always') {
    issues.push(
      `First step should use "always" trigger (currently "${cascade[0].trigger}")`
    );
  }

  // Check for missing trigger configs
  for (let i = 0; i < cascade.length; i++) {
    const step = cascade[i];

    if (step.trigger === 'on_missing_field' && !step.triggerConfig?.field) {
      issues.push(
        `Step ${i + 1} (${step.providerId}): "on_missing_field" trigger requires a field to be specified`
      );
    }

    if (step.trigger === 'on_field_present' && !step.triggerConfig?.field) {
      issues.push(
        `Step ${i + 1} (${step.providerId}): "on_field_present" trigger requires a field to be specified`
      );
    }

    if (step.trigger === 'on_condition' && !step.triggerConfig?.condition) {
      issues.push(
        `Step ${i + 1} (${step.providerId}): "on_condition" trigger requires a condition to be specified`
      );
    }
  }

  // Check for duplicate providers
  const providerCounts: Record<string, number> = {};
  for (const step of cascade) {
    providerCounts[step.providerId] = (providerCounts[step.providerId] || 0) + 1;
  }

  for (const [providerId, count] of Object.entries(providerCounts)) {
    if (count > 1) {
      issues.push(`Provider "${providerId}" appears ${count} times in the cascade`);
    }
  }

  return issues;
}
