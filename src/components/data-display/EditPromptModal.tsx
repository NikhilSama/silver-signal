'use client';

import { useState, useEffect } from 'react';

interface BrowserPromptData {
  indicatorId: number;
  prompt: string;
  targetUrl: string;
  lastUpdated?: string;
  lastRunAt?: string;
  lastRunSuccess?: boolean;
  lastRunError?: string;
}

interface EditPromptModalProps {
  indicatorId: number;
  indicatorName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function EditPromptModal({
  indicatorId,
  indicatorName,
  isOpen,
  onClose,
  onSave,
}: EditPromptModalProps) {
  const [prompt, setPrompt] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{ success?: boolean; error?: string } | null>(null);

  // Fetch current prompt when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      fetch(`/api/browser-prompt?indicatorId=${indicatorId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.prompt) {
            setPrompt(data.prompt.prompt);
            setTargetUrl(data.prompt.targetUrl);
            if (data.prompt.lastRunAt) {
              setLastRun({
                success: data.prompt.lastRunSuccess,
                error: data.prompt.lastRunError,
              });
            }
          } else {
            // Default prompts for indicators that don't have one yet
            setPrompt('');
            setTargetUrl('');
          }
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, indicatorId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!prompt.trim()) {
      setError('Prompt is required');
      return;
    }

    if (!targetUrl.trim()) {
      setError('Target URL is required');
      return;
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/browser-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indicatorId,
          prompt: prompt.trim(),
          targetUrl: targetUrl.trim(),
          runImmediately: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save prompt');
      }

      if (data.runResult) {
        setLastRun({
          success: data.runResult.success,
          error: data.runResult.error,
        });

        if (!data.runResult.success) {
          setError(`Task failed: ${data.runResult.error}`);
          return;
        }
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Edit Browser Prompt - #{indicatorId} {indicatorName}
        </h2>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-500">Loading prompt...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="targetUrl" className="block text-sm font-medium text-gray-700 mb-1">
                Target URL
              </label>
              <input
                type="url"
                id="targetUrl"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="https://www.cmegroup.com/..."
              />
              <p className="text-xs text-gray-500 mt-1">
                The website URL that Browser Use will navigate to
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
                Browser Use Prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="Instructions for Browser Use to extract the value..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Instructions for the browser automation to find and extract the value.
                The prompt should end with instructions to return ONLY the numeric value.
              </p>
            </div>

            {lastRun && (
              <div className={`mb-4 p-3 rounded-md ${lastRun.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`text-sm ${lastRun.success ? 'text-green-700' : 'text-red-700'}`}>
                  <strong>Last run:</strong>{' '}
                  {lastRun.success ? 'Successful' : `Failed - ${lastRun.error}`}
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 rounded-md">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Running...
                  </>
                ) : (
                  'Save & Run'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
