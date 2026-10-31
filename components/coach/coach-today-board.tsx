'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type SessionRow = {
  id: string
  engagement_id: string
  seq: number
  status: string
  scheduled_at: string | null
  scheduled_end_at: string | null
}

type EngagementRow = {
  id: string
  client_id: string
  title: string
  total_sessions: number
}

type ProfileRow = { id: string; name: string | null }

function SessionCard({
  session,
  clientName,
  engagement,
  showDate = false,
}: {
  session: SessionRow
  clientName: string
  engagement: EngagementRow | undefined
  showDate?: boolean
}) {
  const status = statusStyle(session.status)
  return (
    <li>
      <Link
        href={`/coach/sessions/${session.id}`}
        className="group flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand-sage"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="w-[5.5rem] shrink-0">
            {showDate && (
              <p className="mb-1 text-xs text-text-sub">{formatDay(session.scheduled_at)}</p>
            )}
            <time className="font-medium tabular-nums text-brand-primary">
              {formatTime(session.scheduled_at)}
            </time>
          </div>
          <span className="h-10 w-px bg-line" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate font-serif text-lg text-brand-primary">
              {clientName}
              <span className="ml-1 font-sans text-sm font-normal text-text-sub">
                ({session.seq}/{engagement?.total_sessions ?? '–'})
              </span>
            </h3>
            <p className="mt-1 truncate text-sm text-text-sub">
              {engagement?.title ?? '코칭 과정'} · 세션 관리 열기
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </Link>
    </li>
  )
}

function getLocalDayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const weekEnd = new Date(start)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return { start, end, weekEnd }
}

function formatTime(value: string | null) {
  if (!value) return '시간 미정'
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDay(value: string | null) {
  if (!value) return '일정 미정'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(value))
}

function statusStyle(status: string) {
  if (status === 'recorded') {
    return { label: '피드백 대기', className: 'bg-amber-50 text-amber-800' }
  }
  if (status === 'feedback_done') {
    return { label: '완료', className: 'bg-emerald-50 text-emerald-800' }
  }
  if (status === 'recording') {
    return { label: '진행 중', className: 'bg-sky-50 text-sky-800' }
  }
  return { label: '예정', className: 'bg-stone-100 text-stone-600' }
}

export function CoachTodayBoard() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [clientNames, setClientNames] = useState<Record<string, string>>({})
  const [engagements, setEngagements] = useState<Record<string, EngagementRow>>({})
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErrorMessage(null)
    const { start, weekEnd } = getLocalDayBounds()

    const [sessionResult, recordedSessionResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, engagement_id, seq, status, scheduled_at, scheduled_end_at')
        .gte('scheduled_at', start.toISOString())
        .lt('scheduled_at', weekEnd.toISOString())
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('sessions')
        .select('id')
        .in('status', ['recorded', 'feedback_done']),
    ])

    const queryError = sessionResult.error ?? recordedSessionResult.error
    if (queryError) {
      setErrorMessage('코치 업무 현황을 불러오지 못했습니다. 권한과 DB 설정을 확인해 주세요.')
      console.error('코치 업무 현황 조회 실패:', queryError.message)
      setLoading(false)
      return
    }

    if (!sessionResult.data || !recordedSessionResult.data) {
      setErrorMessage('코치 업무 현황 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.')
      console.error('코치 업무 현황 조회에서 오류 없이 데이터가 반환되지 않았습니다.')
      setLoading(false)
      return
    }

    const sessionEngagementIds = [
      ...new Set(sessionResult.data.map((session) => session.engagement_id)),
    ]
    const sessionEngagementResult = sessionEngagementIds.length
      ? await supabase
          .from('engagements')
          .select('id, client_id, title, total_sessions')
          .in('id', sessionEngagementIds)
      : { data: [], error: null }

    if (sessionEngagementResult.error || !sessionEngagementResult.data) {
      setErrorMessage('일정에 표시할 코칭 과정 정보를 불러오지 못했습니다.')
      if (sessionEngagementResult.error) {
        console.error('일정 코칭 과정 조회 실패:', sessionEngagementResult.error.message)
      }
      setLoading(false)
      return
    }

    const sessionEngagements = sessionEngagementResult.data as EngagementRow[]
    const clientIds = [...new Set(sessionEngagements.map((engagement) => engagement.client_id))]
    const profileResult = clientIds.length
      ? await supabase.from('profiles').select('id, name').in('id', clientIds)
      : { data: [], error: null }

    if (profileResult.error || !profileResult.data) {
      setErrorMessage('일정에 표시할 고객 정보를 불러오지 못했습니다.')
      if (profileResult.error) console.error('일정 고객 조회 실패:', profileResult.error.message)
      setLoading(false)
      return
    }

    const profileNames = new Map(
      (profileResult.data as ProfileRow[]).map((profile) => [
        profile.id,
        profile.name ?? '이름 없음',
      ]),
    )
    setClientNames(
      Object.fromEntries(
        sessionEngagements.map((engagement) => [
          engagement.id,
          profileNames.get(engagement.client_id) ?? '이름 없음',
        ]),
      ),
    )
    setEngagements(
      Object.fromEntries(sessionEngagements.map((engagement) => [engagement.id, engagement])),
    )
    setSessions(sessionResult.data)

    const recordedSessionIds = recordedSessionResult.data.map((session) => session.id)
    if (!recordedSessionIds.length) {
      setPendingFeedbackCount(0)
      setLoading(false)
      return
    }

    const recordResult = await supabase
      .from('session_records')
      .select('id')
      .eq('written_by', 'client')
      .in('session_id', recordedSessionIds)

    if (recordResult.error || !recordResult.data) {
      setErrorMessage('피드백 대기 수를 불러오지 못했습니다.')
      if (recordResult.error) console.error('피드백 대상 기록 조회 실패:', recordResult.error.message)
      setLoading(false)
      return
    }

    const recordIds = recordResult.data.map((record) => record.id)
    if (!recordIds.length) {
      setPendingFeedbackCount(0)
      setLoading(false)
      return
    }

    const feedbackResult = await supabase
      .from('feedbacks')
      .select('target_id')
      .eq('target_type', 'record')
      .in('target_id', recordIds)

    if (feedbackResult.error || !feedbackResult.data) {
      setErrorMessage('피드백 대기 수를 불러오지 못했습니다.')
      if (feedbackResult.error) console.error('피드백 현황 조회 실패:', feedbackResult.error.message)
      setLoading(false)
      return
    }

    const feedbackRecordIds = new Set(feedbackResult.data.map((feedback) => feedback.target_id))
    setPendingFeedbackCount(recordIds.filter((recordId) => !feedbackRecordIds.has(recordId)).length)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    const intervalId = window.setInterval(() => void load(), 30_000)
    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [load])

  const { todaySessions, upcomingSessions } = useMemo(() => {
    const { end } = getLocalDayBounds()
    return {
      todaySessions: sessions.filter(
        (session) =>
          session.scheduled_at && new Date(session.scheduled_at).getTime() < end.getTime(),
      ),
      upcomingSessions: sessions.filter(
        (session) =>
          session.scheduled_at && new Date(session.scheduled_at).getTime() >= end.getTime(),
      ),
    }
  }, [sessions])

  const todayLabel = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date())

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-brand-sage">코치 업무 보드</p>
          <h1 className="mt-1 font-serif text-3xl text-brand-primary">오늘</h1>
          <p className="mt-2 text-sm text-text-sub">{todayLabel}</p>
        </div>
      </header>

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
        <div className="space-y-7">
          <section id="today-sessions" className="scroll-mt-6 space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-brand-primary">오늘의 일정</h2>
                <p className="mt-1 text-sm text-text-sub">세션을 선택하면 고객 맥락과 코칭 기록을 관리할 수 있어요.</p>
              </div>
            </div>
            {loading ? (
              <p className="rounded-xl border border-line bg-surface p-5 text-sm text-text-sub">일정을 불러오고 있어요.</p>
            ) : todaySessions.length === 0 ? (
              <div className="rounded-xl border border-line bg-surface p-6">
                <p className="font-medium text-brand-primary">오늘 예정된 세션이 없어요.</p>
                <p className="mt-1 text-sm text-text-sub">고객 관리에서 새 코칭 일정을 등록할 수 있습니다.</p>
                <Link href="/coach/clients" className="mt-3 inline-block text-sm text-brand-primary underline underline-offset-2">
                  고객 일정 관리
                </Link>
              </div>
            ) : (
              <ol className="space-y-3">
                {todaySessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    clientName={clientNames[session.engagement_id] ?? '고객 확인 중'}
                    engagement={engagements[session.engagement_id]}
                  />
                ))}
              </ol>
            )}
          </section>

          <section id="upcoming-sessions" className="scroll-mt-6 space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-brand-primary">다가오는 7일</h2>
                <p className="mt-1 text-sm text-text-sub">이번 주 일정과 세션 준비 현황</p>
              </div>
            </div>
            {loading ? (
              <p className="rounded-xl border border-line bg-surface p-5 text-sm text-text-sub">일정을 불러오고 있어요.</p>
            ) : upcomingSessions.length === 0 ? (
              <p className="rounded-xl border border-line bg-surface p-5 text-sm text-text-sub">
                앞으로 7일 안에 예정된 세션이 없어요.
              </p>
            ) : (
              <ol className="space-y-3">
                {upcomingSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    clientName={clientNames[session.engagement_id] ?? '고객 확인 중'}
                    engagement={engagements[session.engagement_id]}
                    showDate
                  />
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-brand-sage">후속 업무</p>
                <h2 className="mt-1 font-serif text-lg text-brand-primary">피드백 대기함</h2>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                {pendingFeedbackCount}건
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-text-sub">고객 기록을 확인하고 피드백을 준비해 주세요.</p>
            <Link
              href="/coach/inbox"
              className="mt-4 inline-flex rounded-lg bg-brand-primary px-4 py-2.5 text-sm text-white"
            >
              대기함 열기
            </Link>
          </section>

        </aside>
      </div>
    </div>
  )
}
