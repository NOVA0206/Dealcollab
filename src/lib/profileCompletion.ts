interface ProfileUser {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  isPhoneVerified?: boolean | string | null;
  is_phone_verified?: boolean | string | null;
  firmName?: string | null;
  firm_name?: string | null;
  role?: string | null;
  category?: any[] | null;
  baseCity?: string | null;
  base_city?: string | null;
  baseLocation?: string | null;
  base_location?: string | null;
  geographies?: any[] | null;
  sectors?: any[] | null;
  intent?: any[] | null;
  coAdvisory?: boolean | null;
  co_advisory?: boolean | null;
}

export function calculateProfileCompletion(user: ProfileUser): number {
  const fields = [
    user.name,
    user.email,
    user.phone && (user.isPhoneVerified === true || user.is_phone_verified === true),
    user.firmName || user.firm_name,
    user.role,
    user.category?.length > 0,
    user.baseCity || user.base_city || user.baseLocation || user.base_location,
    user.geographies?.length > 0,
    user.sectors?.length > 0,
    user.intent?.length > 0,
    user.coAdvisory !== null && user.coAdvisory !== undefined || user.co_advisory !== null && user.co_advisory !== undefined,
  ];

  const completed = fields.filter(Boolean).length;
  return Math.round((completed / fields.length) * 100);
}
