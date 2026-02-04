import type { PostureType } from '@/types/database';

interface PostureBannerProps {
  posture: PostureType;
  reason: string;
  indicatorCount?: { total: number; available: number };
}

const postureConfig: Record<
  PostureType,
  { bg: string; icon: string; label: string }
> = {
  BUY: { bg: 'bg-posture-buy', icon: '▲', label: 'BULLISH' },
  SELL: { bg: 'bg-posture-sell', icon: '▼', label: 'BEARISH' },
  CAUTION: { bg: 'bg-posture-caution', icon: '⚠', label: 'CAUTION' },
  NEUTRAL: { bg: 'bg-posture-neutral', icon: '—', label: 'NEUTRAL' },
  INSUFFICIENT_DATA: { bg: 'bg-posture-insufficient', icon: '?', label: 'INSUFFICIENT DATA' },
};

export function PostureBanner({
  posture,
  reason,
  indicatorCount,
}: PostureBannerProps) {
  const config = postureConfig[posture];

  return (
    <div className={`${config.bg} text-white px-6 py-4 rounded-lg mb-6`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div>
          <h2 className="text-lg font-bold">
            MARKET POSTURE: {config.label}
          </h2>
          <p className="text-sm opacity-90">{reason}</p>
          {indicatorCount && (
            <p className="text-xs opacity-75 mt-1">
              Based on {indicatorCount.available} of {indicatorCount.total} indicators
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
