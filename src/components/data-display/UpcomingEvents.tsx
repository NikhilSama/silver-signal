import type { KeyDate } from '@/types/database';
import { formatDate } from '@/lib/utils/format';

interface UpcomingEventsProps {
  events: KeyDate[];
}

function getDaysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getEventIcon(eventType: string): string {
  switch (eventType) {
    case 'FND': return '📅';
    case 'CONTRACT_EXPIRY': return '⏰';
    case 'COT_RELEASE': return '📊';
    case 'HOLIDAY_WINDOW': return '🏖️';
    default: return '📌';
  }
}

export function UpcomingEvents({ events }: UpcomingEventsProps) {
  if (events.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Upcoming Events</h3>
        <p className="text-gray-500 text-sm">No upcoming events</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="font-semibold text-gray-800 mb-3">Upcoming Events</h3>
      <ul className="space-y-2">
        {events.slice(0, 10).map((event) => {
          const daysUntil = getDaysUntil(new Date(event.event_date));
          const isClose = daysUntil <= 3;

          return (
            <li
              key={event.id}
              className={`flex items-start gap-2 text-sm ${
                isClose ? 'bg-yellow-50 -mx-2 px-2 py-1 rounded' : ''
              }`}
            >
              <span>{getEventIcon(event.event_type)}</span>
              <div className="flex-1">
                <div className="flex justify-between items-baseline">
                  <span className={isClose ? 'font-medium' : ''}>
                    {event.event_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {daysUntil === 0 ? 'Today' : `${daysUntil}d`}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{formatDate(event.event_date)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
