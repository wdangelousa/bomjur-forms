export type UserRole = 'super_admin' | 'team' | 'client'
export type PreferredLanguage = 'pt' | 'en'
export type CaseType = 'I-485' | 'I-140'
export type CaseStatus =
  | 'pending_onboarding'
  | 'in_progress'
  | 'documents_pending'
  | 'in_review'
  | 'ready_for_filing'
  | 'complete'
  | 'archived'
export type DocumentStatus = 'pending' | 'uploaded' | 'in_review' | 'approved' | 'rejected'

export interface Profile {
  id: string
  tenant_id: string | null
  full_name: string | null
  email: string
  phone: string | null
  role: UserRole
  preferred_language: PreferredLanguage
  avatar_url: string | null
  onboarding_complete: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface Case {
  id: string
  tenant_id: string
  client_id: string
  assigned_to: string | null
  case_type: CaseType
  status: CaseStatus
  personal_data: Record<string, any>
  address_data: Record<string, any>
  form_data: Record<string, any>
  priority: number
  deadline: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CaseDocument {
  id: string
  case_id: string
  category: string
  document_type: string
  status: DocumentStatus
  file_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  version: number
  rejection_reason: string | null
  rejection_details: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  is_required: boolean
  display_order: number
  uploaded_at: string | null
  created_at: string
  updated_at: string
}

export interface ClientProgress {
  id: string
  user_id: string
  total_xp: number
  current_level: number
  badges: string[]
  streak_days: number
  longest_streak: number
  last_activity: string
}

export interface Notification {
  id: string
  user_id: string
  case_id: string | null
  type: string
  channel: string
  title: string
  body: string | null
  data: Record<string, any>
  read: boolean
  read_at: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      user_profiles: { Row: Profile }
      cases: { Row: Case }
      case_documents: { Row: CaseDocument }
      client_progress: { Row: ClientProgress }
      notifications: { Row: Notification }
    }
  }
}
