'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type SessionRow = {
  id: string
  engagement_id: string
  seq: number
  status: string
  scheduled_at: string | null
  scheduled_end_at: string | null
  record_opened_at: string | null
}
type RecordRow = {
  id: string
  session_id: string
  topic_text: string | null
  insight_text: string | null
  written_by: string
  submitted_at: string
}
type CheckinRow = {
  id: string
  session_id: string
  learned_text: string | null
  topic_text: string | null
  submitted_at: string
}
type ActionRow = { id: string; session_id: string; text: string; status: string; closed_at: string | null }
type FeedbackRow = {
  id: string
  target_type: string
  target_id: string
  text: string
  emoji: string | null
  created_at: string
}
type Draft = {
  sessionId: string | null
  topic: string
  insight: string
  dirty: boolean
}

function formatSessionDate(value: string | null) {
  if (!value) return '일정 미정'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function ClientRecords({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [records, setRecords] = useState<RecordRow[]>([])
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [actions, setActions] = useState<ActionRow[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([])
  const [draft, setDraft] = useState<Draft>({
    sessionId: null,
    topic: '',
    insight: '',
    dirty: false,
  })
  const [checkinLearned, setCheckinLearned] = useState('')
  const [checkinTopic, setCheckinTopic] = useState('')
  const [checkinDirty, setCheckinDirty] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState<number | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErrorMessage(null)
    const engagementResult = await supabase
      .from('engagements')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'active')

    if (engagementResult.error) {
      setErrorMessage('코칭 과정을 불러오지 못했습니다.')
      console.error('기록 화면 과정 조회 실패:', engagementResult.error.message)
      setLoading(false)
      return
    }

    const ids = engagementResult.data.map((engagement) => engagement.id)
    if (!ids.length) {
      setSessions([])
      setRecords([])
      setCheckins([])
      setActions([])
      setFeedbacks([])
      setLoading(false)
      return
    }

    const sessionResult = await supabase
      .from('sessions')
      .select('id, engagement_id, seq, status, scheduled_at, scheduled_end_at, record_opened_at')
      .in('engagement_id', ids)
      .order('seq', { ascending: true })

    if (sessionResult.error) {
      setErrorMessage('세션 목록을 불러오지 못했습니다.')
      console.error('기록 화면 세션 조회 실패:', sessionResult.error.message)
      setLoading(false)
      return
    }

    const sessionIds = sessionResult.data.map((session) => session.id)
    if (!sessionIds.length) {
      setSessions([])
      setRecords([])
      setCheckins([])
      setActions([])
      setFeedbacks([])
      setLoading(false)
      return
    }

    const [recordResult, checkinResult, actionResult] = await Promise.all([
      supabase
        .from('session_records')
        .select('id, session_id, topic_text, insight_text, written_by, submitted_at')
        .in('session_id', sessionIds),
      supabase
        .from('checkins')
        .select('id, session_id, learned_text, topic_text, submitted_at')
        .in('session_id', sessionIds),
      supabase
        .from('actions')
        .select('id, session_id, text, status, closed_at')
        .in('session_id', sessionIds),
    ])

    if (recordResult.error || checkinResult.error || actionResult.error) {
      const error = recordResult.error ?? checkinResult.error ?? actionResult.error
      setErrorMessage('기록과 액션을 불러오지 못했습니다.')
      console.error('고객 기록 데이터 조회 실패:', error?.message)
      setLoading(false)
      return
    }

    const targetIds = [
      ...recordResult.data.map((record) => record.id),
      ...checkinResult.data.map((checkin) => checkin.id),
      ...actionResult.data.map((action) => action.id),
    ]
    const feedbackResult = targetIds.length
      ? await supabase
          .from('feedbacks')
          .select('id, target_type, target_id, text, emoji, created_at')
          .in('target_id', targetIds)
          .is('client_seen_at', null)
          .order('created_at', { ascending: false })
      : { data: [], error: null }

    if (feedbackResult.error) {
      setErrorMessage('코치 피드백을 불러오지 못했습니다.')
      console.error('고객 피드백 조회 실패:', feedbackResult.error.message)
      setLoading(false)
      return
    }

    setSessions(sessionResult.data)
    setRecords(recordResult.data)
    setCheckins(checkinResult.data)
    setActions(actionResult.data)
    setFeedbacks(feedbackResult.data)
    const currentTime = Date.now()
    setNow(currentTime)

    const writableSession = sessionResult.data.find(
      (session) =>
        session.record_opened_at !== null ||
        (session.scheduled_end_at !== null &&
          new Date(session.scheduled_end_at).getTime() <= currentTime),
    )
    if (writableSession && activeSessionId === null) {
      const existing = recordResult.data.find(
        (record) => record.session_id === writableSession.id && record.written_by === 'client',
      )
      setActiveSessionId(writableSession.id)
      setDraft({
        sessionId: writableSession.id,
        topic: existing?.topic_text ?? '',
        insight: existing?.insight_text ?? '',
        dirty: false,
      })
    }

    const nextSession = sessionResult.data.find(
      (session) =>
        session.scheduled_at !== null &&
        new Date(session.scheduled_at).getTime() >= currentTime &&
        new Date(session.scheduled_at).getTime() <= currentTime + 24 * 60 * 60 * 1000,
    )
    const existingCheckin = nextSession
      ? checkinResult.data.find((checkin) => checkin.session_id === nextSession.id)
      : null
    if (!checkinDirty) {
      setCheckinLearned(existingCheckin?.learned_text ?? '')
      setCheckinTopic(existingCheckin?.topic_text ?? '')
    }
    setLoading(false)
  }, [activeSessionId, checkinDirty, clientId, supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    const intervalId = window.setInterval(() => void load(), 30_000)
    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [load])

  const dueToOpen = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.record_opened_at === null &&
          session.scheduled_end_at !== null &&
          now !== null &&
          new Date(session.scheduled_end_at).getTime() <= now &&
          ['scheduled', 'reserved'].includes(session.status),
      ),
    [now, sessions],
  )

  useEffect(() => {
    if (!dueToOpen.length) return
    const timeoutId = window.setTimeout(async () => {
      for (const session of dueToOpen) {
        const { error } = await supabase.rpc('open_session_record', { p_session_id: session.id })
        if (error) {
          setErrorMessage('예정 종료 후 기록을 자동으로 열지 못했습니다.')
          console.error('세션 기록 자동 개방 실패:', error.message)
          return
        }
      }
      await load()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [dueToOpen, load, supabase])

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null
  const recordIsOpen =
    activeSession !== null &&
    (activeSession.record_opened_at !== null ||
      (activeSession.scheduled_end_at !== null &&
        now !== null &&
        new Date(activeSession.scheduled_end_at).getTime() <= now))
  const upcomingSession = sessions.find(
    (session) =>
      session.scheduled_at !== null &&
      now !== null &&
      new Date(session.scheduled_at).getTime() >= now &&
      new Date(session.scheduled_at).getTime() <= now + 24 * 60 * 60 * 1000,
  )
  const upcomingCheckin = upcomingSession
    ? checkins.find((checkin) => checkin.session_id === upcomingSession.id)
    : null

  const saveRecordDraft = useCallback(
    async (value: Draft) => {
      if (!value.sessionId || !value.dirty) return true
      setSaveMessage('임시 저장 중...')
      const { error } = await supabase.from('session_records').upsert(
        {
          session_id: value.sessionId,
          written_by: 'client',
          topic_text: value.topic,
          insight_text: value.insight,
          submitted_at: new Date().toISOString(),
          edited_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,written_by' },
      )

      if (error) {
        setSaveMessage(null)
        setErrorMessage('기록을 저장하지 못했습니다. 입력 내용은 화면에 남아 있습니다.')
        console.error('세션 기록 임시 저장 실패:', error.message)
        return false
      }

      setDraft((current) => ({ ...current, dirty: false }))
      setSaveMessage('임시 저장했어요.')
      return true
    },
    [supabase],
  )

  useEffect(() => {
    if (!draft.dirty || !recordIsOpen || isSubmitting) return
    const timeoutId = window.setTimeout(() => void saveRecordDraft(draft), 700)
    return () => window.clearTimeout(timeoutId)
  }, [draft, isSubmitting, recordIsOpen, saveRecordDraft])

  const submitRecord = async () => {
    if (!activeSession || !recordIsOpen) return
    if (!draft.topic.trim() && !draft.insight.trim()) {
      setErrorMessage('오늘의 주제나 발견 중 하나를 적어 주세요.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    const saved = await saveRecordDraft({ ...draft, dirty: true })
    if (!saved) {
      setIsSubmitting(false)
      return
    }

    const { error } = await supabase.rpc('submit_session_record', {
      p_session_id: activeSession.id,
    })
    if (error) {
      setErrorMessage('기록을 완료하지 못했습니다. 저장된 내용은 남아 있으니 다시 시도해 주세요.')
      console.error('세션 기록 제출 실패:', error.message)
      setIsSubmitting(false)
      return
    }

    setSaveMessage('기록을 완료했어요.')
    setIsSubmitting(false)
    await load()
  }

  const saveCheckin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!upcomingSession) return
    setErrorMessage(null)
    setIsSubmitting(true)
    const { error } = await supabase.from('checkins').upsert(
      {
        session_id: upcomingSession.id,
        learned_text: checkinLearned,
        topic_text: checkinTopic,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' },
    )
    setIsSubmitting(false)

    if (error) {
      setErrorMessage('체크인을 저장하지 못했습니다. 세션 24시간 전부터 작성할 수 있어요.')
      console.error('세션 체크인 저장 실패:', error.message)
      return
    }
    setCheckinDirty(false)
    setSaveMessage('체크인을 저장했어요.')
    await load()
  }

  const updateAction = async (action: ActionRow) => {
    const status = action.status === 'none' ? 'partial' : action.status === 'partial' ? 'done' : 'none'
    setUpdatingActionId(action.id)
    setErrorMessage(null)
    const { error } = await supabase.rpc('update_action_status', {
      p_action_id: action.id,
      p_status: status,
    })
    setUpdatingActionId(null)

    if (error) {
      setErrorMessage('액션 상태를 저장하지 못했습니다.')
      console.error('액션 상태 변경 실패:', error.message)
      return
    }
    setActions((current) => current.map((item) => item.id === action.id ? { ...item, status } : item))
  }

  const markFeedbackSeen = async (feedbackId: string) => {
    const { error } = await supabase.rpc('mark_feedback_seen', { p_feedback_id: feedbackId })
    if (error) {
      setErrorMessage('피드백 확인 상태를 저장하지 못했습니다.')
      console.error('피드백 확인 처리 실패:', error.message)
      return
    }
    setFeedbacks((current) => current.filter((feedback) => feedback.id !== feedbackId))
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-text-sub">기록을 불러오고 있어요.</p>
  }

  const activeRecord = records.find(
    (record) => record.session_id === activeSessionId && record.written_by === 'client',
  )

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="text-sm text-brand-sage">세션 사이의 기록</p>
        <h1 className="font-serif text-2xl text-brand-primary">기록</h1>
      </header>

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
      {saveMessage && <p role="status" className="text-sm text-brand-sage">{saveMessage}</p>}

      {feedbacks.map((feedback) => (
        <article key={feedback.id} className="rounded-xl border border-line bg-surface p-5">
          <p className="text-xs text-brand-sage">코치 피드백 {feedback.emoji ?? ''}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{feedback.text}</p>
          <button
            type="button"
            onClick={() => void markFeedbackSeen(feedback.id)}
            className="mt-3 text-xs text-text-sub underline"
          >
            확인했어요
          </button>
        </article>
      ))}

      {upcomingSession && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <p className="text-xs text-text-sub">다음 세션 체크인 · {formatSessionDate(upcomingSession.scheduled_at)}</p>
          {upcomingCheckin ? (
            <p className="mt-2 text-sm text-brand-sage">체크인을 남겼어요.</p>
          ) : null}
          <form onSubmit={saveCheckin} className="mt-4 space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span>이번 주 액션을 해보며 알게 된 점</span>
              <textarea
                value={checkinLearned}
                onChange={(event) => {
                  setCheckinLearned(event.target.value)
                  setCheckinDirty(true)
                }}
                rows={3}
                className="w-full resize-y rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand-sage"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span>다음 세션에서 다루고 싶은 주제</span>
              <textarea
                value={checkinTopic}
                onChange={(event) => {
                  setCheckinTopic(event.target.value)
                  setCheckinDirty(true)
                }}
                rows={3}
                className="w-full resize-y rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand-sage"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting || !checkinDirty}
              className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm text-white disabled:opacity-50"
            >
              체크인 저장
            </button>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-serif text-lg text-brand-primary">세션 마무리 기록</h2>
        {activeSession && recordIsOpen ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-text-sub">{activeSession.seq}회차 · {formatSessionDate(activeSession.scheduled_at)}</p>
            {activeRecord && activeSession.status !== 'recording' && (
              <p className="text-sm text-brand-sage">기록을 완료했어요.</p>
            )}
            <label className="block space-y-1.5 text-sm">
              <span>오늘의 주제</span>
              <textarea
                value={draft.topic}
                onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value, dirty: true }))}
                rows={3}
                disabled={activeSession.status !== 'recording'}
                className="w-full resize-y rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand-sage disabled:bg-app"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span>오늘의 발견</span>
              <textarea
                value={draft.insight}
                onChange={(event) => setDraft((current) => ({ ...current, insight: event.target.value, dirty: true }))}
                rows={3}
                disabled={activeSession.status !== 'recording'}
                className="w-full resize-y rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand-sage disabled:bg-app"
              />
            </label>
            {activeSession.status === 'recording' ? (
              <button
                type="button"
                onClick={() => void submitRecord()}
                disabled={isSubmitting}
                className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm text-white disabled:opacity-50"
              >
                {isSubmitting ? '저장 중...' : '기록 완료'}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-sub">코칭 시간에 이곳이 열려요.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg text-brand-primary">회차 기록</h2>
        {sessions.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface p-4 text-sm text-text-sub">아직 시작 전이에요</p>
        ) : (
          sessions.map((session) => {
            const record = records.find(
              (item) => item.session_id === session.id && item.written_by === 'client',
            )
            const sessionActions = actions.filter((action) => action.session_id === session.id)
            return (
              <article key={session.id} className="rounded-xl border border-line bg-surface p-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSessionId(session.id)
                    setDraft({
                      sessionId: session.id,
                      topic: record?.topic_text ?? '',
                      insight: record?.insight_text ?? '',
                      dirty: false,
                    })
                  }}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span>
                    <span className="block font-medium text-brand-primary">{session.seq}회차</span>
                    <span className="text-xs text-text-sub">{formatSessionDate(session.scheduled_at)}</span>
                  </span>
                  <span className="text-xs text-text-sub">
                    {record ? '기록 보기' : '기록 열기'}
                  </span>
                </button>
                {record && (
                  <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
                    {record.topic_text && <p><span className="text-text-sub">주제 · </span>{record.topic_text}</p>}
                    {record.insight_text && <p className="whitespace-pre-wrap"><span className="text-text-sub">발견 · </span>{record.insight_text}</p>}
                  </div>
                )}
                {sessionActions.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-line pt-3">
                    {sessionActions.map((action) => (
                      <li key={action.id} className="flex items-center justify-between gap-3 text-sm">
                        <span>{action.text}</span>
                        <button
                          type="button"
                          disabled={updatingActionId === action.id || Boolean(action.closed_at)}
                          onClick={() => void updateAction(action)}
                          className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-text-sub disabled:opacity-50"
                        >
                          {action.status === 'done'
                            ? '이번 주 약속을 해냈어요'
                            : action.status === 'partial'
                              ? '일부 했어요'
                              : '아직'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })
        )}
      </section>
    </div>
  )
}
