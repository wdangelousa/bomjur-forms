import { createAdminClient } from '@/lib/supabase/server'

export type NotificationType = 'approval' | 'rejection' | 'achievement' | 'info' | 'system'

export async function sendNotification(
    userId: string,
    title: string,
    body: string,
    type: NotificationType = 'info',
    metadata: any = {}
) {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            title,
            body,
            type,
            metadata,
            read: false,
            created_at: new Date().toISOString()
        })
        .select()
        .single()

    if (error) {
        console.error('Error sending notification:', error)
        throw error
    }

    return data
}
