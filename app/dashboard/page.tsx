'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DashboardRedirect() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function redirectUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'client') {
        const { data: activeCase } = await supabase
          .from('cases')
          .select('id')
          .eq('client_id', profile.id)
          .neq('status', 'archived')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (activeCase) {
          router.push(`/case/${activeCase.id}`)
        } else {
          // If no active case yet, stay on dashboard (it will show the empty state we built)
          router.push('/dashboard/empty')
        }
      } else if (profile?.role === 'super_admin' || profile?.role === 'admin') {
        router.push('/admin')
      } else if (profile?.role === 'team') {
        router.push('/team')
      } else {
        router.push('/login')
      }
    }

    redirectUser()
  }, [router, supabase])

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-bomjur-lime border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
