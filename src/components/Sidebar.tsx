'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Bell, 
  Sparkles, 
  PanelLeftClose, 
  PanelLeft, 
  Plus, 
  MessageSquare, 
  Trash2 
} from 'lucide-react';
import { useNotifications } from './NotificationProvider';
import { useChat } from './ChatProvider';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const { sessions, activeChatId, loadChat, createNewChat, deleteChat } = useChat();

  const menuItems = [
    { name: 'Deal Log', icon: FileText, href: '/deal-log' },
    { name: 'Deal Dashboard', icon: LayoutDashboard, href: '/deal-dashboard' },
    { name: 'Notifications', icon: Bell, href: '/notifications', badge: unreadCount },
    { name: 'Deal Intelligence', icon: Sparkles, href: '/deal-intelligence' },
  ];

  const handleChatClick = async (id: string) => {
    if (pathname !== '/home') {
      await router.push('/home');
    }
    loadChat(id);
  };

  const handleNewChat = () => {
    createNewChat();
    if (pathname !== '/home') {
      router.push('/home');
    }
  };

  return (
    <aside className="w-full h-full bg-brand-sidebar border-r border-brand-border flex flex-col py-6 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">
      {/* Top Section: Logo */}
      <div className="mb-8 px-6">
        <Link href="/home" className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} overflow-hidden`}>
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0 shadow-sm transition-transform duration-500 group-hover:scale-110 relative overflow-hidden ring-1 ring-white/10">
            <video
              autoPlay
              loop
              muted
              playsInline
              src="/earth.mp4"
              className="w-full h-full object-cover scale-125 transition-transform duration-700 group-hover:scale-150"
            />
          </div>
          {!isCollapsed && (
            <span className="text-foreground font-bold text-sm tracking-tight whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-500">
              DealCollab AI
            </span>
          )}
        </Link>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <nav className="flex flex-col gap-1 px-3 mb-6">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-3'} py-2.5 rounded-xl transition-all duration-300 w-full text-left ${
                  isActive 
                    ? 'text-brand-accent bg-brand-accent-glow border-l-2 border-brand-accent shadow-sm' 
                    : 'text-brand-secondary hover:text-foreground hover:bg-black/5 hover:translate-x-1'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} className={`shrink-0 transition-all duration-300 ${isActive ? '' : 'group-hover:scale-110 group-hover:text-brand-accent'}`} />
                  {!isCollapsed && <span className="text-sm font-bold whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-1 duration-300">{item.name}</span>}
                </div>
                {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-brand-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-in fade-in zoom-in duration-500">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {pathname === '/home' && (
          <>
            <div className="px-6 mb-6">
              <div className="h-px bg-brand-border w-full opacity-50" />
            </div>

            {/* New Chat Button */}
            <div className="px-3 mb-4">
              <button 
                onClick={handleNewChat}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-3 rounded-xl border border-brand-accent/20 bg-white hover:bg-brand-accent-glow hover:border-brand-accent transition-all text-sm font-bold text-brand-accent group shadow-sm active:scale-95`}
              >
                <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                {!isCollapsed && <span>New Chat</span>}
              </button>
            </div>

            {/* Chat History Section */}
            <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-hide">
              {!isCollapsed && sessions.length > 0 && (
                <h3 className="px-3 text-[10px] font-bold text-brand-secondary uppercase tracking-widest mb-2 mt-4">Recent Conversations</h3>
              )}
              
              {sessions.length === 0 && !isCollapsed ? (
                <div className="px-3 py-4 text-xs text-brand-secondary italic text-center">No conversations yet</div>
              ) : (
                sessions.map((session) => (
                  <div 
                    key={session.id}
                    onClick={() => handleChatClick(session.id)}
                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                      activeChatId === session.id 
                        ? 'bg-white border-brand-accent/30 shadow-sm text-brand-accent' 
                        : 'border-transparent text-brand-secondary hover:bg-white hover:border-brand-border hover:text-foreground'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <MessageSquare size={18} className={`shrink-0 ${activeChatId === session.id ? 'text-brand-accent' : 'text-brand-secondary opacity-50'}`} />
                      {!isCollapsed && <span className="text-sm font-medium truncate">{session.title}</span>}
                    </div>
                    {!isCollapsed && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-50 hover:text-red-500 transition-all active:scale-90"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Section */}
      <div className="px-3 pt-4 border-t border-brand-border mt-auto">
          <button 
            onClick={onToggle}
            className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-xl text-brand-secondary hover:text-foreground hover:bg-black/5 transition-all duration-300 w-full text-left active:scale-[0.98]`}
          >
            {isCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
            {!isCollapsed && <span className="text-sm font-bold whitespace-nowrap">Collapse Menu</span>}
          </button>
      </div>
    </aside>
  );
}
