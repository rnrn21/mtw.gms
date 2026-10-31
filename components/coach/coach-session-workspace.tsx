'use client'

import { useCallback, useEffect, useState } from 'react'
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

type Engagement = {
  client_id: string
  total_sessions: number
  title: string
  objective_text: string | null
} | null
type ClientRecord = { topic_text: string | null; insight_text: string | null } | null
type Checkin = { learned_text: string | null; topic_text: string | null } | null
type Action = { id: string; text: string; status: string; note: string | null; blocked_reason: string | null }
type PreviousSession = {
  seq: number
  scheduled_at: string | null
  record: ClientRecord
} | null
type CoachNote = {
  id: string
  topic: string | null
  content: string | null
  outcome: string | null
  reflection: string | null
  next_focus: string
} | null

type NoteDraft = {
  topic: string
  content: string
  outcome: string
  reflection: string
  nextFocus: string
}

const emptyNote: NoteDraft = {
  topic: '',
  content: '',
  outcome: '',
  reflection: '',
  nextFocus: '',
}

function formatSchedule(value: string | null) {
  if (!value) return '시간 미정'
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function isReschedulable(status: string) {
  return status === 'scheduled' || status === 'reserved'
}

function statusLabel(status: string) {
  if (status === 'recorded') return '피드백 대기'
  if (status === 'feedback_done') return '완료'
  if (status === 'recording') return '진행 중'
  return '예정'
}

export function CoachSessionWorkspace({ sessionId }: { sessionId: string }) {
  const supabase = createClient()
  const [session, setSession] = useState<SessionRow | null>(null)
  const [clientName, setClientName] = useState('')
  const [engagement, setEngagement] = useState<Engagement>(null)
  const [clientRecord, setClientRecord] = useState<ClientRecord>(null)
  const [checkin, setCheckin] = useState<Checkin>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [previousSession, setPreviousSession] = useState<PreviousSession>(null)
  const [coachNote, setCoachNote] = useState<CoachNote>(null)
  const [noteDraft, setNoteDraft] = useState<NoteDraft>(emptyNote)
  const [actionDraft, setActionDraft] = useState('')
  const [scheduledAtDraft, setScheduledAtDraft] = useState('')
  const [scheduledEndAtDraft, setScheduledEndAtDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErrorMessage(null)
    const sessionResult = await supabase
      .from('sessions')
      .select('id, engagement_id, seq, status, scheduled_at, scheduled_end_at')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionResult.error || !sessionResult.data) {
      setErrorMessage('세션 정보를 불러오지 못했습니다.')
      if (sessionResult.error) console.error('세션 공간 조회 실패:', sessionResult.error.message)
      setLoading(false)
      return
    }

    const currentSession = sessionResult.data
    setSession(currentSession)

    const engagementResult = await supabase
      .from('engagements')
      .select('client_id, total_sessions, title, objective_text')
      .eq('id', currentSession.engagement_id)
      .maybeSingle()

    if (engagementResult.error || !engagementResult.data) {
      setErrorMessage('고객 정보를 불러오지 못했습니다.')
      if (engagementResult.error) console.error('세션 고객 조회 실패:', engagementResult.error.message)
      setLoading(false)
      return
    }
    setEngagement(engagementResult.data)
    setScheduledAtDraft(toLocalDateTimeInput(currentSession.scheduled_at))
    setScheduledEndAtDraft(toLocalDateTimeInput(currentSession.scheduled_end_at))

    const [profileResult, recordResult, checkinResult, actionResult, noteResult, previousResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('name')
        .eq('id', engagementResult.data.client_id)
        .maybeSingle(),
      supabase
        .from('session_records')
        .select('topic_text, insight_text')
        .eq('session_id', sessionId)
        .eq('written_by', 'client')
        .maybeSingle(),
      supabase
        .from('checkins')
        .select('learned_text, topic_text')
        .eq('session_id', sessionId)
        .maybeSingle(),
      supabase
        .from('actions')
        .select('id, text, status, note, blocked_reason')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('coach_notes')
        .select('id, topic, content, outcome, reflection, next_focus')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      currentSession.seq > 1
        ? supabase
            .from('sessions')
            .select('id, seq, scheduled_at')
            .eq('engagement_id', currentSession.engagement_id)
            .lt('seq', currentSession.seq)
            .order('seq', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    const queryError =
      profileResult.error ??
      recordResult.error ??
      checkinResult.error ??
      actionResult.error ??
      noteResult.error ??
      previousResult.error

    if (queryError) {
      setErrorMessage('세션 기록을 불러오지 못했습니다.')
      console.error('세션 공간 데이터 조회 실패:', queryError.message)
      setLoading(false)
      return
    }

    const previousRecordResult = previousResult.data
      ? await supabase
          .from('session_records')
          .select('topic_text, insight_text')
          .eq('session_id', previousResult.data.id)
          .eq('written_by', 'client')
          .maybeSingle()
      : { data: null, error: null }

    if (previousRecordResult.error) {
      setErrorMessage('이전 회차 기록을 불러오지 못했습니다.')
      console.error('이전 회차 기록 조회 실패:', previousRecordResult.error.message)
      setLoading(false)
      return
    }

    setClientName(profileResult.data?.name ?? '이름 없음')
    setClientRecord(recordResult.data)
    setCheckin(checkinResult.data)
    setActions(actionResult.data ?? [])
    setPreviousSession(
      previousResult.data
        ? {
            seq: previousResult.data.seq,
            scheduled_at: previousResult.data.scheduled_at,
            record: previousRecordResult.data,
          }
        : null,
    )
    setCoachNote(noteResult.data)
    setNoteDraft(
      noteResult.data
        ? {
            topic: noteResult.data.topic ?? '',
            content: noteResult.data.content ?? '',
            outcome: noteResult.data.outcome ?? '',
            reflection: noteResult.data.reflection ?? '',
            nextFocus: noteResult.data.next_focus ?? '',
          }
        : emptyNote,
    )
    setLoading(false)
  }, [sessionId, supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const addAction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = actionDraft.trim()
    if (!text) return

    setErrorMessage(null)
    setNotice(null)
    setIsSaving(true)
    const { error } = await supabase.from('actions').insert({ session_id: sessionId, text })
    setIsSaving(false)

    if (error) {
      setErrorMessage('함께 정한 실천 항목을 저장하지 못했습니다.')
      console.error('세션 실천 항목 저장 실패:', error.message)
      return
    }

    setActionDraft('')
    setNotice('함께 정한 실천 항목을 저장했습니다.')
    await load()
  }

  const rescheduleSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session || !isReschedulable(session.status)) return

    const start = new Date(scheduledAtDraft)
    const end = new Date(scheduledEndAtDraft)
    if (
      !scheduledAtDraft ||
      !scheduledEndAtDraft ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      setErrorMessage('종료 시각은 시작 시각보다 뒤여야 합니다.')
      return
    }

    setErrorMessage(null)
    setNotice(null)
    setIsSaving(true)
    const { data, error } = await supabase
      .from('sessions')
      .update({
        scheduled_at: start.toISOString(),
        scheduled_end_at: end.toISOString(),
      })
      .eq('id', session.id)
      .eq('status', session.status)
      .select('id, engagement_id, seq, status, scheduled_at, scheduled_end_at')
      .maybeSingle()
    setIsSaving(false)

    if (error || !data) {
      setErrorMessage('일정을 변경하지 못했습니다. 세션 상태를 새로고침해 확인해 주세요.')
      if (error) console.error('코칭 일정 변경 실패:', error.message)
      return
    }

    setSession(data)
    setNotice('코칭 일정을 변경했습니다.')
  }

  const saveCoachNote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!noteDraft.nextFocus.trim()) {
      setErrorMessage('다음에 다룰 내용을 입력해 주세요.')
      return
    }

    setErrorMessage(null)
    setNotice(null)
    setIsSaving(true)
    const values = {
      session_id: sessionId,
      topic: noteDraft.topic.trim() || null,
      content: noteDraft.content.trim() || null,
      outcome: noteDraft.outcome.trim() || null,
      reflection: noteDraft.reflection.trim() || null,
      next_focus: noteDraft.nextFocus.trim(),
    }
    const result = coachNote
      ? await supabase
          .from('coach_notes')
          .update(values)
          .eq('id', coachNote.id)
          .select('id, topic, content, outcome, reflection, next_focus')
          .single()
      : await supabase
          .from('coach_notes')
          .insert(values)
          .select('id, topic, content, outcome, reflection, next_focus')
          .single()
    setIsSaving(false)

    if (result.error) {
      setErrorMessage('코치 전용 노트를 저장하지 못했습니다.')
      console.error('코치 노트 저장 실패:', result.error.message)
      return
    }

    setCoachNote(result.data)
    setNotice('코치 전용 노트를 저장했습니다.')
  }

  if (loading) {
    return <p className="rounded-xl border border-line bg-surface p-5 text-sm text-text-sub">세션 공간을 불러오고 있어요.</p>
  }

  if (!session) {
    return (
      <div className="space-y-4">
        {errorMessage && <p role="alert" className="text-sm text-red-700">{errorMessage}</p>}
        <Link href="/coach" className="text-sm text-brand-primary underline">오늘 일정으로 돌아가기</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/coach" className="inline-block text-sm text-brand-primary underline underline-offset-2">
        ← 일정으로 돌아가기
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-brand-sage">
          공동 세션 공간 · {session.seq}/{engagement?.total_sessions ?? '–'}회차
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-brand-primary">{clientName}님과의 세션</h1>
            <p className="mt-2 text-sm text-text-sub">{formatSchedule(session.scheduled_at)}</p>
            <p className="mt-1 text-sm text-text-sub">
              {engagement?.title ?? '코칭 과정'}
              {engagement?.objective_text ? ` · 목표: ${engagement.objective_text}` : ''}
            </p>
          </div>
          <span className="rounded-full bg-app px-3 py-1 text-sm text-text-sub">
            {statusLabel(session.status)}
          </span>
        </div>
      </header>

      {errorMessage && <p role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm text-red-700">{errorMessage}</p>}
      {notice && <p role="status" className="rounded-lg border border-line bg-surface p-4 text-sm text-brand-sage">{notice}</p>}

      <details className="rounded-xl border border-line bg-surface p-5" open={isReschedulable(session.status)}>
        <summary className="cursor-pointer font-medium text-brand-primary">일정 관리</summary>
        {isReschedulable(session.status) ? (
          <form onSubmit={(event) => void rescheduleSession(event)} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block space-y-1.5 text-sm">
              <span>시작</span>
              <input
                type="datetime-local"
                value={scheduledAtDraft}
                onChange={(event) => setScheduledAtDraft(event.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2.5"
                required
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span>종료</span>
              <input
                type="datetime-local"
                value={scheduledEndAtDraft}
                onChange={(event) => setScheduledEndAtDraft(event.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2.5"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg border border-line px-4 py-2.5 text-sm text-brand-primary disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '일정 변경'}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-text-sub">진행 중이거나 완료된 세션의 일정은 변경할 수 없습니다.</p>
        )}
      </details>

      <section className="rounded-xl border border-line bg-app p-5">
        <h2 className="font-medium text-brand-primary">이전 회차 맥락</h2>
        {previousSession ? (
          previousSession.record ? (
            <div className="mt-3 grid gap-4 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs text-text-sub">
                  {previousSession.seq}회차 · {formatSchedule(previousSession.scheduled_at)}
                </p>
                <p className="mt-2 font-medium">주제</p>
                <p className="mt-1 whitespace-pre-wrap">{previousSession.record.topic_text || '기록 없음'}</p>
              </div>
              <div>
                <p className="font-medium">고객의 발견</p>
                <p className="mt-1 whitespace-pre-wrap">{previousSession.record.insight_text || '기록 없음'}</p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-sub">
              {previousSession.seq}회차 기록은 아직 등록되지 않았습니다.
            </p>
          )
        ) : (
          <p className="mt-2 text-sm text-text-sub">첫 회차입니다. 코칭 목표부터 함께 확인해 주세요.</p>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-xl text-brand-primary">함께 확인하고 기록하기</h2>
          <p className="mt-1 text-sm text-text-sub">
            고객이 작성한 내용과 두 사람이 정한 다음 실천 항목을 이곳에서 함께 살펴봅니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-line bg-surface p-5">
            <h3 className="font-medium text-brand-primary">고객의 세션 기록</h3>
            {clientRecord ? (
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs text-text-sub">오늘의 주제</p>
                  <p className="mt-1 whitespace-pre-wrap">{clientRecord.topic_text || '아직 작성되지 않았어요.'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-sub">오늘의 발견</p>
                  <p className="mt-1 whitespace-pre-wrap">{clientRecord.insight_text || '아직 작성되지 않았어요.'}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-text-sub">고객이 기록을 작성하면 이곳에서 함께 확인할 수 있어요.</p>
            )}
          </article>

          <article className="rounded-xl border border-line bg-surface p-5">
            <h3 className="font-medium text-brand-primary">고객 체크인</h3>
            {checkin ? (
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs text-text-sub">지난 시간에 배운 점</p>
                  <p className="mt-1 whitespace-pre-wrap">{checkin.learned_text || '작성 없음'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-sub">이번에 다루고 싶은 주제</p>
                  <p className="mt-1 whitespace-pre-wrap">{checkin.topic_text || '작성 없음'}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-text-sub">고객 체크인이 등록되면 세션 전에 확인할 수 있어요.</p>
            )}
          </article>
        </div>

        <article className="rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-brand-primary">함께 정한 실천 항목</h3>
              <p className="mt-1 text-sm text-text-sub">고객은 기록 화면에서 진행 상태와 어려웠던 점을 업데이트할 수 있어요.</p>
            </div>
          </div>
          {actions.length ? (
            <ul className="mt-4 divide-y divide-line">
              {actions.map((action) => (
                <li key={action.id} className="py-3 text-sm">
                  <p>{action.text}</p>
                  <p className="mt-1 text-xs text-text-sub">
                    {action.status === 'done' ? '완료' : action.status === 'partial' ? '일부 진행' : '시작 전'}
                    {action.note ? ` · ${action.note}` : ''}
                    {action.blocked_reason ? ` · 어려웠던 점: ${action.blocked_reason}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-sub">아직 함께 정한 실천 항목이 없어요.</p>
          )}
          <form onSubmit={(event) => void addAction(event)} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="shared-action">함께 정한 실천 항목 추가</label>
            <input
              id="shared-action"
              value={actionDraft}
              onChange={(event) => setActionDraft(event.target.value)}
              placeholder="함께 정한 다음 실천을 입력해 주세요"
              className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-sage"
            />
            <button
              type="submit"
              disabled={isSaving || !actionDraft.trim()}
              className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm text-white disabled:opacity-50"
            >
              실천 항목 추가
            </button>
          </form>
        </article>
      </section>

      <section className="rounded-xl border border-dashed border-line bg-surface p-5">
        <h2 className="font-serif text-lg text-brand-primary">코치 전용 메모</h2>
        <p className="mt-1 text-sm text-text-sub">
          이 메모는 고객 화면에 표시되지 않습니다. 함께 보는 기록과 구분해 작성해 주세요.
        </p>
        <form onSubmit={(event) => void saveCoachNote(event)} className="mt-4 grid gap-3 md:grid-cols-2">
          {([
            ['topic', '오늘의 주제'],
            ['content', '세션 메모'],
            ['outcome', '결과'],
            ['reflection', '코치의 성찰'],
            ['nextFocus', '다음에 다룰 것'],
          ] as const).map(([field, label]) => (
            <label key={field} className={`block space-y-1.5 text-sm ${field === 'content' || field === 'reflection' ? 'md:col-span-2' : ''}`}>
              <span>{label}{field === 'nextFocus' ? ' · 필수' : ''}</span>
              <textarea
                value={noteDraft[field]}
                onChange={(event) => setNoteDraft((current) => ({ ...current, [field]: event.target.value }))}
                rows={field === 'nextFocus' ? 2 : 3}
                required={field === 'nextFocus'}
                className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-sage"
              />
            </label>
          ))}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg border border-line px-4 py-2.5 text-sm text-brand-primary disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : coachNote ? '비공개 메모 수정' : '비공개 메모 저장'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
