import type { ReactNode } from 'react';

interface MainProps {
  children: ReactNode;
  className?: string;
}

export function Main({
  children,
  className = ''
}: MainProps) {
  return (
    <main className={`flex flex-col h-full min-w-0 ${className}`}>
      {children}
    </main>
  );
}
