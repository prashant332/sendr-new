"use client";

import { useState, useCallback } from "react";
import { runWorkflow, RunSummary, RequestResult } from "@/lib/workflowRunner";
import { useEnvironmentStore } from "@/store/environmentStore";

interface WorkflowRunnerProps {
  collectionId: string;
  collectionName: string;
  onClose: () => void;
}

export function WorkflowRunner({
  collectionId,
  collectionName,
  onClose,
}: WorkflowRunnerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [currentRequestName, setCurrentRequestName] = useState<string | null>(null);
  const getActiveVariables = useEnvironmentStore((s) => s.getActiveVariables);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setSummary(null);
    setCurrentRequestName(null);

    try {
      await runWorkflow(
        {
          collectionId,
          initialVariables: getActiveVariables(),
          delay: 100,
          stopOnError: false,
        },
        (event, data) => {
          setSummary({ ...data.summary });
          if (event === "request_start" && data.currentRequest) {
            setCurrentRequestName(data.currentRequest.name);
          }
          if (event === "request_complete") {
            setCurrentRequestName(null);
          }
        }
      );
      // Variables are already captured in the workflow runner
    } catch (error) {
      console.error("Workflow error:", error);
    } finally {
      setIsRunning(false);
    }
  }, [collectionId, getActiveVariables]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Run Collection</h2>
            <p className="text-sm text-zinc-400">{collectionName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Run Button */}
          {!isRunning && !summary && (
            <div className="text-center py-8">
              <p className="text-zinc-400 mb-4">
                Run all requests in this collection sequentially.
                Variables set in earlier requests will be available in later ones.
              </p>
              <button
                onClick={handleRun}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
              >
                Run Collection
              </button>
            </div>
          )}

          {/* Progress */}
          {isRunning && summary && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">
                  {currentRequestName
                    ? `Running: ${currentRequestName}`
                    : "Running..."}
                </span>
                <span className="text-zinc-400">
                  {summary.completedRequests} / {summary.totalRequests}
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${(summary.completedRequests / summary.totalRequests) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Summary Stats */}
          {summary && !isRunning && (
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                label="Requests"
                value={`${summary.completedRequests}/${summary.totalRequests}`}
                color="text-blue-400"
              />
              <StatCard
                label="Failed"
                value={summary.failedRequests.toString()}
                color={summary.failedRequests > 0 ? "text-red-400" : "text-green-400"}
              />
              <StatCard
                label="Tests Passed"
                value={`${summary.passedTests}/${summary.totalTests}`}
                color={summary.failedTests > 0 ? "text-yellow-400" : "text-green-400"}
              />
              <StatCard
                label="Duration"
                value={formatDuration((summary.endTime || Date.now()) - summary.startTime)}
                color="text-zinc-300"
              />
            </div>
          )}

          {/* Results List */}
          {summary && summary.results.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-300">Results</h3>
              <div className="space-y-1">
                {summary.results.map((result, index) => (
                  <ResultItem key={result.requestId} result={result} index={index} />
                ))}
              </div>
            </div>
          )}

          {/* Run Again */}
          {summary && !isRunning && (
            <div className="pt-4 border-t border-zinc-700 flex justify-center">
              <button
                onClick={handleRun}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm"
              >
                Run Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-zinc-800 rounded p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function ResultItem({ result, index }: { result: RequestResult; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const hasError = result.error || result.statusCode >= 400;
  const hasFailedTests = result.testResults.some((t) => !t.passed);

  return (
    <div className="bg-zinc-800 rounded overflow-hidden">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-zinc-750"
      >
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-xs w-6">{index + 1}</span>
          <span
            className={`text-xs font-medium ${
              result.method === "GET"
                ? "text-green-400"
                : result.method === "POST"
                ? "text-yellow-400"
                : result.method === "PUT"
                ? "text-blue-400"
                : result.method === "DELETE"
                ? "text-red-400"
                : "text-purple-400"
            }`}
          >
            {result.method}
          </span>
          <span className="text-sm text-zinc-300">{result.requestName}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Status */}
          <span
            className={`text-sm ${
              hasError ? "text-red-400" : "text-green-400"
            }`}
          >
            {result.statusCode || "ERR"}
          </span>
          {/* Test results indicator */}
          {result.testResults.length > 0 && (
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                hasFailedTests
                  ? "bg-red-900/50 text-red-400"
                  : "bg-green-900/50 text-green-400"
              }`}
            >
              {result.testResults.filter((t) => t.passed).length}/
              {result.testResults.length} tests
            </span>
          )}
          {/* Duration */}
          <span className="text-xs text-zinc-500">{result.duration}ms</span>
          {/* Expand icon */}
          <span className="text-zinc-500 text-xs">
            {expanded ? "▼" : "▶"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-700 p-3 space-y-2">
          {/* URL */}
          <div className="text-xs text-zinc-500 break-all">{result.url}</div>

          {/* Error */}
          {result.error && (
            <div className="text-sm text-red-400 bg-red-900/20 p-2 rounded">
              {result.error}
            </div>
          )}

          {/* Test Results */}
          {result.testResults.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-zinc-400">Tests:</span>
              {result.testResults.map((test, i) => (
                <div
                  key={i}
                  className={`text-xs flex items-center gap-2 ${
                    test.passed ? "text-green-400" : "text-red-400"
                  }`}
                >
                  <span>{test.passed ? "✓" : "✗"}</span>
                  <span>{test.name}</span>
                  {test.error && (
                    <span className="text-zinc-500">- {test.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Logs */}
          {result.logs.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-zinc-400">Console:</span>
              <div className="bg-zinc-900 p-2 rounded text-xs font-mono text-zinc-400">
                {result.logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
