import type { DailyBriefing as DailyBriefingType } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatDateTime } from '@/lib/utils/format';

interface DailyBriefingProps {
  briefing: DailyBriefingType | null;
}

function getPostureBadgeVariant(
  posture: string
): 'green' | 'red' | 'yellow' | 'gray' {
  switch (posture) {
    case 'BUY': return 'green';
    case 'SELL': return 'red';
    case 'CAUTION': return 'yellow';
    default: return 'gray';
  }
}

export function DailyBriefing({ briefing }: DailyBriefingProps) {
  if (!briefing) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Daily Briefing</h3>
        <div className="text-center py-6">
          <p className="text-gray-500">Briefing will be generated at 7:00 PM ET</p>
          <p className="text-xs text-gray-400 mt-1">
            Awaiting first briefing generation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">
          Daily Briefing — {formatDate(briefing.briefing_date)}
        </h3>
        <Badge variant={getPostureBadgeVariant(briefing.overall_posture)}>
          {briefing.overall_posture}
        </Badge>
      </div>

      <div className="prose prose-sm max-w-none text-gray-700">
        {briefing.briefing_text.split('\n\n').map((paragraph, i) => (
          <p key={i} className="mb-3 last:mb-0">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
        Generated at {formatDateTime(briefing.generated_at)} using Claude Sonnet.
        <br />
        <em>This is not financial advice.</em>
      </div>
    </div>
  );
}
