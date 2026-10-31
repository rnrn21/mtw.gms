import { CoachShell } from '@/components/coach/coach-shell'

export default function CoachLayout({ children }: LayoutProps<'/coach'>) {
  return <CoachShell>{children}</CoachShell>
}
