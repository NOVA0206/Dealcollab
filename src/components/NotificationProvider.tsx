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

// Mock Data
const initialData: Notification[] = [
  {
    id: 1,
    type: "match",
    message: "New match found for 'Startup Funding Round'",
    time: "2 mins ago",
    isRead: false
  },
  {
    id: 2,
    type: "eoi_approved",
    message: "Your EOI for 'Infrastructure Merger' was approved! Connect now.",
    time: "10 mins ago",
    isRead: false
  },
  {
    id: 3,
    type: "tokens_low",
    message: "Low token balance. Top up to ensure you don't miss new matches.",
    time: "1 hour ago",
    isRead: false
  },
  {
    id: 4,
    type: "tokens_credited",
    message: "Profile 100% complete. 100 Reward tokens credited.",
    time: "Yesterday",
    isRead: true
  },
  {
    id: 5,
    type: "eoi_declined",
    message: "Your proposal for 'AgriTech Grant' was declined.",
    time: "2 days ago",
    isRead: true
  }
];

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  useEffect(() => {
    // Initial fetch simulation
    setNotifications(initialData);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const addNotification = (notif: Omit<Notification, 'id' | 'isRead'>) => {
    const newNotif = {
      ...notif,
      id: Date.now(),
      isRead: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const refreshNotifications = async () => {
    // Simulation of data refresh
    await new Promise(resolve => setTimeout(resolve, 500));
    setNotifications(initialData);
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
