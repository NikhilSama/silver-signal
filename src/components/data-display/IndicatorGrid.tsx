import { IndicatorCardWithEdit } from './IndicatorCardWithEdit';
import type { IndicatorCardData } from '@/types/indicator';

interface IndicatorGridProps {
  indicators: IndicatorCardData[];
}

export function IndicatorGrid({ indicators }: IndicatorGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {indicators.map((indicator) => (
        <IndicatorCardWithEdit key={indicator.indicatorId} data={indicator} />
      ))}
    </div>
  );
}
