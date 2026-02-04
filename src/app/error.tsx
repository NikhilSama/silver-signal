'use client';

interface ErrorPageProps {
  error: Error;
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Dashboard Error
        </h1>
        <p className="text-gray-600 mb-6">
          {error.message || 'Failed to load the dashboard. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-navy text-white rounded-lg hover:bg-navy-dark transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
