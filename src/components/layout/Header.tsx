import { formatDateTime } from '@/lib/utils/format';

interface HeaderProps {
  spotPrice?: number | null;
  lastUpdated?: Date | null;
}

export function Header({ spotPrice, lastUpdated }: HeaderProps) {
  return (
    <header className="bg-navy text-white px-6 py-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">COMEX Silver Monitor</h1>
          {spotPrice && (
            <div className="flex items-center gap-2 bg-navy-dark px-3 py-1 rounded">
              <span className="text-gray-400 text-sm">Spot:</span>
              <span className="text-lg font-semibold">${spotPrice.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="text-right text-sm text-gray-300">
          <div>{new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}</div>
          {lastUpdated && (
            <div className="text-xs text-gray-400">
              Last updated: {formatDateTime(lastUpdated)}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
