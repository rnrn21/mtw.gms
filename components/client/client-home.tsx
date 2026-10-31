'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type SessionRow = {
  id: string
  seq: number
  status: string
  scheduled_at: string | null
  scheduled_end_at: string | null
  record_opened_at: string | null
}

type ActionRow = {
  id: string
  session_id: string
  text: string
  status: 'none' | 'partial' | 'done'
  closed_at: string | null
}
type RecordRow = {
  id: string
  session_id: string
  written_by: string
  topic_text: string | null
  insight_text: string | null
  submitted_at: string
}
type CheckinRow = { id: string; session_id: string }
type FeedbackRow = {
  id: string
  target_type: string
  target_id: string
  text: string
  emoji: string | null
  client_seen_at: string | null
  created_at: string
}
type CheerRow = { id: string; text: string; sent_at: string; client_seen_at: string | null }

const score: Record<ActionRow['status'], number> = { none: 0, partial: 0.5, done: 1 }
const actionLabel: Record<ActionRow['status'], string> = {
  none: '아직',
  partial: '일부 했어요',
  done: '해냈어요',
}
const actionOrder: ActionRow['status'][] = ['none', 'partial', 'done']

function formatDate(value: string | null) {
  if (!value) return '일정이 아직 정해지지 않았어요'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function ClientHome({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [engagementId, setEngagementId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [actions, setActions] = useState<ActionRow[]>([])
  const [records, setRecords] = useState<RecordRow[]>([])
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([])
  const [cheers, setCheers] = useState<CheerRow[]>([])
  const [now, setNow] = useState<number | null>(null)
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    const { data: engagement, error: engagementError } = await supabase
      .from('engagements')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (engagementError) {
      setLoadError('코칭 여정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      console.error('고객 여정 불러오기 실패:', engagementError.message)
      setLoading(false)
      return
    }

    if (!engagement) {
      setEngagementId(null)
      setSessions([])
      setActions([])
      setRecords([])
      setCheckins([])
      setFeedbacks([])
      setCheers([])
      setLoading(false)
      return
    }

    setEngagementId(engagement.id)
    const sessionResult = await supabase
      .from('sessions')
      .select('id, seq, status, scheduled_at, scheduled_end_at, record_opened_at')
      .eq('engagement_id', engagement.id)
      .order('seq', { ascending: true })

    if (sessionResult.error) {
      setLoadError('코칭 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      console.error('고객 회차 불러오기 실패:', sessionResult.error.message)
      setLoading(false)
      return
    }

    const sessionIds = sessionResult.data.map((session) => session.id)
    if (sessionIds.length === 0) {
      setSessions([])
      setActions([])
      setRecords([])
      setCheckins([])
      setFeedbacks([])
      setCheers([])
      setLoading(false)
      return
    }

    const [actionResult, recordResult, checkinResult, feedbackResult, cheerResult] = await Promise.all([
      supabase
        .from('actions')
        .select('id, session_id, text, status, closed_at')
        .in('session_id', sessionIds),
      supabase
        .from('session_records')
        .select('id, session_id, written_by, topic_text, insight_text, submitted_at')
        .in('session_id', sessionIds),
      supabase.from('checkins').select('id, session_id').in('session_id', sessionIds),
      supabase
        .from('feedbacks')
        .select('id, target_type, target_id, text, emoji, client_seen_at, created_at')
        .is('client_seen_at', null),
      supabase
        .from('cheers')
        .select('id, text, sent_at, client_seen_at')
        .eq('engagement_id', engagement.id)
        .is('client_seen_at', null)
        .order('sent_at', { ascending: false }),
    ])
    const failedResult = [
      actionResult.error,
      recordResult.error,
      checkinResult.error,
      feedbackResult.error,
      cheerResult.error,
    ].find(Boolean)

    if (failedResult) {
      setLoadError('코칭 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      console.error('고객 기록 데이터 불러오기 실패:', failedResult.message)
      setLoading(false)
      return
    }

    setSessions(sessionResult.data ?? [])
    setActions(actionResult.data ?? [])
    setRecords(recordResult.data ?? [])
    setCheckins(checkinResult.data ?? [])
    setFeedbacks(feedbackResult.data ?? [])
    setCheers(cheerResult.data ?? [])
    setNow(Date.now())
    setLoading(false)
  }, [clientId, supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    const intervalId = window.setInterval(() => void load(), 30_000)
    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [load])

  const sessionToAutoOpen = useMemo(
    () =>
      sessions.find(
        (session) =>
          session.record_opened_at === null &&
          session.scheduled_end_at !== null &&
          now !== null &&
          new Date(session.scheduled_end_at).getTime() <= now &&
          ['scheduled', 'reserved'].includes(session.status),
      ) ?? null,
    [now, sessions],
  )

  useEffect(() => {
    if (!sessionToAutoOpen) return
    const timeoutId = window.setTimeout(async () => {
      const { error } = await supabase.rpc('open_session_record', {
        p_session_id: sessionToAutoOpen.id,
      })
      if (error) {
        setActionError('예정 종료 후 세션 기록을 자동으로 열지 못했습니다.')
        console.error('홈 세션 기록 자동 개방 실패:', error.message)
        return
      }
      await load()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [load, sessionToAutoOpen, supabase])

  const currentSession = useMemo(
    () =>
      sessions.find((session) => ['recording', 'scheduled', 'reserved'].includes(session.status)) ??
      sessions.at(-1) ??
      null,
    [sessions],
  )
  const ringActions = useMemo(() => {
    const sessionWithActions = [...sessions].reverse().find((session) =>
      actions.some((action) => action.session_id === session.id),
    )
    return sessionWithActions
      ? actions.filter((action) => action.session_id === sessionWithActions.id)
      : []
  }, [actions, sessions])
  const ringPercent = ringActions.length
    ? Math.round(
        (ringActions.reduce((total, action) => total + score[action.status], 0) /
          ringActions.length) *
          100,
      )
    : 0
  const upcomingSession = useMemo(
    () =>
      sessions.find(
        (session) =>
          ['scheduled', 'reserved'].includes(session.status) &&
          session.scheduled_at !== null &&
          now !== null &&
          new Date(session.scheduled_at).getTime() >= now,
      ) ?? null,
    [now, sessions],
  )
  const missingRecord =
    currentSession !== null &&
    (currentSession.record_opened_at !== null ||
      (currentSession.scheduled_end_at !== null &&
        now !== null &&
        new Date(currentSession.scheduled_end_at).getTime() <= now)) &&
    !records.some((record) => record.session_id === currentSession.id && record.written_by === 'client')
  const needsCheckin =
    upcomingSession !== null &&
    now !== null &&
    new Date(upcomingSession.scheduled_at!).getTime() <= now + 24 * 60 * 60 * 1000 &&
    !checkins.some((checkin) => checkin.session_id === upcomingSession.id)
  const recordedCount = sessions.filter((session) => session.status === 'recorded' || session.status === 'feedback_done').length
  const latestDiscovery = [...records]
    .filter((record) => record.written_by === 'client' && record.insight_text?.trim())
    .sort((left, right) => right.submitted_at.localeCompare(left.submitted_at))[0]
  const priority = feedbacks.length
    ? { title: '새 코치 피드백이 있어요', detail: '기록 화면에서 코치의 메시지를 확인해 보세요.', href: '/records' }
    : missingRecord
      ? { title: '세션의 여운을 기록해 보세요', detail: '짧은 기록이 다음 만남의 좋은 출발점이 돼요.', href: '/records' }
      : needsCheckin
        ? { title: '다음 세션 전 체크인을 남겨 주세요', detail: '이번 주의 실행과 다음에 다룰 주제를 적어 보세요.', href: '/records' }
        : ringActions.some((action) => action.status !== 'done')
          ? { title: '이번 주 액션을 이어가 볼까요?', detail: '작은 실행도 여정의 일부예요.', href: '/records' }
          : null

  const changeActionStatus = async (action: ActionRow) => {
    const nextStatus =
      actionOrder[(actionOrder.indexOf(action.status) + 1) % actionOrder.length]
    setUpdatingActionId(action.id)
    setActionError(null)
    const { error } = await supabase.rpc('update_action_status', {
      p_action_id: action.id,
      p_status: nextStatus,
    })
    setUpdatingActionId(null)

    if (error) {
      setActionError('액션 상태를 저장하지 못했습니다. 다시 시도해 주세요.')
      console.error('액션 상태 변경 실패:', error.message)
      return
    }

    setActions((current) =>
      current.map((item) => (item.id === action.id ? { ...item, status: nextStatus } : item)),
    )
  }

  const markCheerSeen = async (cheerId: string) => {
    const { error } = await supabase.rpc('mark_cheer_seen', { p_cheer_id: cheerId })
    if (error) {
      setActionError('응원을 확인 처리하지 못했습니다. 다시 시도해 주세요.')
      console.error('응원 확인 처리 실패:', error.message)
      return
    }
    setCheers((current) => current.filter((cheer) => cheer.id !== cheerId))
  }

  const markFeedbackSeen = async (feedbackId: string) => {
    const { error } = await supabase.rpc('mark_feedback_seen', { p_feedback_id: feedbackId })
    if (error) {
      setActionError('피드백을 확인 처리하지 못했습니다. 다시 시도해 주세요.')
      console.error('피드백 확인 처리 실패:', error.message)
      return
    }
    setFeedbacks((current) => current.filter((feedback) => feedback.id !== feedbackId))
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-text-sub">여정을 불러오고 있어요.</p>
  }

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="text-sm text-brand-sage">세션 사이의 여정</p>
        <h1 className="font-serif text-2xl text-brand-primary">오늘의 마음을 이어가요</h1>
      </header>

      {loadError && (
        <div role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm">
          <p>{loadError}</p>
          <button type="button" onClick={() => void load()} className="mt-2 underline">
            다시 시도
          </button>
        </div>
      )}

      {!engagementId ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <p className="font-medium text-brand-primary">아직 시작 전이에요</p>
          <p className="mt-2 text-sm text-text-sub">코치가 여정을 준비하면 이곳에서 함께 이어갈 수 있어요.</p>
        </section>
      ) : (
        <>
          {priority && (
            <Link
              href={priority.href}
              className="block rounded-xl border border-line bg-surface p-5 transition-colors hover:bg-brand-sage-tint"
            >
              <p className="text-xs text-brand-sage">지금 할 일</p>
              <h2 className="mt-2 font-serif text-lg text-brand-primary">{priority.title}</h2>
              <p className="mt-1 text-sm text-text-sub">{priority.detail}</p>
            </Link>
          )}

          {feedbacks.map((feedback) => (
            <article key={feedback.id} className="rounded-xl border border-line bg-surface p-5">
              <p className="text-xs text-brand-sage">코치 피드백 {feedback.emoji ?? ''}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-main">{feedback.text}</p>
              <button
                type="button"
                onClick={() => void markFeedbackSeen(feedback.id)}
                className="mt-3 text-xs text-text-sub underline underline-offset-2"
              >
                확인했어요
              </button>
            </article>
          ))}

          {cheers.map((cheer) => (
            <article key={cheer.id} className="rounded-xl border border-line bg-brand-sage-tint p-5">
              <p className="text-xs text-brand-sage">코치의 응원</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-main">{cheer.text}</p>
              <button
                type="button"
                onClick={() => void markCheerSeen(cheer.id)}
                className="mt-3 text-xs text-text-sub underline underline-offset-2"
              >
                응원 확인하기
              </button>
            </article>
          ))}

          <section className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center gap-5">
              <div
                role="img"
                aria-label={`이번 주 액션 진행률 ${ringPercent}%`}
                className="grid size-24 shrink-0 place-items-center rounded-full transition-all duration-[600ms] ease-out"
                style={{
                  background: `conic-gradient(${ringPercent === 100 ? 'var(--accent-gold)' : 'var(--brand-sage)'} ${ringPercent}%, var(--brand-sage-tint) ${ringPercent}% 100%)`,
                }}
              >
                <span
                  className={`grid size-[76px] place-items-center rounded-full bg-surface text-lg font-medium text-brand-primary ${
                    ringPercent === 100 ? 'animate-[ring-check_900ms_ease-out]' : ''
                  }`}
                >
                  {ringPercent === 100 ? '✓' : `${ringPercent}%`}
                </span>
              </div>
              <div>
                <h2 className="font-medium text-brand-primary">이번 주 액션</h2>
                <p className="mt-1 text-sm text-text-sub">
                  {ringPercent === 100 ? '이번 주 약속을 해냈어요' : '나에게 맞는 속도로 이어가요'}
                </p>
              </div>
            </div>
            {ringActions.length > 0 && (
              <ul className="mt-5 divide-y divide-line">
                {ringActions.map((action) => (
                  <li key={action.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="text-text-main">{action.text}</span>
                    <button
                      type="button"
                      disabled={updatingActionId === action.id || Boolean(action.closed_at)}
                      onClick={() => void changeActionStatus(action)}
                      className="rounded-full border border-line px-3 py-1.5 text-text-sub disabled:opacity-50"
                    >
                      {updatingActionId === action.id ? '저장 중...' : actionLabel[action.status]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <p className="text-xs text-text-sub">지난 회차의 오늘의 발견</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-text-main">
              {latestDiscovery?.insight_text ?? '기록이 쌓이면 지난 회차의 발견이 이곳에 남아요.'}
            </p>
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-text-sub">여정 진행</p>
                <h2 className="mt-1 font-serif text-lg text-brand-primary">
                  {recordedCount}회차 기록 완료
                </h2>
              </div>
              <span className="text-sm text-text-sub">{sessions.length}회차 등록됨</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-brand-sage-tint">
              <div
                className="h-full rounded-full bg-brand-sage transition-all duration-[600ms] ease-out"
                style={{
                  width: `${sessions.length ? Math.min(100, (recordedCount / sessions.length) * 100) : 0}%`,
                }}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-xs text-text-sub">다음 만남</p>
              <h2 className="mt-1 font-serif text-lg text-brand-primary">
                {upcomingSession ? `${upcomingSession.seq}회차` : '예정된 세션'}
              </h2>
            </div>
            <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-text-sub">
              {formatDate(upcomingSession?.scheduled_at ?? null)}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg text-brand-primary">회차 타임라인</h2>
            {sessions.length === 0 ? (
              <p className="rounded-lg border border-line bg-surface p-4 text-sm text-text-sub">
                코치가 회차를 준비하면 이곳에 표시돼요.
              </p>
            ) : (
              <ol className="space-y-2">
                {sessions.map((session) => (
                  <li key={session.id} className="flex items-center justify-between rounded-lg border border-line bg-surface p-4">
                    <div>
                      <p className="font-medium text-brand-primary">{session.seq}회차</p>
                      <p className="text-xs text-text-sub">{formatDate(session.scheduled_at)}</p>
                    </div>
                    <span className="text-xs text-text-sub">
                      {session.status === 'recorded' || session.status === 'feedback_done'
                        ? '기록 완료'
                        : session.status === 'recording'
                          ? '기록 중'
                          : '예정'}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  )
}
