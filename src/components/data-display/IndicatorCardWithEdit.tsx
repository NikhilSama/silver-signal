'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IndicatorTooltip } from './IndicatorTooltip';
import { EditValueModal } from './EditValueModal';
import { EditPromptModal } from './EditPromptModal';
import { formatDateTime, formatPercent } from '@/lib/utils/format';
import type { IndicatorCardData, IndicatorDisplayState } from '@/types/indicator';
import type { SignalType } from '@/types/database';

interface IndicatorCardWithEditProps {
  data: IndicatorCardData;
}

function getHeaderVariant(
  displayState: IndicatorDisplayState,
  signal: SignalType | null
): 'green' | 'yellow' | 'red' | 'gray' | 'blue' {
  if (displayState === 'awaiting') return 'blue';
  if (displayState === 'error' || displayState === 'not_applicable') return 'gray';
  if (displayState === 'stale') return signal === 'green' ? 'green' : signal === 'yellow' ? 'yellow' : signal === 'red' ? 'red' : 'gray';
  if (signal === 'green') return 'green';
  if (signal === 'yellow') return 'yellow';
  if (signal === 'red') return 'red';
  return 'gray';
}

function TrendArrow({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  const config = {
    up: { symbol: '↑', color: 'text-green-600' },
    down: { symbol: '↓', color: 'text-red-600' },
    flat: { symbol: '→', color: 'text-gray-500' },
  };
  const { symbol, color } = config[direction];
  return <span className={`text-lg font-bold ${color}`}>{symbol}</span>;
}

interface SourceInfo {
  display: string;
  href: string | null;
  tooltip?: string;
}

// Derivation formulas for derived indicators
const DERIVATION_FORMULAS: Record<string, { display: string; formula: string; inputs: string }> = {
  'derived from spot/futures spread': {
    display: 'Derived',
    formula: 'SOFR - ((Futures/Spot - 1) × (360/days) × 100)',
    inputs: 'Inputs: Spot price, Futures price, Days to expiry, SOFR rate',
  },
  'derived from backwardation': {
    display: 'Derived',
    formula: 'SOFR - ((Futures/Spot - 1) × (360/days) × 100)',
    inputs: 'Inputs: Spot price, Futures price, Days to expiry, SOFR rate',
  },
  'derived from OI and vault data': {
    display: 'Derived',
    formula: '(front_month_OI × 5,000 oz) ÷ registered_ounces',
    inputs: 'Inputs: Front-month Open Interest, COMEX Registered Silver',
  },
  'derived from daily OHLC': {
    display: 'Derived',
    formula: '(daily_high - daily_low) ÷ daily_close × 100',
    inputs: 'Inputs: Daily High, Low, Close prices from spot market',
  },
};

function formatSourceUrl(url: string | null): SourceInfo {
  if (!url) return { display: 'Unknown', href: null };
  if (url === 'manual-edit') return { display: 'Manual Edit', href: null };
  if (url === 'hardcoded-fallback') return { display: 'Fallback Value', href: null };
  if (url === 'browser-use-cloud') return { display: 'Browser Automation', href: null };

  // Check for derived indicators
  const derivation = DERIVATION_FORMULAS[url];
  if (derivation) {
    return {
      display: derivation.display,
      href: null,
      tooltip: `Formula: ${derivation.formula}\n${derivation.inputs}`,
    };
  }

  if (url.startsWith('derived')) {
    return { display: 'Derived', href: null, tooltip: 'Calculated from other indicators' };
  }

  try {
    const urlObj = new URL(url);
    return { display: urlObj.hostname.replace('www.', ''), href: url };
  } catch {
    return { display: url.substring(0, 30), href: null };
  }
}

export function IndicatorCardWithEdit({ data }: IndicatorCardWithEditProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPromptEditOpen, setIsPromptEditOpen] = useState(false);
  const router = useRouter();
  const variant = getHeaderVariant(data.displayState, data.signal);

  const handleSave = async (newValue: number, reason: string) => {
    const response = await fetch('/api/manual-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        indicatorId: data.indicatorId,
        newValue,
        reason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save');
    }

    // Refresh the page to show updated data
    router.refresh();
  };

  const handlePromptSave = () => {
    // Refresh the page to show updated data
    router.refresh();
  };

  return (
    <>
      <IndicatorTooltip
        what={data.fullDescription}
        why={data.whyItWorks}
        now={data.signalReason}
      >
        <Card className="h-full cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader variant={variant} className="relative">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">
                #{data.indicatorId} {data.name}
              </span>
              {data.displayState === 'stale' && (
                <Badge variant="orange" className="ml-2">STALE</Badge>
              )}
            </div>
          </CardHeader>

          <CardBody>
            <CardContent
              data={data}
              onEditClick={() => setIsEditOpen(true)}
              onPromptEditClick={() => setIsPromptEditOpen(true)}
            />
          </CardBody>
        </Card>
      </IndicatorTooltip>

      <EditValueModal
        indicatorId={data.indicatorId}
        indicatorName={data.name}
        currentValue={data.rawValue}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleSave}
      />

      <EditPromptModal
        indicatorId={data.indicatorId}
        indicatorName={data.name}
        isOpen={isPromptEditOpen}
        onClose={() => setIsPromptEditOpen(false)}
        onSave={handlePromptSave}
      />
    </>
  );
}

function CardContent({
  data,
  onEditClick,
  onPromptEditClick,
}: {
  data: IndicatorCardData;
  onEditClick: () => void;
  onPromptEditClick: () => void;
}) {
  // Awaiting state
  if (data.displayState === 'awaiting') {
    return (
      <div className="text-center py-4">
        <p className="text-blue-600 font-medium">AWAITING DATA</p>
        <p className="text-xs text-gray-500 mt-1">First data pull pending</p>
        {data.hasBrowserPrompt && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPromptEditClick();
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline mt-2"
          >
            Configure Browser Prompt
          </button>
        )}
      </div>
    );
  }

  // Error state
  if (data.displayState === 'error') {
    return (
      <div className="text-center py-2">
        <p className="text-red-600 font-medium italic">DATA UNAVAILABLE</p>
        <p className="text-xs text-gray-500 mt-1">{data.errorDetail}</p>
        {data.fetchedAt && (
          <p className="text-xs text-gray-400 mt-2">
            Last attempt: {formatDateTime(data.fetchedAt)}
          </p>
        )}
        <div className="flex justify-center gap-2 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditClick();
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Enter manually
          </button>
          {data.hasBrowserPrompt && (
            <>
              <span className="text-gray-400">|</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPromptEditClick();
                }}
                className="text-xs text-purple-600 hover:text-purple-800 underline"
              >
                Edit Prompt
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Not applicable state
  if (data.displayState === 'not_applicable') {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500 font-medium">NOT IN DELIVERY MONTH</p>
      </div>
    );
  }

  // Normal display (success or stale)
  const source = formatSourceUrl(data.sourceUrl);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl font-bold text-gray-900">{data.currentValue}</span>
        {data.trendDirection && <TrendArrow direction={data.trendDirection} />}
      </div>

      <p className="text-sm font-medium text-gray-700 mb-2">{data.signalLabel}</p>

      {data.weekOverWeekChange !== null && (
        <p className="text-xs text-gray-500">
          {formatPercent(data.weekOverWeekChange)} WoW
        </p>
      )}

      <div className={`text-xs mt-2 ${data.displayState === 'stale' ? 'text-orange-600' : 'text-gray-400'}`}>
        <p>Updated: {data.dataDate ? formatDateTime(data.dataDate) : 'Unknown'}</p>
        <p className="flex items-center flex-wrap gap-1 mt-0.5">
          Source:{' '}
          {source.href ? (
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {source.display}
            </a>
          ) : source.tooltip ? (
            <span
              className="cursor-help border-b border-dotted border-gray-400 relative group"
              onClick={(e) => e.stopPropagation()}
            >
              {source.display}
              <span className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-pre-line z-50 min-w-[280px] shadow-lg">
                {source.tooltip}
              </span>
            </span>
          ) : (
            <span>{source.display}</span>
          )}
          <span className="mx-0.5">|</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditClick();
            }}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Edit
          </button>
          {data.hasBrowserPrompt && (
            <>
              <span className="mx-0.5">|</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPromptEditClick();
                }}
                className="text-purple-600 hover:text-purple-800 underline"
              >
                Prompt
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
