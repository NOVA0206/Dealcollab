'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNotifications } from './NotificationProvider';
import { useSession, signOut } from 'next-auth/react';
import { createSupabaseClient } from '@/utils/supabase/client';

interface UserContextType {
  tokens: number;
  approvedDeals: number[];
  isEOIApproved: (dealId: number) => boolean;
  approveEOI: (dealId: number) => void;
  canSendEOI: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: (reason?: 'session_expired' | 'link_expired') => void;
  onboarding: {
    phoneVerified: boolean;
    profileCompleted: boolean;
    dealSubmitted: boolean;
  };
  setOnboarding: (step: 'phoneVerified' | 'profileCompleted' | 'dealSubmitted', value: boolean) => void;
  readinessScore: {
    phone: number;
    identity: number;
    geography: number;
    expertise: number;
    intent: number;
    collaboration: number;
    additional: number;
  };
  updateReadiness: (key: keyof UserContextType['readinessScore'], value: number) => void;
  addTokens: (amount: number) => void;
  totalScore: number;
  globalError: string | null;
  setGlobalError: (error: string | null) => void;
  profile: any | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { addNotification } = useNotifications();
  const { data: session, status } = useSession();
  const [supabase] = useState(() => createSupabaseClient());
  
  const [tokens, setTokens] = useState(0);
  const [profile, setProfile] = useState<any | null>(null);
  const [approvedDeals, setApprovedDeals] = useState<number[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const [onboarding, setOnboardingState] = useState({
    phoneVerified: false,
    profileCompleted: false,
    dealSubmitted: false,
  });

  const [readinessScore, setReadinessScore] = useState({
    phone: 0,
    identity: 0,
    geography: 0,
    expertise: 0,
    intent: 0,
    collaboration: 0,
    additional: 0,
  });

  // Sync with Supabase (REAL DATA)
  useEffect(() => {
    async function fetchSupabaseData() {
      const userEmail = session?.user?.email?.trim().toLowerCase();
      if (!userEmail) return;

      console.log("FETCHING SUPABASE DATA FOR EMAIL:", userEmail);
      setIsAuthenticated(true);
      
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .ilike("email", userEmail)
        .maybeSingle();

      console.log("SUPABASE FETCH RESULT:", data);

      if (error) {
        console.error("SUPABASE ERROR:", error);
        return;
      }

      if (data) {
        setTokens(data.tokens || 0);
        setProfile({
          ...data,
          fullName: data.name,
          firmName: data.firm_name,
          customCategory: data.custom_category,
          baseLocation: data.base_location,
          crossBorder: data.cross_border,
          additionalInfo: data.additional_info,
          profileCompletion: data.profile_completion,
        });
        setOnboardingState(prev => ({
          phoneVerified: data.is_phone_verified === true || String(data.is_phone_verified) === 'true',
          profileCompleted: (data.profile_completion || 0) >= 100,
          dealSubmitted: prev.dealSubmitted,
        }));
      }
    }

    if (status === 'authenticated') {
      fetchSupabaseData();
    } else if (status === 'unauthenticated') {
      setIsAuthenticated(false);
      setTokens(0);
      setProfile(null);
    }
  }, [status, session, supabase]);

  const login = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async (reason?: 'session_expired' | 'link_expired') => {
    setIsAuthenticated(false);
    setProfile(null);
    setOnboardingState({
      phoneVerified: false,
      profileCompleted: false,
      dealSubmitted: false,
    });
    
    await signOut({ 
      callbackUrl: reason ? `/?error=${reason}` : '/?logout=success',
      redirect: true 
    });
  }, []);

  const setOnboarding = useCallback((step: 'phoneVerified' | 'profileCompleted' | 'dealSubmitted', value: boolean) => {
    setOnboardingState(prev => {
      if (prev[step] === value) return prev;
      return { ...prev, [step]: value };
    });
  }, []);

  const updateReadiness = useCallback((key: keyof typeof readinessScore, value: number) => {
    setReadinessScore(prev => {
      if (value > prev[key]) {
        return { ...prev, [key]: value };
      }
      return prev;
    });
  }, []);

  const totalScore = useMemo(() => Object.values(readinessScore).reduce((a, b) => a + b, 0), [readinessScore]);

  const isEOIApproved = useCallback((dealId: number) => approvedDeals.includes(dealId), [approvedDeals]);

  const approveEOI = useCallback(async (dealId: number) => {
    if (approvedDeals.includes(dealId)) return;
    if (tokens < 50) {
      addNotification({
        type: 'error',
        message: 'Insufficient tokens to connect with this deal.',
        time: 'Just now'
      });
      return;
    }

    try {
      const res = await fetch('/api/profile/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'debit',
          action: 'Connection with Deal',
          amount: 50
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTokens(data.balance);
        setApprovedDeals(d => [...d, dealId]);
        addNotification({
          type: 'success',
          message: 'Connection approved! 50 tokens debited.',
          time: 'Just now'
        });
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to approve connection');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
      addNotification({
        type: 'error',
        message: errorMessage,
        time: 'Just now'
      });
    }
  }, [approvedDeals, tokens, addNotification]);

  const addTokens = useCallback((amount: number) => {
    // Note: Tokens are actually added via the Profile API now for rewards
    setTokens(prev => prev + amount);
    addNotification({
      type: 'tokens_credited',
      message: `${amount} tokens added to your account.`,
      time: 'Just now'
    });
  }, [addNotification]);

  const canSendEOI = tokens > 0;

  return (
    <UserContext.Provider value={{ 
      tokens, 
      profile,
      approvedDeals, 
      isEOIApproved, 
      approveEOI, 
      canSendEOI, 
      isAuthenticated, 
      login, 
      logout,
      onboarding, 
      setOnboarding, 
      readinessScore, 
      updateReadiness, 
      addTokens, 
      totalScore,
      globalError,
      setGlobalError
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
