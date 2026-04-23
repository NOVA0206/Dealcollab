'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Bell, Sparkles, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useNotifications } from './NotificationProvider';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();

  const menuItems = [
    { name: 'Deal Log', icon: FileText, href: '/deal-log' },
    { name: 'Deal Dashboard', icon: LayoutDashboard, href: '/deal-dashboard' },
  ];

  return (
    <aside className="w-full h-full bg-brand-sidebar border-r border-brand-border flex flex-col justify-between py-6 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] animate-in fade-in duration-700">
      {/* Top Section */}
      <div>
        {/* Logo Area */}
        <Link href="/home" className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-6'} mb-10 overflow-hidden`}>
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
 
        {/* Menu Items */}
        <nav className="flex flex-col gap-1.5 px-3">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-xl transition-all duration-300 w-full text-left ${
                  isActive 
                    ? 'text-brand-accent bg-brand-accent-glow border-l-2 border-brand-accent shadow-sm' 
                    : 'text-brand-secondary hover:text-foreground hover:bg-black/5 hover:translate-x-1'
                }`}
              >
                <item.icon size={20} className={`shrink-0 transition-all duration-300 ${isActive ? '' : 'group-hover:scale-110 group-hover:text-brand-accent'}`} />
                {!isCollapsed && <span className="text-sm font-bold whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-1 duration-300">{item.name}</span>}
              </Link>
            );
          })}
 
          <Link 
            href="/notifications"
            className={`group flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-3'} py-2.5 rounded-xl transition-all duration-300 w-full text-left ${
              pathname === '/notifications'
                ? 'text-brand-accent bg-brand-accent-glow border-l-2 border-brand-accent shadow-sm'
                : 'text-brand-secondary hover:text-foreground hover:bg-black/5 hover:translate-x-1'
            }`}
          >
            <div className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
              <Bell size={20} className={`shrink-0 transition-all duration-300 ${pathname === '/notifications' ? '' : 'group-hover:scale-110 group-hover:text-brand-accent'}`} />
              {!isCollapsed && <span className="text-sm font-bold whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-1 duration-300">Notifications</span>}
            </div>
            {!isCollapsed && unreadCount > 0 && (
              <span className="bg-brand-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-in fade-in zoom-in duration-500">
                {unreadCount}
              </span>
            )}
          </Link>

          <Link 
            href="/deal-intelligence"
            className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-xl transition-all duration-300 w-full text-left ${
              pathname === '/deal-intelligence' 
                ? 'text-brand-accent bg-brand-accent-glow border-l-2 border-brand-accent shadow-sm' 
                : 'text-brand-secondary hover:text-foreground hover:bg-black/5 hover:translate-x-1'
            }`}
          >
            <Sparkles size={20} className={`shrink-0 transition-all duration-300 ${pathname === '/deal-intelligence' ? '' : 'group-hover:scale-110 group-hover:text-brand-accent'}`} />
            {!isCollapsed && <span className="text-sm font-bold whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-1 duration-300">Deal Intelligence</span>}
          </Link>
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="px-3">
          <button 
            onClick={onToggle}
            className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-xl text-brand-secondary hover:text-foreground hover:bg-black/5 transition-all duration-300 w-full text-left active:scale-[0.98]`}
          >
            {isCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
            {!isCollapsed && <span className="text-sm font-bold whitespace-nowrap">Collapse</span>}
          </button>
      </div>
    </aside>
  );
}
