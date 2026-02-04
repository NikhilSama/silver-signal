interface BadgeProps {
  variant: 'green' | 'yellow' | 'red' | 'gray' | 'orange' | 'blue';
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeProps['variant'], string> = {
  green: 'bg-signal-green text-white',
  yellow: 'bg-signal-amber text-black',
  red: 'bg-signal-red text-white',
  gray: 'bg-signal-gray text-white',
  orange: 'bg-orange-500 text-white',
  blue: 'bg-blue-500 text-white',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
