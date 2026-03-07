'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/types'
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Bell,
  Users,
  ClipboardCheck,
  Settings,
  Kanban,
  LogOut,
  Globe,
  ArrowLeft,
  User,
} from 'lucide-react'

interface NavItem {
  label: string
  labelPt: string
  href: string
  icon: React.ReactNode
}

const navConfig: Record<UserRole, NavItem[]> = {
  client: [
    { label: 'Dashboard', labelPt: 'Meu Caso', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Documents', labelPt: 'Cofre de Documentos', href: '/documents', icon: <FileText size={20} /> },
    { label: 'Notifications', labelPt: 'Notificações', href: '/notifications', icon: <Bell size={20} /> },
    { label: 'Settings', labelPt: 'Minha Conta', href: '/settings', icon: <Settings size={20} /> },
  ],
  team: [
    { label: 'Cases', labelPt: 'Casos', href: '/team', icon: <FolderOpen size={20} /> },
    { label: 'Review', labelPt: 'Revisão', href: '/team/review', icon: <ClipboardCheck size={20} /> },
    { label: 'Clients', labelPt: 'Clientes', href: '/team/clients', icon: <Users size={20} /> },
    { label: 'Notifications', labelPt: 'Notificações', href: '/notifications', icon: <Bell size={20} /> },
    { label: 'Settings', labelPt: 'Configurações', href: '/settings', icon: <Settings size={20} /> },
  ],
  super_admin: [
    { label: 'Dashboard', labelPt: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={20} /> },
    { label: 'Pipeline', labelPt: 'Pipeline', href: '/admin/pipeline', icon: <Kanban size={20} /> },
    { label: 'Team', labelPt: 'Equipe', href: '/admin/team', icon: <Users size={20} /> },
    { label: 'Settings', labelPt: 'Configurações', href: '/settings', icon: <Settings size={20} /> },
  ],
}

function NotificationBell({ count }: { count: number }) {
  return (
    <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
      <Bell size={20} className="text-slate-500" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

function LanguageToggle({ lang, onToggle }: { lang: 'pt' | 'en'; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
    >
      <Globe size={14} />
      {lang === 'pt' ? '🇧🇷 PT' : '🇺🇸 EN'}
    </button>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [lang, setLang] = useState<'pt' | 'en'>('pt')
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data as Profile)
        setLang((data.preferred_language as 'pt' | 'en') || 'pt')
      }

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)

      setUnreadCount(count || 0)
      setLoading(false)
    }

    loadProfile()

    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, () => {
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const toggleLang = async () => {
    const newLang = lang === 'pt' ? 'en' : 'pt'
    setLang(newLang)
    if (profile) {
      await supabase
        .from('profiles')
        .update({ preferred_language: newLang })
        .eq('id', profile.id)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) return <>{children}</>

  const navItems = navConfig[profile.role] || navConfig.client
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] min-h-screen border-r border-slate-200 bg-white fixed left-0 top-0 z-40">
        <div className="px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🛫</span>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">Bomjur</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Immigration Platform</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive(item.href)
                ? 'bg-sky-50 text-sky-600 border border-sky-100'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              {item.icon}
              {lang === 'pt' ? item.labelPt : item.label}
            </a>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-sm font-bold">
              {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{profile.full_name}</p>
              <p className="text-[11px] text-slate-400 capitalize">{profile.role.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle lang={lang} onToggle={toggleLang} />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-[260px] pb-20 lg:pb-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Mobile Back Button */}
            <button
              onClick={() => router.back()}
              className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Voltar"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-lg">🛫</span>
              <span className="text-base font-extrabold text-slate-900">Bomjur</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle lang={lang} onToggle={toggleLang} />
            <NotificationBell count={unreadCount} />
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-4">
            {/* Desktop Back Button */}
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors flex items-center justify-center shadow-sm"
              title="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-lg font-bold text-slate-900">
              {lang === 'pt' ? 'Olá' : 'Hello'}, {profile.full_name?.split(' ')[0]}! 👋
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell count={unreadCount} />
            <div className="w-px h-6 bg-slate-200" />

            {/* User Menu Dropdown (Simplified for now) */}
            <div className="flex items-center gap-3">
              <a
                href="/settings"
                className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 hover:border-sky-200 hover:bg-sky-50 flex items-center justify-center text-slate-500 hover:text-sky-600 transition-all shadow-sm"
                title={lang === 'pt' ? 'Configurações' : 'Settings'}
              >
                <User size={18} />
              </a>
              <button
                onClick={handleLogout}
                className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 hover:border-red-600 hover:bg-red-50 flex items-center justify-center text-slate-500 hover:text-red-600 transition-all shadow-sm"
                title={lang === 'pt' ? 'Sair' : 'Logout'}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <div className="animate-fade-in">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm safe-bottom">
        <div className="flex items-center justify-around px-2 py-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg min-w-[56px] transition-colors ${isActive(item.href) ? 'text-sky-600' : 'text-slate-400'
                }`}
            >
              <span className={isActive(item.href) ? 'scale-110 transition-transform' : ''}>
                {item.icon}
              </span>
              <span className="text-[10px] font-medium">
                {lang === 'pt' ? item.labelPt : item.label}
              </span>
            </a>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg text-slate-400 min-w-[56px] hover:text-red-600"
          >
            <LogOut size={20} />
            <span className="text-[10px] font-medium">Sair</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
