'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  BarChart3,
  List,
  SkipForward,
  AlertCircle,
  Info,
  Settings2,
  Loader2,
} from 'lucide-react';
import {
  runCascadeTest,
  runCascadeTestAsync,
  generateTestReport,
  validateCascade,
  analyzeTestReport,
  DEFAULT_TEST_CASES,
  type CascadeStep,
  type TestCase,
  type TestResult,
  type CascadeTestReport,
} from '@/lib/cascadeTestRunner';
import { PROVIDER_META } from '@/lib/providers';

interface CascadeTestPanelProps {
  cascade: CascadeStep[];
  onClose?: () => void;
}

type TestStatus = 'idle' | 'running' | 'complete' | 'error';

export default function CascadeTestPanel({ cascade, onClose }: CascadeTestPanelProps) {
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [report, setReport] = useState<CascadeTestReport | null>(null);
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(
    new Set(DEFAULT_TEST_CASES.map((tc) => tc.name))
  );
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [useSimulatedDelays, setUseSimulatedDelays] = useState(false);
  const [currentTestIndex, setCurrentTestIndex] = useState<number | null>(null);

  // Validation
  const validationIssues = useMemo(() => validateCascade(cascade), [cascade]);
  const hasValidationIssues = validationIssues.length > 0;

  // Filter test cases based on selection
  const activeTestCases = useMemo(
    () => DEFAULT_TEST_CASES.filter((tc) => selectedTestCases.has(tc.name)),
    [selectedTestCases]
  );

  // Run tests
  const handleRunTests = useCallback(async () => {
    if (cascade.length === 0) return;

    setTestStatus('running');
    setReport(null);
    setExpandedResults(new Set());

    try {
      if (useSimulatedDelays) {
        // Run with async delays for more realistic simulation
        const results: TestResult[][] = [];
        for (let i = 0; i < activeTestCases.length; i++) {
          setCurrentTestIndex(i);
          const testResults = await runCascadeTestAsync(cascade, activeTestCases[i]);
          results.push(testResults);
        }

        // Build report manually
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

        setReport({
          cascadeConfig: cascade,
          testCases: activeTestCases,
          results,
          summary: {
            totalTests: activeTestCases.length,
            allProvidersReached,
            earlyExits,
            errors,
            avgDuration_ms: totalSteps > 0 ? Math.round(totalDuration / totalSteps) : 0,
          },
          generatedAt: new Date().toISOString(),
        });
      } else {
        // Run synchronously (instant)
        const newReport = generateTestReport(cascade, activeTestCases);
        setReport(newReport);
      }

      setTestStatus('complete');
    } catch (error) {
      console.error('Test execution error:', error);
      setTestStatus('error');
    } finally {
      setCurrentTestIndex(null);
    }
  }, [cascade, activeTestCases, useSimulatedDelays]);

  // Toggle test case selection
  const toggleTestCase = (name: string) => {
    setSelectedTestCases((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Toggle all test cases
  const toggleAllTestCases = () => {
    if (selectedTestCases.size === DEFAULT_TEST_CASES.length) {
      setSelectedTestCases(new Set());
    } else {
      setSelectedTestCases(new Set(DEFAULT_TEST_CASES.map((tc) => tc.name)));
    }
  };

  // Toggle expanded result
  const toggleExpandedResult = (index: number) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Insights from report
  const insights = useMemo(() => {
    if (!report) return [];
    return analyzeTestReport(report);
  }, [report]);

  // Get provider name
  const getProviderName = (providerId: string) => {
    return PROVIDER_META[providerId]?.name || providerId;
  };

  return (
    <div className="bg-gray-50 border-t border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium text-black">Cascade Test Runner</h3>
              <p className="text-xs text-gray-500">
                Test your cascade configuration with sample data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Test Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Simulate delays</span>
              <button
                onClick={() => setUseSimulatedDelays(!useSimulatedDelays)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  useSimulatedDelays ? 'bg-black' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    useSimulatedDelays ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Run Tests Button */}
            <button
              onClick={handleRunTests}
              disabled={testStatus === 'running' || cascade.length === 0 || activeTestCases.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                testStatus === 'running' || cascade.length === 0 || activeTestCases.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              {testStatus === 'running' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running{currentTestIndex !== null ? ` (${currentTestIndex + 1}/${activeTestCases.length})` : '...'}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Tests
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
        {/* Validation Warnings */}
        {hasValidationIssues && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-amber-800">Configuration Issues</div>
                <ul className="mt-2 space-y-1">
                  {validationIssues.map((issue, i) => (
                    <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                      <span className="text-amber-400">-</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Test Cases Selection */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Test Cases</span>
              <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                {selectedTestCases.size} selected
              </span>
            </div>
            <button
              onClick={toggleAllTestCases}
              className="text-xs text-gray-500 hover:text-black transition-colors"
            >
              {selectedTestCases.size === DEFAULT_TEST_CASES.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {DEFAULT_TEST_CASES.map((testCase) => (
              <label
                key={testCase.name}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedTestCases.has(testCase.name)}
                  onChange={() => toggleTestCase(testCase.name)}
                  className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{testCase.name}</div>
                  {testCase.description && (
                    <div className="text-xs text-gray-500">{testCase.description}</div>
                  )}
                </div>
                <div className="flex-shrink-0 text-xs text-gray-400">
                  {Object.keys(testCase.data).length} fields
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Results */}
        {report && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-black">{report.summary.totalTests}</div>
                <div className="text-xs text-gray-500">Total Tests</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {report.summary.allProvidersReached}
                </div>
                <div className="text-xs text-gray-500">Full Cascades</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{report.summary.earlyExits}</div>
                <div className="text-xs text-gray-500">Early Exits</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{report.summary.errors}</div>
                <div className="text-xs text-gray-500">Errors</div>
              </div>
            </div>

            {/* Insights */}
            {insights.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-blue-800">Insights</div>
                    <ul className="mt-2 space-y-1">
                      {insights.map((insight, i) => (
                        <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                          <span className="text-blue-400">-</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Results Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Test Results</span>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {report.results.map((testResults, testIndex) => {
                  const testCase = report.testCases[testIndex];
                  const isExpanded = expandedResults.has(testIndex);
                  const triggeredCount = testResults.filter((r) => r.triggered).length;
                  const hasError = testResults.some((r) => r.error);
                  const totalDuration = testResults.reduce((sum, r) => sum + r.duration_ms, 0);

                  return (
                    <div key={testIndex}>
                      {/* Test Case Header */}
                      <button
                        onClick={() => toggleExpandedResult(testIndex)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <span className="text-gray-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{testCase.name}</div>
                        </div>

                        {/* Provider Status Icons */}
                        <div className="flex items-center gap-1">
                          {testResults.map((result, stepIndex) => (
                            <div
                              key={stepIndex}
                              className={`w-6 h-6 rounded flex items-center justify-center ${
                                result.error
                                  ? 'bg-red-100 text-red-600'
                                  : result.triggered
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-gray-100 text-gray-400'
                              }`}
                              title={`${getProviderName(result.providerId)}: ${
                                result.error ? 'Error' : result.triggered ? 'Triggered' : 'Skipped'
                              }`}
                            >
                              {result.error ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : result.triggered ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <SkipForward className="w-3.5 h-3.5" />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>
                            {triggeredCount}/{cascade.length} triggered
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {totalDuration}ms
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            hasError
                              ? 'bg-red-100 text-red-700'
                              : triggeredCount === cascade.length
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {hasError ? 'Error' : triggeredCount === cascade.length ? 'Complete' : 'Partial'}
                        </span>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                          <div className="mt-3 space-y-2">
                            {testResults.map((result, stepIndex) => (
                              <div
                                key={stepIndex}
                                className={`p-3 rounded-lg border ${
                                  result.error
                                    ? 'bg-red-50 border-red-200'
                                    : result.triggered
                                    ? 'bg-white border-gray-200'
                                    : 'bg-gray-100 border-gray-200'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                        result.triggered
                                          ? 'bg-black text-white'
                                          : 'bg-gray-300 text-gray-500'
                                      }`}
                                    >
                                      {stepIndex + 1}
                                    </span>
                                    <span className="font-medium text-sm text-gray-900">
                                      {getProviderName(result.providerId)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {result.fieldsReturned.length > 0 && (
                                      <span className="text-xs text-gray-500">
                                        {result.fieldsReturned.length} fields
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-400">
                                      {result.duration_ms}ms
                                    </span>
                                  </div>
                                </div>

                                <div className="text-xs text-gray-600">{result.reason}</div>

                                {result.error && (
                                  <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {result.error}
                                  </div>
                                )}

                                {result.fieldsReturned.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {result.fieldsReturned.map((field) => (
                                      <span
                                        key={field}
                                        className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                                      >
                                        {field}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {testStatus === 'idle' && !report && (
          <div className="text-center py-8">
            <Settings2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              Select test cases and click "Run Tests" to validate your cascade configuration
            </p>
          </div>
        )}

        {/* No Cascade Warning */}
        {cascade.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-amber-800 font-medium">No Cascade Configured</p>
            <p className="text-amber-600 text-sm">Add providers to your cascade before running tests</p>
          </div>
        )}
      </div>
    </div>
  );
}
