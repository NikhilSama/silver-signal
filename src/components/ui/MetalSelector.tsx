'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Metal } from '@/lib/constants/metals';

interface MetalSelectorProps {
  currentMetal: Metal;
}

export function MetalSelector({ currentMetal }: MetalSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleMetalChange = (metal: Metal) => {
    const params = new URLSearchParams(searchParams.toString());
    if (metal === 'silver') {
      params.delete('metal'); // Silver is default
    } else {
      params.set('metal', metal);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
      <MetalButton
        metal="silver"
        label="Ag"
        fullLabel="Silver"
        isActive={currentMetal === 'silver'}
        onClick={() => handleMetalChange('silver')}
      />
      <MetalButton
        metal="gold"
        label="Au"
        fullLabel="Gold"
        isActive={currentMetal === 'gold'}
        onClick={() => handleMetalChange('gold')}
      />
    </div>
  );
}

interface MetalButtonProps {
  metal: Metal;
  label: string;
  fullLabel: string;
  isActive: boolean;
  onClick: () => void;
}

function MetalButton({ metal, label, fullLabel, isActive, onClick }: MetalButtonProps) {
  const baseStyles = 'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200';
  const activeStyles = metal === 'silver'
    ? 'bg-gray-300 text-gray-900'
    : 'bg-amber-500 text-amber-950';
  const inactiveStyles = 'text-white/70 hover:text-white hover:bg-white/10';

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${isActive ? activeStyles : inactiveStyles}`}
      title={fullLabel}
    >
      <span className="hidden sm:inline">{fullLabel}</span>
      <span className="sm:hidden">{label}</span>
    </button>
  );
}
