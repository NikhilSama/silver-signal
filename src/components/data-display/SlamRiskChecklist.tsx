import type { SlamRiskItem } from '@/types/indicator';

interface SlamRiskChecklistProps {
  items: SlamRiskItem[];
}

export function SlamRiskChecklist({ items }: SlamRiskChecklistProps) {
  const activeCount = items.filter((i) => i.active).length;
  const isElevated = activeCount >= 3;

  return (
    <div
      className={`px-4 py-3 rounded-lg mb-6 ${
        isElevated
          ? 'bg-red-100 border-2 border-red-500'
          : 'bg-gray-100 border border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Pre-Slam Risk Checklist
        </span>
        {isElevated && (
          <span className="text-xs font-bold text-red-600 animate-pulse">
            ⚠ SLAM RISK ELEVATED
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-1.5" title={item.reason}>
            <span
              className={`w-3 h-3 rounded-full ${
                item.active
                  ? 'bg-red-500'
                  : 'bg-gray-300 border border-gray-400'
              }`}
            />
            <span
              className={`text-xs ${
                item.active ? 'text-red-700 font-medium' : 'text-gray-500'
              }`}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Default slam risk items (all inactive) */
export const DEFAULT_SLAM_RISK_ITEMS: SlamRiskItem[] = [
  { id: 'cot-short', label: 'COT Short Build', active: false },
  { id: 'margin-hike', label: 'Margin Hike', active: false },
  { id: 'oi-drop', label: 'OI Drop (no news)', active: false },
  { id: 'spread-widen', label: 'Spread Widens', active: false },
  { id: 'thin-liquidity', label: 'Thin Liquidity', active: false },
];
