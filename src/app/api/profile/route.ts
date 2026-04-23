import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/client';
import { auth } from '@/auth';

export async function GET() {
  const supabase = createSupabaseClient();
  const session = await auth();
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const email = session.user.email.trim().toLowerCase();
    console.log("SERVER: FETCHING PROFILE FOR EMAIL:", email);

    // Fetch Profile from 'users' table using Normalized Email
    let { data: profile, error: dbError } = await supabase
      .from("users")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (dbError) {
      console.error("SUPABASE ERROR:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // If User doesn't exist, Create them (Auto-provision)
    if (!profile) {
      console.log("SERVER: USER NOT FOUND, CREATING NEW RECORD FOR:", email);
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
        console.error("USER CREATION ERROR:", insertError);
        return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
      }
      profile = newProfile;
    }

    // Map DB (snake_case) to Frontend (camelCase) to ensure UI reflects ALL data
    const profileData = {
      id: profile.id,
      fullName: profile.name || session.user.name || email.split("@")[0],
      email: profile.email,
      phone: profile.phone,
      firmName: profile.firm_name,
      role: profile.role,
      category: profile.category || [],
      customCategory: profile.custom_category,
      baseLocation: profile.base_location,
      geographies: profile.geographies || [],
      crossBorder: profile.cross_border === true,
      corridors: profile.corridors || "",
      sectors: profile.sectors || [],
      intent: profile.intent || "",
      prioritySectors: profile.priority_sectors || [],
      coAdvisory: profile.co_advisory === true,
      collaborationModel: profile.collaboration_model || [],
      additionalInfo: profile.additional_info,
      profileCompletion: profile.profile_completion || 0,
    };

    console.log("SERVER: MAPPED PROFILE DATA:", profileData.fullName, profileData.profileCompletion);
    return NextResponse.json(profileData);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient();
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const email = session.user.email.trim().toLowerCase();

    // Fetch current user state
    const { data: currentUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .ilike("email", email)
      .single();

    if (fetchError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Dynamic Progress Calculation
    const fieldsToTrack = [
      body.fullName,
      body.workEmail || body.email,
      body.phone,
      body.firmName,
      body.role,
      body.professionalCategory?.length > 0 || body.category?.length > 0,
      body.baseLocation,
      body.activeGeographies?.length > 0 || body.geographies?.length > 0,
      body.primarySectors?.length > 0 || body.sectors?.length > 0,
      body.selectedDeals?.length > 0 || body.intent?.length > 0,
      body.prioritySectors?.length > 0,
      body.collaborationModels?.length > 0 || body.collaborationModel?.length > 0,
      body.intelligenceLayer?.length > 10 || body.additionalInfo?.length > 10,
    ];
    const filledCount = fieldsToTrack.filter(f => f).length;
    const progress = Math.round((filledCount / fieldsToTrack.length) * 100);

    let tokenIncrement = 0;
    let shouldShowSuccess = false;

    // Reward logic: +100 tokens if reaching 100% for the first time
    if (progress === 100 && !currentUser.profile_completed_once) {
      tokenIncrement = 100;
      shouldShowSuccess = true;
    }

    const finalTokens = (currentUser.tokens || 0) + tokenIncrement;

    const updateData = {
      name: body.fullName || currentUser.name,
      email: body.workEmail || body.email || currentUser.email,
      phone: body.phone || currentUser.phone,
      firm_name: body.firmName || currentUser.firm_name,
      role: body.role || currentUser.role,
      category: body.professionalCategory || body.category || currentUser.category,
      custom_category: body.customCategory || currentUser.custom_category,
      base_location: body.baseLocation || currentUser.base_location,
      geographies: body.activeGeographies || body.geographies || currentUser.geographies,
      cross_border: body.crossBorder ?? currentUser.cross_border,
      corridors: Array.isArray(body.corridors) ? body.corridors.join(', ') : body.corridors || currentUser.corridors,
      sectors: body.primarySectors || body.sectors || currentUser.sectors,
      intent: Array.isArray(body.selectedDeals) ? body.selectedDeals.join(', ') : body.intent || currentUser.intent,
      priority_sectors: body.prioritySectors || currentUser.priority_sectors,
      co_advisory: body.coAdvisory ?? currentUser.co_advisory,
      collaboration_model: body.collaborationModels || body.collaborationModel || currentUser.collaboration_model,
      additional_info: body.intelligenceLayer || body.additionalInfo || currentUser.additional_info,
      profile_completion: progress,
      profile_completed_once: currentUser.profile_completed_once || (progress === 100),
      tokens: finalTokens,
    };

    // Update User
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
          userId: currentUser.id,
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
