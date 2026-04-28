'use client';
import { Sparkles, Bell, RefreshCw, Zap, CheckCircle2, XCircle, Coins, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export type NotificationType = 
  | 'match' 
  | 'eoi_received' 
  | 'eoi_approved' 
  | 'eoi_declined' 
  | 'tokens_credited' 
  | 'tokens_low'
  | 'status' 
  | 'new_deal'
  | 'success'
  | 'error';

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  time: string;
  isRead: boolean;
}

interface NotificationCardProps {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
}

const typeIcons: Record<NotificationType, React.ReactNode> = {
  match: <Sparkles size={18} className="text-primary-hover" />,
  eoi_received: <Bell size={18} className="text-blue-500" />,
  eoi_approved: <CheckCircle2 size={18} className="text-green-500" />,
  eoi_declined: <XCircle size={18} className="text-red-500" />,
  tokens_credited: <Coins size={18} className="text-primary-hover" />,
  tokens_low: <AlertCircle size={18} className="text-amber-500" />,
  status: <RefreshCw size={18} className="text-blue-500" />,
  new_deal: <Zap size={18} className="text-green-500" />,
  success: <CheckCircle2 size={18} className="text-green-600" />,
  error: <AlertCircle size={18} className="text-red-500" />,
};

const typeRoutes: Record<NotificationType, string> = {
  match: '/deal-dashboard',
  eoi_received: '/deal-dashboard',
  eoi_approved: '/deal-dashboard',
  eoi_declined: '/deal-dashboard',
  tokens_credited: '/profile',
  tokens_low: '/profile',
  status: '/deal-log',
  new_deal: '/deal-dashboard',
  success: '/deal-dashboard',
  error: '/deal-dashboard',
};

export default function NotificationCard({ notification, onMarkAsRead }: NotificationCardProps) {
  const router = useRouter();

  const handleClick = () => {
    onMarkAsRead(notification.id);
    router.push(typeRoutes[notification.type]);
  };

  return (
    <div 
      onClick={handleClick}
      className={`relative flex items-start gap-4 p-5 rounded-xl border transition-all cursor-pointer group shadow-sm ${
        notification.isRead 
          ? 'bg-primary-soft/30 border-border hover:bg-primary-soft/50' 
          : 'bg-white border-primary/20 border-l-4 border-l-primary hover:shadow-md'
      }`}
    >
      <div className={`p-2.5 rounded-lg shrink-0 ${notification.isRead ? 'bg-white border border-border' : 'bg-primary/10'}`}>
        {typeIcons[notification.type] || <Bell size={18} className="text-brand-secondary" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug mb-1.5 ${notification.isRead ? 'text-brand-secondary' : 'text-foreground font-bold'}`}>
          {notification.message}
        </p>
        <div className="flex items-center gap-2">
           <span className="text-[10px] text-brand-secondary/60 font-bold uppercase tracking-wider">{notification.time}</span>
           {!notification.isRead && (
             <span className="w-1.5 h-1.5 bg-primary rounded-full" />
           )}
        </div>
      </div>
    </div>
  );
}
