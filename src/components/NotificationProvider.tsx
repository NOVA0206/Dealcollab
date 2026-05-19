'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Notification } from '@/components/NotificationCard';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  addNotification: (notif: Omit<Notification, 'id' | 'isRead'>) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

import { createSupabaseClient } from '@/utils/supabase/client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function formatRelativeTime(dateString: string): string {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 30) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: apiNotifications, mutate } = useSWR('/api/notifications', fetcher, { 
    refreshInterval: 15000 
  });
  
  const [localNotifs, setLocalNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    if (apiNotifications && Array.isArray(apiNotifications)) {
      const mapped = apiNotifications.map((n: Record<string, unknown>) => ({
        id: n.id as number,
        type: String(n.type).toLowerCase() as Notification['type'],
        message: String(n.message),
        time: n.created_at ? formatRelativeTime(String(n.created_at)) : 'Just now',
        isRead: n.is_read === 'true'
      }));
      // Delay state update to avoid synchronous cascading render warnings in React 19
      Promise.resolve().then(() => setLocalNotifs(mapped));
    }
  }, [apiNotifications]);

  useEffect(() => {
    const supabase = createSupabaseClient();
    if (!supabase) return;

    const channel = supabase.channel('realtime-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
         mutate(); // Re-fetch immediately when DB changes
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  const notifications = localNotifs;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: number) => {
    setLocalNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    mutate();
  };

  const markAllAsRead = () => {
    setLocalNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    // Real implementation would have a mark-all route
  };

  const addNotification = (notif: Omit<Notification, 'id' | 'isRead'>) => {
    const newNotif = {
      ...notif,
      id: Date.now(),
      isRead: false
    };
    setLocalNotifs(prev => [newNotif, ...prev]);
  };

  const refreshNotifications = async () => {
    await mutate();
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, addNotification, refreshNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
