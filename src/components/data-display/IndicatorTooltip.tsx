'use client';

import { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  what: string;
  why: string;
  now: string | null;
  children: React.ReactNode;
}

export function IndicatorTooltip({ what, why, now, children }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div
      ref={tooltipRef}
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {children}

      {isOpen && (
        <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-xl p-4 text-sm">
          <TooltipSection title="WHAT THIS MEASURES" content={what} />
          <TooltipSection title="WHY IT MATTERS" content={why} />
          {now && <TooltipSection title="WHAT IT SAYS NOW" content={now} isLast />}

          {/* Arrow */}
          <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  );
}

function TooltipSection({
  title,
  content,
  isLast = false,
}: {
  title: string;
  content: string;
  isLast?: boolean;
}) {
  return (
    <div className={isLast ? '' : 'mb-3'}>
      <h4 className="text-xs font-bold text-gray-400 uppercase mb-1">{title}</h4>
      <p className="text-gray-200 leading-relaxed">{content}</p>
    </div>
  );
}
