'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FileText, 
  Bell, 
  Sparkles, 
  Plus, 
  MessageSquare, 
  Trash2 
} from 'lucide-react';
import { useNotifications } from './NotificationProvider';
import { useChat } from './ChatProvider';

interface SidebarProps {
  isCollapsed: boolean;
  onItemClick?: () => void;
}

export default function Sidebar({ isCollapsed, onItemClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const { sessions, activeChatId, loadChat, createNewChat, deleteChat } = useChat();

  const menuItems = [
    { name: 'Home', icon: MessageSquare, href: '/home' },
    { name: 'Deal Log', icon: FileText, href: '/deal-log' },
    { name: 'Intelligence', icon: Sparkles, href: '/deal-intelligence' },
    { name: 'Notifications', icon: Bell, href: '/notifications', badge: unreadCount },
  ];

  const handleChatClick = async (id: string) => {
    if (pathname !== '/home') {
      await router.push('/home');
    }
    await loadChat(id);
    onItemClick?.();
  };
  const handleNewChat = () => {
    createNewChat();
    if (pathname !== '/home') {
      router.push('/home');
    }
    onItemClick?.();
  };

  return (
    <aside className="w-full h-full bg-white flex flex-col py-8 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">
      {/* Top Section: Logo */}
      <div className="mb-10 px-6">
        <Link href="/home" className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} overflow-hidden`}>
          <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 shadow-lg shadow-black/10 transition-transform duration-500 group-hover:scale-105 relative overflow-hidden ring-1 ring-white/10">
            <video
              autoPlay
              loop
              muted
              playsInline
              src="/earth.mp4"
              className="w-full h-full object-cover scale-125"
            />
          </div>
          {!isCollapsed && (
            <span className="text-foreground font-black text-base tracking-tighter whitespace-nowrap">
              DealCollab <span className="text-orange-500">AI</span>
            </span>
          )}
        </Link>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <nav className="flex flex-col gap-1.5 px-4 mb-8">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onItemClick?.()}
                className={`group flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-3'} py-3 rounded-xl transition-all duration-300 w-full text-left ${
                  isActive 
                    ? 'text-orange-600 bg-orange-50 font-bold shadow-sm' 
                    : 'text-gray-500 hover:text-foreground hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} className={`shrink-0 transition-all duration-300 ${isActive ? 'text-orange-500' : 'group-hover:text-orange-500'}`} />
                  {!isCollapsed && <span className="text-[13px] tracking-tight">{item.name}</span>}
                </div>
                {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {pathname === '/home' && (
          <>
            {/* New Chat Button */}
            <div className="px-4 mb-6">
              <button 
                onClick={handleNewChat}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 transition-all text-[13px] font-bold text-white group shadow-md shadow-orange-500/20 active:scale-95`}
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                {!isCollapsed && <span>New Conversation</span>}
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto px-4 space-y-1.5 scrollbar-hide">
              {!isCollapsed && sessions.length > 0 && (
                <h3 className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 mt-4">History</h3>
              )}
              
              {sessions.map((session) => (
                <div 
                  key={session.id}
                  onClick={() => handleChatClick(session.id)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 ${
                    activeChatId === session.id 
                      ? 'bg-gray-50 border border-gray-100 shadow-sm text-orange-600 font-semibold' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-foreground'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare size={16} className={`shrink-0 ${activeChatId === session.id ? 'text-orange-500' : 'opacity-40'}`} />
                    {!isCollapsed && <span className="text-xs truncate">{session.title}</span>}
                  </div>
                  {!isCollapsed && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all active:scale-90"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-auto px-4 py-6 border-t border-gray-100">
         <p className="text-[10px] text-gray-400 font-medium text-center uppercase tracking-widest">
            {isCollapsed ? 'DC' : 'DealCollab v2.0'}
         </p>
      </div>
    </aside>
  );
}
