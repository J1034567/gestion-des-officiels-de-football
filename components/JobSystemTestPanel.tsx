/**
 * Job System Test Panel Component
 * A React component for testing the consolidated job system
 */

import React, { useState } from "react";
import { useNotificationContext } from "../contexts/NotificationContext";
import { quickJobSystemTest } from "../tests/quick-job-test";
import { jobService } from "../services/jobService";
import { JobKinds } from "../supabase/functions/_shared/jobKinds";

interface TestResult {
  testName: string;
  status: "pending" | "success" | "error";
  message: string;
  duration?: number;
  details?: any;
}

export const JobSystemTestPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [selectedTest, setSelectedTest] = useState<string>("all");
  const { showNotification } = useNotificationContext();

  const tests = {
    all: "Run All Tests",
    jobCreation: "Job Creation",
    jobsTable: "Jobs Table Access",
    processJobsFunction: "Process Jobs Function",
    jobStats: "Job Statistics",
    bulkPDF: "Bulk PDF Generation",
    bulkEmail: "Bulk Email Sending",
  };

  const runTest = async (testName: string) => {
    const startTime = Date.now();

    try {
      let result;

      switch (testName) {
        case "jobCreation":
          result = await quickJobSystemTest.testJobCreation();
          break;
        case "jobsTable":
          result = await quickJobSystemTest.testJobsTable();
          break;
        case "processJobsFunction":
          result = await quickJobSystemTest.testProcessJobsFunction();
          break;
        case "jobStats":
          result = await quickJobSystemTest.testJobStats();
          break;
        case "bulkPDF":
          result = await testBulkPDF();
          break;
        case "bulkEmail":
          result = await testBulkEmail();
          break;
        default:
          result = await quickJobSystemTest.runAllTests();
      }

      return {
        testName,
        status: "success" as const,
        message: "Test completed successfully",
        duration: Date.now() - startTime,
        details: result,
      };
    } catch (error: any) {
      return {
        testName,
        status: "error" as const,
        message: error.message || "Test failed",
        duration: Date.now() - startTime,
        details: error,
      };
    }
  };

  const testBulkPDF = async () => {
    const job = await jobService.enqueueJob({
      type: JobKinds.MissionOrdersBulkPdf,
      label: "Test Bulk PDF Generation",
      payload: {
        orders: [
          { matchId: "test-match-1", officialId: "test-official-1" },
          { matchId: "test-match-2", officialId: "test-official-2" },
        ],
        fileName: "test-bulk.pdf",
      },
      total: 2,
    });

    return { jobId: job.id, status: job.status, type: job.type };
  };

  const testBulkEmail = async () => {
    const job = await jobService.enqueueJob({
      type: JobKinds.MatchSheetsBulkEmail,
      label: "Test Bulk Email Sending",
      payload: {
        recipients: [
          { email: "test1@example.com", name: "Test User 1" },
          { email: "test2@example.com", name: "Test User 2" },
        ],
        subject: "Integration Test Email",
        message: "This is a test email from the job system integration test.",
        test: true,
      },
      total: 2,
    });

    return { jobId: job.id, status: job.status, type: job.type };
  };

  const handleRunTests = async () => {
    setIsRunning(true);
    setResults([]);
    showNotification(
      `Starting ${tests[selectedTest as keyof typeof tests]}...`,
      "info"
    );

    try {
      if (selectedTest === "all") {
        // Run all tests sequentially
        const testNames = Object.keys(tests).filter((key) => key !== "all");
        const testResults: TestResult[] = [];

        for (const testName of testNames) {
          setResults((prev) => [
            ...prev,
            {
              testName,
              status: "pending",
              message: "Running...",
            },
          ]);

          const result = await runTest(testName);
          testResults.push(result);

          setResults((prev) =>
            prev.map((r) => (r.testName === testName ? result : r))
          );
        }

        const successCount = testResults.filter(
          (r) => r.status === "success"
        ).length;
        const totalCount = testResults.length;

        if (successCount === totalCount) {
          showNotification(`All ${totalCount} tests passed! 🎉`, "success");
        } else {
          showNotification(
            `${totalCount - successCount} out of ${totalCount} tests failed.`,
            "error"
          );
        }
      } else {
        // Run single test
        setResults([
          {
            testName: selectedTest,
            status: "pending",
            message: "Running...",
          },
        ]);

        const result = await runTest(selectedTest);
        setResults([result]);

        if (result.status === "success") {
          showNotification(
            `Test "${tests[selectedTest as keyof typeof tests]}" passed! ✅`,
            "success"
          );
        } else {
          showNotification(
            `Test "${tests[selectedTest as keyof typeof tests]}" failed: ${
              result.message
            }`,
            "error"
          );
        }
      }
    } catch (error: any) {
      showNotification(`Test execution failed: ${error.message}`, "error");
      setResults((prev) =>
        prev.map((r) => ({
          ...r,
          status: "error" as const,
          message: error.message,
        }))
      );
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "success":
        return "✅";
      case "error":
        return "❌";
      default:
        return "❓";
    }
  };

  const getStatusColor = (status: TestResult["status"]) => {
    switch (status) {
      case "pending":
        return "text-yellow-600";
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🧪 Job System Integration Tests
        </h2>
        <p className="text-gray-600">
          Test the consolidated job processing system to ensure all components
          are working correctly.
        </p>
      </div>

      <div className="mb-6 flex gap-4 items-center">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Test:
          </label>
          <select
            value={selectedTest}
            onChange={(e) => setSelectedTest(e.target.value)}
            disabled={isRunning}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {Object.entries(tests).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className={`px-6 py-2 rounded-md font-medium ${
            isRunning
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isRunning ? "Running..." : "Run Tests"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Test Results:</h3>

          {results.map((result, index) => (
            <div
              key={`${result.testName}-${index}`}
              className={`border rounded-lg p-4 ${
                result.status === "success"
                  ? "border-green-200 bg-green-50"
                  : result.status === "error"
                  ? "border-red-200 bg-red-50"
                  : "border-yellow-200 bg-yellow-50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {getStatusIcon(result.status)}
                  </span>
                  <span className="font-medium text-gray-900">
                    {tests[result.testName as keyof typeof tests] ||
                      result.testName}
                  </span>
                </div>
                {result.duration && (
                  <span className="text-sm text-gray-500">
                    {result.duration}ms
                  </span>
                )}
              </div>

              <p className={`text-sm ${getStatusColor(result.status)}`}>
                {result.message}
              </p>

              {result.details && result.status === "success" && (
                <details className="mt-2">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                    View Details
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}

              {result.details && result.status === "error" && (
                <div className="mt-2 text-xs text-red-700 bg-red-100 p-2 rounded">
                  <strong>Error Details:</strong> {result.details}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">💡 Testing Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Start with "Job Creation" to verify basic functionality</li>
          <li>• "Jobs Table Access" checks database connectivity</li>
          <li>• "Process Jobs Function" tests the Edge Function deployment</li>
          <li>• "Bulk PDF/Email" tests end-to-end job processing</li>
          <li>• Use "Run All Tests" for comprehensive system validation</li>
        </ul>
      </div>
    </div>
  );
};

export default JobSystemTestPanel;
