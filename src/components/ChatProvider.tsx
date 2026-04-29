'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  type?: 'intro' | 'conversation' | 'clarification' | 'complete' | 'error' | 'deal_ready' | 'deal_saved';
  questions?: string[];
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
}

interface ChatContextType {
  sessions: Session[];
  activeChatId: string | null;
  messages: Message[];
  loading: boolean;
  setActiveChatId: (id: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  fetchSessions: () => Promise<void>;
  loadChat: (id: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  createNewChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Define the core fetching logic
  const performFetch = useCallback(async () => {
    if (!session?.user?.email) return;
    try {
      const res = await fetch('/api/chat/history');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSessions(data);
      } else if (data.success === false) {
        console.error('API Error:', data.error, data.stack);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, [session?.user?.email]);

  // Public fetchSessions that can be called from outside
  const fetchSessions = useCallback(async () => {
    await performFetch();
  }, [performFetch]);

  // UseEffect for initial load - using a local function to satisfy the linter
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      if (!session?.user?.email) return;
      try {
        console.log("INITIAL CHAT FETCH FOR:", session.user.email);
        const res = await fetch('/api/chat/history');
        const data = await res.json();
        if (isMounted) {
          if (Array.isArray(data)) {
            console.log("SESSIONS LOADED:", data.length);
            setSessions(data);
          } else if (data.success === false) {
             console.error('API Error on Init:', data.error, data.stack);
          }
        }
      } catch (err) {
        console.error('Initial fetch failed:', err);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.email]);

  const loadChat = async (id: string) => {
    setLoading(true);
    setActiveChatId(id);
    try {
      const res = await fetch(`/api/chat/sessions/${id}/messages`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
  };

  const deleteChat = async (id: string) => {
    try {
      const res = await fetch(`/api/chat/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
        if (activeChatId === id) {
          createNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  return (
    <ChatContext.Provider value={{
      sessions,
      activeChatId,
      messages,
      loading,
      setActiveChatId,
      setMessages,
      fetchSessions,
      loadChat,
      deleteChat,
      createNewChat
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
