import type { ReactNode } from 'react';

interface FooterProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'sticky';
}

export function Footer({
  children,
  className = '',
  variant = 'default'
}: FooterProps) {
  const baseStyles = 'bg-white border-t border-gray-200';

  const variantStyles: Record<string, string> = {
    default: 'px-6 py-3',
    compact: 'px-4 py-2',
    sticky: 'px-6 py-3 sticky bottom-0 z-10'
  };

  return (
    <footer className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </footer>
  );
}
