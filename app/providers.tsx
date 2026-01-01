'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { privyConfig, getPrivyAppId } from '@/lib/privy';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const appId = getPrivyAppId();

  // If no app ID, render children without Privy (for development)
  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={privyConfig}
    >
      {children}
    </PrivyProvider>
  );
}
