import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { auth } from '@/auth';
import { calculateProgress, validateFullProfile, ProfileFormData } from '@/lib/validation/profile';

export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    console.error('[PROFILE GET] Supabase init failed:', {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    return NextResponse.json({ error: 'Database not configured. Check Vercel environment variables.' }, { status: 503 });
  }
  const session = await auth();
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const email = session.user.email.trim().toLowerCase();

    const { data: initialProfile, error: dbError } = await supabase
      .from("users")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    let profile = initialProfile;

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    if (!profile) {
      const nameFallback = session.user.name || email.split("@")[0];
      const { data: newProfile, error: insertError } = await supabase
        .from("users")
        .insert({
          email: email,
          name: nameFallback,
          tokens: 0,
          profile_completion: 0
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
      }
      profile = newProfile;
    }

    // Map DB (snake_case) to Frontend (camelCase)
    const profileData = {
      id: profile.id,
      fullName: profile.name,
      email: profile.email,
      phone: profile.phone,
      firmName: profile.firm_name,
      role: profile.role,
      customRole: profile.custom_role,
      category: profile.category || [],
      customCategory: profile.custom_category,
      baseCity: profile.base_city,
      baseCountry: profile.base_country,
      baseLocation: profile.base_location,
      geographies: profile.geographies || [],
      crossBorder: profile.cross_border === true,
      corridors: profile.corridors || [],
      sectors: profile.sectors || [],
      currentFocus: profile.intent || [],
      expertiseDescription: profile.expertise_description,
      activeMandates: profile.active_mandates || [],
      prioritySectors: profile.priority_sectors || [],
      coAdvisory: profile.co_advisory === true,
      collaborationModels: profile.collaboration_model || [],
      profileAttachmentUrl: profile.profile_attachment_url,
      profileImage: profile.profile_image,
      additionalInfo: profile.additional_info,
      profileCompletion: profile.profile_completion || 0,
      tokens: profile.tokens,
    };

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    console.error('[PROFILE POST] Supabase init failed:', {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    return NextResponse.json({ error: 'Database not configured. Check Vercel environment variables.' }, { status: 503 });
  }
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json() as ProfileFormData;
    const email = session.user.email.trim().toLowerCase();

    // 1. Validate Input (Using PRD rules)
    const errors = validateFullProfile(body);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Fetch current user state
    const { data: currentUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .ilike("email", email)
      .single();

    if (fetchError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Dynamic Progress Calculation
    const progress = calculateProgress(body);

    let tokenIncrement = 0;
    let shouldShowSuccess = false;

    // Reward logic: +100 tokens if reaching 100% for the first time
    if (progress === 100 && !currentUser.profile_completed_once) {
      tokenIncrement = 100;
      shouldShowSuccess = true;
    }

    const finalTokens = (currentUser.tokens ?? 0) + tokenIncrement;

    console.log("[PROFILE API] SESSION:", session);
    const incomingPhone = body.phone || (body as { phone_number?: string }).phone_number;
    console.log("[PROFILE API] Phone being saved:", incomingPhone);

    // 3. Build update object (Snake Case)
    const updateData = {
      name: body.fullName || currentUser.name,
      email: body.workEmail || currentUser.email,
      phone: incomingPhone || currentUser.phone,
      firm_name: body.firmName || currentUser.firm_name,
      role: body.role || currentUser.role,
      custom_role: body.customRole || currentUser.custom_role,
      category: body.professionalCategory || currentUser.category,
      custom_category: body.customCategory || currentUser.custom_category,
      base_city: body.baseCity || currentUser.base_city,
      base_country: body.baseCountry || currentUser.base_country,
      base_location: (body.baseCity && body.baseCountry) ? `${body.baseCity}, ${body.baseCountry}` : currentUser.base_location,
      geographies: body.activeGeographies || currentUser.geographies,
      cross_border: body.crossBorder !== undefined ? body.crossBorder : currentUser.cross_border,
      corridors: body.corridors || currentUser.corridors,
      sectors: body.primarySectors || currentUser.sectors,
      intent: body.currentFocus || currentUser.intent,
      expertise_description: body.expertiseDescription || currentUser.expertise_description,
      active_mandates: body.activeMandates || currentUser.active_mandates,
      priority_sectors: body.primarySectors || currentUser.priority_sectors,
      co_advisory: body.coAdvisory !== undefined ? body.coAdvisory : currentUser.co_advisory,
      collaboration_model: body.collaborationModels || currentUser.collaboration_model,
      profile_attachment_url: body.attachmentUrl || body.profile_attachment_url || currentUser.profile_attachment_url,
      additional_info: body.additionalInfo || currentUser.additional_info,
      profile_completion: progress,
      profile_completed_once: currentUser.profile_completed_once || (progress === 100),
      tokens: (body.tokens !== undefined && body.tokens !== null) ? body.tokens : finalTokens,
      // STRICT: Only update profile_image if a value is provided in the request
      // and it is NOT a Google avatar URL (Google avatars are fallbacks, not DB values)
      profile_image: (() => {
        const incoming = (body.profileImage !== undefined && body.profileImage !== null) 
          ? body.profileImage 
          : (body.profile_image !== undefined && body.profile_image !== null)
            ? body.profile_image
            : null;
        
        if (incoming && incoming.includes('googleusercontent.com')) {
          console.log('[PROFILE API] REJECTING GOOGLE URL FOR profile_image:', incoming);
          return currentUser.profile_image;
        }
        
        return incoming || currentUser.profile_image;
      })(),
    };

    console.log('[PROFILE API] Final DB value for profile_image:', updateData.profile_image);
    console.log('[PROFILE API] Updating user with data:', updateData);

    // 4. Store in DB
    const { error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .ilike("email", email);

    if (updateError) throw updateError;

    // Log Transaction if tokens added
    if (tokenIncrement > 0) {
      await supabase
        .from("token_transactions")
        .insert({
          user_id: currentUser.id,
          type: 'credit',
          action: 'Profile Completion Reward',
          amount: tokenIncrement,
          balance_after: finalTokens,
        });
    }

    return NextResponse.json({ 
      success: true, 
      rewarded: tokenIncrement > 0,
      shouldShowSuccess,
      progress
    });
  } catch (error) {
    console.error('Profile save error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

