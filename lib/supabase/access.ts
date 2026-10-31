import 'server-only'

import { createClient } from '@/lib/supabase/server'

export async function getAccessContext() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()

  if (claimsError) {
    throw claimsError
  }

  const userId = claimsData?.claims?.sub
  if (!userId) {
    return null
  }

  const [coachResult, clientResult] = await Promise.all([
    supabase.from('coach_access').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('id').eq('auth_user_id', userId).maybeSingle(),
  ])

  if (coachResult.error) throw coachResult.error
  if (clientResult.error) throw clientResult.error

  if (coachResult.data) {
    return { supabase, userId, role: 'coach' as const }
  }

  if (clientResult.data) {
    return { supabase, userId, clientId: clientResult.data.id, role: 'client' as const }
  }

  return { supabase, userId, role: 'unassigned' as const }
}
