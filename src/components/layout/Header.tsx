import { Suspense } from 'react';
import { formatDateTime } from '@/lib/utils/format';
import { MetalSelector } from '@/components/ui/MetalSelector';
import type { Metal, MetalConfig } from '@/lib/constants/metals';

interface HeaderProps {
  metal: Metal;
  config: MetalConfig;
  spotPrice?: number | null;
  lastUpdated?: Date | null;
}

export function Header({ metal, config, spotPrice, lastUpdated }: HeaderProps) {
  const headerColor = metal === 'gold' ? 'bg-amber-800' : 'bg-navy';
  const priceBoxColor = metal === 'gold' ? 'bg-amber-900' : 'bg-navy-dark';

  return (
    <header className={`${headerColor} text-white px-6 py-4 shadow-lg`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">COMEX {config.displayName} Monitor</h1>
          <Suspense fallback={<MetalSelectorFallback metal={metal} />}>
            <MetalSelector currentMetal={metal} />
          </Suspense>
          {spotPrice && (
            <div className={`flex items-center gap-2 ${priceBoxColor} px-3 py-1 rounded`}>
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

/** Fallback for Suspense during hydration */
function MetalSelectorFallback({ metal }: { metal: Metal }) {
  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
      <div className={`px-3 py-1.5 rounded-md text-sm font-medium ${
        metal === 'silver' ? 'bg-gray-300 text-gray-900' : 'text-white/70'
      }`}>
        <span className="hidden sm:inline">Silver</span>
        <span className="sm:hidden">Ag</span>
      </div>
      <div className={`px-3 py-1.5 rounded-md text-sm font-medium ${
        metal === 'gold' ? 'bg-amber-500 text-amber-950' : 'text-white/70'
      }`}>
        <span className="hidden sm:inline">Gold</span>
        <span className="sm:hidden">Au</span>
      </div>
    </div>
  );
}
