'use client';
import React, { useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUser } from '@/components/UserProvider';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import GlobalErrorBanner from '@/components/GlobalErrorBanner';
import { ChatProvider } from '@/components/ChatProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useUser();
  const { status, data: session } = useSession();

  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log('[HOME ACCESS CHECK] mounted:', mounted, '| status:', status, '| isAuthenticated:', isAuthenticated);
    if (mounted && status === 'unauthenticated') {
      console.warn('[MIDDLEWARE DECISION] status=unauthenticated → router.replace("/") ← THIS IS THE LINE SENDING USER BACK');
      router.replace('/');
    }
  }, [mounted, status, router, isAuthenticated]);

  // Prevent hydration mismatch by rendering null on the server and first client pass
  if (!mounted || status === 'loading') {
    return null;
  }

  // Final rendering protection
  if (status === 'unauthenticated' && !isAuthenticated && localStorage.getItem('isLoggedIn') !== 'true') {
     return null;
  }

  return (
    <ChatProvider>
      <DashboardLayout>
        <GlobalErrorBanner />
        {children}
      </DashboardLayout>
    </ChatProvider>
  );
}
