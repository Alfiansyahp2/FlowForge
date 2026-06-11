import type { ReactNode } from 'react';

interface HeaderProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'transparent';
}

export function Header({
  children,
  className = '',
  variant = 'default'
}: HeaderProps) {
  const baseStyles = 'bg-white border-b border-gray-200';

  const variantStyles: Record<string, string> = {
    default: 'px-6 py-4',
    compact: 'px-4 py-2.5',
    transparent: 'px-6 py-4 bg-transparent border-none'
  };

  return (
    <header className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </header>
  );
}
