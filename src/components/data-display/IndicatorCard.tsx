import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IndicatorTooltip } from './IndicatorTooltip';
import { formatDateTime, formatPercent } from '@/lib/utils/format';
import type { IndicatorCardData, IndicatorDisplayState } from '@/types/indicator';
import type { SignalType } from '@/types/database';

interface IndicatorCardProps {
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

export function IndicatorCard({ data }: IndicatorCardProps) {
  const variant = getHeaderVariant(data.displayState, data.signal);

  return (
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
          <CardContent data={data} />
        </CardBody>
      </Card>
    </IndicatorTooltip>
  );
}

function CardContent({ data }: { data: IndicatorCardData }) {
  // Awaiting state
  if (data.displayState === 'awaiting') {
    return (
      <div className="text-center py-4">
        <p className="text-blue-600 font-medium">AWAITING DATA</p>
        <p className="text-xs text-gray-500 mt-1">First data pull pending</p>
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

      <p
        className={`text-xs mt-2 ${
          data.displayState === 'stale' ? 'text-orange-600' : 'text-gray-400'
        }`}
      >
        Updated: {data.dataDate ? formatDateTime(data.dataDate) : 'Unknown'}
      </p>
    </div>
  );
}
