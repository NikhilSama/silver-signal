interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'green' | 'yellow' | 'red' | 'gray' | 'blue';
}

const headerVariants: Record<NonNullable<CardHeaderProps['variant']>, string> = {
  green: 'bg-signal-green',
  yellow: 'bg-signal-amber',
  red: 'bg-signal-red',
  gray: 'bg-signal-gray',
  blue: 'bg-blue-600',
};

export function CardHeader({
  children,
  className = '',
  variant = 'gray',
}: CardHeaderProps) {
  return (
    <div className={`px-4 py-2 text-white ${headerVariants[variant]} ${className}`}>
      {children}
    </div>
  );
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
