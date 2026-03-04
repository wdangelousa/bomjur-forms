import { createAdminClient } from '@/lib/supabase/server'

export interface XPResult {
    oldXP: number;
    newXP: number;
    oldLevel: number;
    newLevel: number;
    leveledUp: boolean;
    badgeUnlocked?: string;
}

const XP_PER_LEVEL = 500;

export async function awardXP(profileId: string, eventType: string): Promise<XPResult> {
    const supabase = createAdminClient();

    // 1. Get XP value from badge_definitions
    const { data: badgeDef, error: badgeError } = await supabase
        .from('badge_definitions')
        .select('*')
        .eq('event_trigger', eventType)
        .single();

    if (badgeError || !badgeDef) {
        throw new Error(`Event type ${eventType} not found in badge_definitions`);
    }

    const xpToAdd = badgeDef.xp_value || 0;

    // 2. Get current profile XP
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('total_xp')
        .eq('id', profileId)
        .single();

    if (profileError || !profile) {
        throw new Error(`Profile ${profileId} not found`);
    }

    const oldXP = profile.total_xp || 0;
    const newXP = oldXP + xpToAdd;

    const oldLevel = Math.floor(oldXP / XP_PER_LEVEL) + 1;
    const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;
    const leveledUp = newLevel > oldLevel;

    // 3. Update total_xp in profiles
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ total_xp: newXP })
        .eq('id', profileId);

    if (updateError) throw updateError;

    // 4. Register achievement
    const { error: achievementError } = await supabase
        .from('user_achievements')
        .insert({
            profile_id: profileId,
            badge_id: badgeDef.id,
            earned_at: new Date().toISOString()
        });

    if (achievementError) {
        console.error('Error logging achievement:', achievementError);
    }

    return {
        oldXP,
        newXP,
        oldLevel,
        newLevel,
        leveledUp,
        badgeUnlocked: badgeDef.name
    };
}
