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

type EngagementRow = { id: string; client_id: string }
type ProfileRow = { id: string; name: string | null }
type BriefData = {
  previousSequence: number | null
  record: { topic_text: string | null; insight_text: string | null } | null
  actions: { id: string; text: string; status: string; note: string | null; blocked_reason: string | null }[]
  checkin: { learned_text: string | null; topic_text: string | null } | null
  feedbacks: { id: string; text: string; emoji: string | null }[]
  coachNote: {
    topic: string | null
    content: string | null
    outcome: string | null
    reflection: string | null
    next_focus: string
  } | null
}

function getTodayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatTime(value: string | null) {
  if (!value) return '시간 미정'
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function CoachTodayBoard() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [clientNames, setClientNames] = useState<Record<string, string>>({})
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0)
  const [briefs, setBriefs] = useState<Record<string, BriefData>>({})
  const [openBriefId, setOpenBriefId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, {
    topic: string
    content: string
    outcome: string
    reflection: string
    nextFocus: string
  }>>({})

  const load = useCallback(async () => {
    setErrorMessage(null)
    const { start, end } = getTodayBounds()
    const sessionResult = await supabase
      .from('sessions')
      .select('id, engagement_id, seq, status, scheduled_at, scheduled_end_at')
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .order('scheduled_at', { ascending: true })

    if (sessionResult.error) {
      setErrorMessage('오늘의 세션을 불러오지 못했습니다. DB 권한과 설정을 확인해 주세요.')
      console.error('오늘 세션 조회 실패:', sessionResult.error.message)
      setLoading(false)
      return
    }

    const engagementIds = [...new Set(sessionResult.data.map((session) => session.engagement_id))]
    if (engagementIds.length) {
      const engagementsResult = await supabase
        .from('engagements')
        .select('id, client_id')
        .in('id', engagementIds)
      if (engagementsResult.error) {
        setErrorMessage('세션 고객 정보를 불러오지 못했습니다.')
        console.error('세션 고객 조회 실패:', engagementsResult.error.message)
        setLoading(false)
        return
      }

      const clientIds = [...new Set(engagementsResult.data.map((row) => row.client_id))]
      const profilesResult = await supabase.from('profiles').select('id, name').in('id', clientIds)
      if (profilesResult.error) {
        setErrorMessage('고객 이름을 불러오지 못했습니다.')
        console.error('고객 프로필 조회 실패:', profilesResult.error.message)
        setLoading(false)
        return
      }

      const names = new Map(
        (profilesResult.data as ProfileRow[]).map((profile) => [profile.id, profile.name ?? '이름 없음']),
      )
      setClientNames(
        Object.fromEntries(
          (engagementsResult.data as EngagementRow[]).map((engagement) => [
            engagement.id,
            names.get(engagement.client_id) ?? '이름 없음',
          ]),
        ),
      )
    } else {
      setClientNames({})
    }

    const recordsResult = await supabase
      .from('session_records')
      .select('id, session_id')
      .eq('written_by', 'client')
      .in(
        'session_id',
        sessionResult.data.map((session) => session.id).length
          ? sessionResult.data.map((session) => session.id)
          : ['00000000-0000-0000-0000-000000000000'],
      )
    if (recordsResult.error) {
      setErrorMessage('기록 대기 상태를 불러오지 못했습니다.')
      console.error('세션 기록 상태 조회 실패:', recordsResult.error.message)
      setLoading(false)
      return
    }

    const recordedSessionIds = new Set(recordsResult.data.map((record) => record.session_id))
    const recordIds = recordsResult.data.map((record) => record.id)
    const feedbackResult = recordIds.length
      ? await supabase
          .from('feedbacks')
          .select('id, target_id')
          .eq('target_type', 'record')
          .in('target_id', recordIds)
      : { data: [], error: null }
    if (feedbackResult.error) {
      setErrorMessage('피드백 대기 목록을 불러오지 못했습니다.')
      console.error('피드백 상태 조회 실패:', feedbackResult.error.message)
      setLoading(false)
      return
    }

    const recordSessionById = new Map(
      recordsResult.data.map((record) => [record.id, record.session_id]),
    )
    const feedbackSessionIds = new Set(
      feedbackResult.data
        .map((feedback) => recordSessionById.get(feedback.target_id))
        .filter((id): id is string => Boolean(id)),
    )

    setSessions(sessionResult.data)
    setPendingFeedbackCount(
      sessionResult.data.filter(
        (session) =>
          (session.status === 'recorded' || session.status === 'feedback_done') &&
          recordedSessionIds.has(session.id) &&
          !feedbackSessionIds.has(session.id),
      ).length,
    )
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

  const toggleBrief = async (session: SessionRow) => {
    if (openBriefId === session.id) {
      setOpenBriefId(null)
      return
    }
    setOpenBriefId(session.id)
    if (briefs[session.id]) return

    const previousResult = await supabase
      .from('sessions')
      .select('id, seq')
      .eq('engagement_id', session.engagement_id)
      .lt('seq', session.seq)
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (previousResult.error) {
      setActionMessage('이전 회차 맥락을 불러오지 못했습니다.')
      console.error('브리프 이전 회차 조회 실패:', previousResult.error.message)
      return
    }

    const previousSessionId = previousResult.data?.id
    const [
      recordResult,
      actionResult,
      checkinResult,
      noteResult,
    ] = await Promise.all([
      previousSessionId
        ? supabase
            .from('session_records')
            .select('id, topic_text, insight_text')
            .eq('session_id', previousSessionId)
            .eq('written_by', 'client')
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      previousSessionId
        ? supabase
            .from('actions')
            .select('id, text, status, note, blocked_reason')
            .eq('session_id', previousSessionId)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('checkins')
        .select('learned_text, topic_text')
        .eq('session_id', session.id)
        .maybeSingle(),
      previousSessionId
        ? supabase
            .from('coach_notes')
            .select('topic, content, outcome, reflection, next_focus')
            .eq('session_id', previousSessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])
    if (recordResult.error || actionResult.error || checkinResult.error || noteResult.error) {
      const error =
        recordResult.error ??
        actionResult.error ??
        checkinResult.error ??
        noteResult.error
      setActionMessage('세션 브리프를 불러오지 못했습니다.')
      console.error('세션 브리프 조회 실패:', error?.message)
      return
    }

    const feedbackResult = recordResult.data
      ? await supabase
          .from('feedbacks')
          .select('id, text, emoji')
          .eq('target_type', 'record')
          .eq('target_id', recordResult.data.id)
          .order('created_at', { ascending: false })
      : { data: [], error: null }
    if (feedbackResult.error) {
      setActionMessage('이전 회차 피드백을 불러오지 못했습니다.')
      console.error('이전 회차 피드백 조회 실패:', feedbackResult.error.message)
      return
    }

    setBriefs((current) => ({
      ...current,
      [session.id]: {
        previousSequence: previousResult.data?.seq ?? null,
        record: recordResult.data,
        actions: actionResult.data ?? [],
        checkin: checkinResult.data,
        feedbacks: feedbackResult.data ?? [],
        coachNote: noteResult.data,
      },
    }))
  }

  const saveCoachNote = async (sessionId: string) => {
    const draft = noteDrafts[sessionId]
    if (!draft?.nextFocus.trim()) {
      setActionMessage('비공개 노트에 다음에 다룰 내용을 입력해 주세요.')
      return
    }

    setActionMessage(null)
    const { error } = await supabase.from('coach_notes').insert({
      session_id: sessionId,
      topic: draft.topic.trim() || null,
      content: draft.content.trim() || null,
      outcome: draft.outcome.trim() || null,
      reflection: draft.reflection.trim() || null,
      next_focus: draft.nextFocus.trim(),
    })
    if (error) {
      setActionMessage('비공개 노트를 저장하지 못했습니다.')
      console.error('코치 비공개 노트 저장 실패:', error.message)
      return
    }

    setBriefs((current) => ({
      ...current,
      [sessionId]: {
        ...current[sessionId],
        coachNote: {
          topic: draft.topic.trim() || null,
          content: draft.content.trim() || null,
          outcome: draft.outcome.trim() || null,
          reflection: draft.reflection.trim() || null,
          next_focus: draft.nextFocus.trim(),
        },
      },
    }))
    setNoteDrafts((current) => ({
      ...current,
      [sessionId]: { topic: '', content: '', outcome: '', reflection: '', nextFocus: '' },
    }))
    setActionMessage('코치 전용 비공개 노트를 저장했어요.')
  }

  const openRecord = async (session: SessionRow) => {
    setActionMessage(null)
    const { error } = await supabase.rpc('open_session_record', { p_session_id: session.id })
    if (error) {
      setActionMessage('세션 기록을 열지 못했습니다. 회차 상태를 확인해 주세요.')
      console.error('세션 기록 열기 실패:', error.message)
      return
    }
    setActionMessage(`${session.seq}회차 기록을 열었습니다.`)
    await load()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-brand-sage">코치 공간</p>
          <h1 className="mt-1 font-serif text-2xl text-brand-primary">오늘</h1>
        </div>
        <p className="text-sm text-text-sub">
          {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date())}
        </p>
      </header>

      {errorMessage && <p role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm text-red-700">{errorMessage}</p>}
      {actionMessage && <p role="status" className="rounded-lg border border-line bg-surface p-4 text-sm">{actionMessage}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-brand-primary">오늘의 세션</h2>
            <button type="button" onClick={() => void load()} className="text-sm text-text-sub underline">
              새로고침
            </button>
          </div>
          {loading ? (
            <p className="rounded-xl border border-line bg-surface p-5 text-sm text-text-sub">세션을 불러오고 있어요.</p>
          ) : sessions.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-5 text-sm text-text-sub">오늘 예정된 세션이 없어요.</p>
          ) : (
            sessions.map((session) => (
              <article key={session.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-text-sub">
                      {formatTime(session.scheduled_at)} · {session.seq}회차
                    </p>
                    <h3 className="mt-1 font-serif text-lg text-brand-primary">
                      {clientNames[session.engagement_id] ?? '고객 확인 중'}
                    </h3>
                    <p className="mt-1 text-sm text-text-sub">
                      {session.status === 'recorded' || session.status === 'feedback_done'
                        ? '기록 확인 및 피드백 대기'
                        : session.status === 'recording'
                          ? '마무리 기록 진행 중'
                          : '예정된 세션'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleBrief(session)}
                      className="rounded-lg border border-line px-3 py-2 text-sm text-brand-primary"
                    >
                      {openBriefId === session.id ? '브리프 닫기' : '브리프 보기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void openRecord(session)}
                      disabled={session.status === 'recorded' || session.status === 'feedback_done'}
                      className="rounded-lg bg-brand-primary px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      마무리 기록 시작
                    </button>
                  </div>
                </div>
                {openBriefId === session.id && (
                  <div className="mt-4 rounded-lg bg-app p-4 text-sm">
                    {briefs[session.id] ? (
                      <>
                        <p>
                          지난 회차: {briefs[session.id].previousSequence
                            ? `${briefs[session.id].previousSequence}회차`
                            : '이전 기록 없음'}
                        </p>
                        {briefs[session.id].record && (
                          <div className="mt-3 space-y-2 border-t border-line pt-3">
                            <p className="font-medium">지난 회차 기록</p>
                            <p>주제: {briefs[session.id].record?.topic_text || '작성 없음'}</p>
                            <p className="whitespace-pre-wrap">발견: {briefs[session.id].record?.insight_text || '작성 없음'}</p>
                          </div>
                        )}
                        {briefs[session.id].feedbacks.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-line pt-3">
                            <p className="font-medium">이전 피드백</p>
                            {briefs[session.id].feedbacks.map((feedback) => (
                              <p key={feedback.id} className="whitespace-pre-wrap">
                                {feedback.emoji} {feedback.text}
                              </p>
                            ))}
                          </div>
                        )}
                        {briefs[session.id].actions.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-line pt-3">
                            <p className="font-medium">지난 액션 결과</p>
                            {briefs[session.id].actions.map((action) => (
                              <p key={action.id}>
                                {action.text} · {action.status === 'done' ? '해냄' : action.status === 'partial' ? '일부' : '아직'}
                                {action.note ? ` · ${action.note}` : ''}
                                {action.blocked_reason ? ` · 어려웠던 점: ${action.blocked_reason}` : ''}
                              </p>
                            ))}
                          </div>
                        )}
                        {briefs[session.id].checkin && (
                          <div className="mt-3 space-y-1 border-t border-line pt-3">
                            <p className="font-medium">이번 회차 체크인</p>
                            <p className="whitespace-pre-wrap">{briefs[session.id].checkin?.learned_text}</p>
                            <p className="whitespace-pre-wrap">다룰 주제: {briefs[session.id].checkin?.topic_text}</p>
                          </div>
                        )}
                        {briefs[session.id].coachNote && (
                          <div className="mt-3 space-y-1 border-t border-line pt-3">
                            <p className="font-medium">이전 비공개 노트</p>
                            <p>다음에 다룰 것: {briefs[session.id].coachNote?.next_focus}</p>
                            {briefs[session.id].coachNote?.topic && <p>주제: {briefs[session.id].coachNote?.topic}</p>}
                            {briefs[session.id].coachNote?.content && <p className="whitespace-pre-wrap">{briefs[session.id].coachNote?.content}</p>}
                            {briefs[session.id].coachNote?.outcome && <p className="whitespace-pre-wrap">결과: {briefs[session.id].coachNote?.outcome}</p>}
                            {briefs[session.id].coachNote?.reflection && <p className="whitespace-pre-wrap">성찰: {briefs[session.id].coachNote?.reflection}</p>}
                          </div>
                        )}
                        {briefs[session.id].previousSequence === null &&
                          briefs[session.id].actions.length === 0 &&
                          !briefs[session.id].checkin &&
                          !briefs[session.id].coachNote && (
                            <p className="mt-3 text-text-sub">이전 회차 기록이 아직 없어요.</p>
                          )}
                        <form
                          onSubmit={(event) => {
                            event.preventDefault()
                            void saveCoachNote(session.id)
                          }}
                          className="mt-4 space-y-3 border-t border-line pt-4"
                        >
                          <p className="font-medium">이번 회차 비공개 노트</p>
                          {([
                            ['topic', '오늘의 주제'],
                            ['content', '세션 메모'],
                            ['outcome', '결과'],
                            ['reflection', '코치의 성찰'],
                            ['nextFocus', '다음에 다룰 것'],
                          ] as const).map(([field, label]) => (
                            <label key={field} className="block space-y-1 text-xs">
                              <span>{label}{field === 'nextFocus' ? ' · 필수' : ''}</span>
                              <textarea
                                value={noteDrafts[session.id]?.[field] ?? ''}
                                onChange={(event) =>
                                  setNoteDrafts((current) => ({
                                    ...current,
                                    [session.id]: {
                                      topic: current[session.id]?.topic ?? '',
                                      content: current[session.id]?.content ?? '',
                                      outcome: current[session.id]?.outcome ?? '',
                                      reflection: current[session.id]?.reflection ?? '',
                                      nextFocus: current[session.id]?.nextFocus ?? '',
                                      [field]: event.target.value,
                                    },
                                  }))
                                }
                                rows={field === 'nextFocus' ? 2 : 3}
                                required={field === 'nextFocus'}
                                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                              />
                            </label>
                          ))}
                          <button
                            type="submit"
                            className="rounded-lg border border-line px-3 py-2 text-sm text-brand-primary"
                          >
                            비공개 노트 저장
                          </button>
                        </form>
                      </>
                    ) : (
                      <p className="text-text-sub">브리프를 불러오고 있어요.</p>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-line bg-surface p-5">
            <p className="text-sm text-text-sub">기록 후 피드백</p>
            <p className="mt-2 font-serif text-2xl text-brand-primary">{pendingFeedbackCount}건</p>
            <p className="mt-1 text-sm text-text-sub">고객 기록을 확인하고 피드백을 준비해 주세요.</p>
          </section>
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-serif text-lg text-brand-primary">피드백 대기함</h2>
            <p className="mt-2 text-sm text-text-sub">
              고객 기록을 읽고 다음 만남으로 이어지는 피드백을 남겨 주세요.
            </p>
            <Link href="/coach/inbox" className="mt-3 inline-block text-sm text-brand-primary underline underline-offset-2">
              대기함 열기
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}
