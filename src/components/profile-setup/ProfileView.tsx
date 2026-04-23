'use client';
import React from 'react';
import { 
  User, Globe, MapPin, Target, Zap, MessageSquare, Edit3
} from 'lucide-react';
import { ProfileData } from './ProfileStepper';

interface ProfileViewProps {
  data: ProfileData | null;
  onEdit: () => void;
}

export default function ProfileView({ data, onEdit }: ProfileViewProps) {
  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8 pb-32">
      {/* Header Card */}
      <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-brand-accent/5 rounded-3xl flex items-center justify-center text-brand-accent">
            <User size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">{data.fullName}</h1>
            <p className="text-brand-secondary font-medium">{data.role} @ {data.firmName}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                Profile Verified
              </span>
              <span className="px-3 py-1 bg-brand-accent/5 text-brand-accent rounded-full text-[10px] font-black uppercase tracking-wider">
                Strength: {data.profileCompletion}%
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onEdit}
            className="flex items-center gap-2 px-6 py-3 bg-foreground text-white rounded-2xl font-black text-sm hover:bg-brand-accent transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-brand-accent/20"
          >
            <Edit3 size={18} />
            Update Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Basic Identity */}
        <SectionCard title="Basic Identity" icon={<User size={20} />} onClick={onEdit}>
          <DataRow label="Full Name" value={data.fullName} />
          <DataRow label="Work Email" value={data.email} />
          <DataRow label="Phone" value={data.phone} />
          <DataRow label="Firm" value={data.firmName} />
          <DataRow label="Role" value={data.role} />
          <div className="space-y-3 pt-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-secondary opacity-50">Professional Category</span>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(data.category) && data.category.map((cat: string) => (
                <span 
                  key={cat} 
                  className="px-3 py-1.5 bg-brand-accent/5 border border-brand-accent/20 text-brand-accent text-[11px] font-bold rounded-lg"
                >
                  {cat === 'Other' && data.customCategory ? `${data.customCategory}` : cat}
                </span>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Geography */}
        <SectionCard title="Geography & Coverage" icon={<MapPin size={20} />} onClick={onEdit}>
          <DataRow label="Base Location" value={data.baseLocation} />
          <DataRow label="Active Geographies" value={Array.isArray(data.geographies) ? data.geographies.join(', ') : data.geographies} />
          <DataRow label="Cross-border" value={data.crossBorder ? 'Enabled' : 'Disabled'} />
          {data.crossBorder && <DataRow label="Focus Corridors" value={data.corridors} />}
        </SectionCard>

        {/* Market Expertise */}
        <SectionCard title="Market Expertise" icon={<Target size={20} />} onClick={onEdit}>
          <DataRow label="Primary Sectors" value={Array.isArray(data.sectors) ? data.sectors.join(', ') : data.sectors} />
        </SectionCard>

        {/* Current Intent */}
        <SectionCard title="Current Intent" icon={<Zap size={20} />} onClick={onEdit}>
          <DataRow label="Primary Intent" value={data.intent} />
          <DataRow label="Priority Focus" value={Array.isArray(data.prioritySectors) ? data.prioritySectors.join(', ') : data.prioritySectors} />
        </SectionCard>

        {/* Collaboration */}
        <SectionCard title="Collaboration" icon={<Globe size={20} />} onClick={onEdit}>
          <DataRow label="Co-Advisory" value={data.coAdvisory ? 'Open' : 'Restricted'} />
          <DataRow label="Models" value={Array.isArray(data.collaborationModel) ? data.collaborationModel.join(', ') : data.collaborationModel} />
        </SectionCard>

        {/* Additional Info */}
        <SectionCard title="Intelligence Layer" icon={<MessageSquare size={20} />} onClick={onEdit}>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-secondary opacity-50">Specialization</span>
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {data.additionalInfo || 'No additional specialization details provided.'}
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children, onClick }: { title: string, icon: React.ReactNode, children: React.ReactNode, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-6 transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:border-brand-accent hover:shadow-xl hover:shadow-brand-accent/5 group/card' : ''
      }`}
    >
      <div className="flex items-center justify-between border-b border-gray-50 pb-4">
        <div className="flex items-center gap-3">
          <div className="text-brand-accent group-hover/card:scale-110 transition-transform">{icon}</div>
          <h3 className="text-lg font-black text-foreground tracking-tight">{title}</h3>
        </div>
        {onClick && (
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent opacity-0 group-hover/card:opacity-100 transition-opacity">
            Edit Section
          </span>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string, value: string | number | boolean | string[] | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-secondary opacity-50">{label}</span>
      <span className="text-sm font-bold text-foreground">{value || 'Not provided'}</span>
    </div>
  );
}
