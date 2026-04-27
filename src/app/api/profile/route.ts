import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { auth } from '@/auth';
import { calculateProgress, validateFullProfile, ProfileFormData } from '@/lib/validation/profile';

export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
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
      additionalInfo: profile.additional_info,
      profileCompletion: profile.profile_completion || 0,
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
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
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

    const finalTokens = (currentUser.tokens || 0) + tokenIncrement;

    // 3. Normalize & Map Data to DB
    const updateData = {
      name: body.fullName,
      email: body.workEmail || email,
      phone: body.phone,
      firm_name: body.firmName,
      role: body.role,
      custom_role: body.customRole,
      category: body.professionalCategory,
      custom_category: body.customCategory,
      base_city: body.baseCity,
      base_country: body.baseCountry,
      base_location: `${body.baseCity}, ${body.baseCountry}`,
      geographies: body.activeGeographies,
      cross_border: body.crossBorder,
      corridors: body.corridors,
      sectors: body.primarySectors,
      intent: body.currentFocus,
      expertise_description: body.expertiseDescription,
      active_mandates: body.activeMandates,
      priority_sectors: body.primarySectors, // Using primary sectors as priority for now
      co_advisory: body.coAdvisory,
      collaboration_model: body.collaborationModels,
      profile_attachment_url: body.attachmentUrl || currentUser.profile_attachment_url,
      additional_info: body.additionalInfo,
      profile_completion: progress,
      profile_completed_once: currentUser.profile_completed_once || (progress === 100),
      tokens: finalTokens,
    };

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

