'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type SessionRow = {
  id: string
  engagement_id: string
  seq: number
  status: string
  scheduled_at: string | null
}
type RecordRow = {
  id: string
  session_id: string
  topic_text: string | null
  insight_text: string | null
  submitted_at: string
}
type FeedbackRow = { id: string; target_id: string; text: string; emoji: string | null }
type InboxItem = {
  session: SessionRow
  record: RecordRow
  clientName: string
  feedbacks: FeedbackRow[]
}

function formatDate(value: string | null) {
  if (!value) return '일정 미정'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function CoachFeedbackInbox() {
  const supabase = createClient()
  const [items, setItems] = useState<InboxItem[]>([])
  const [drafts, setDrafts] = useState<Record<string, { text: string; emoji: string }>>({})
  const [showCompleted, setShowCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErrorMessage(null)
    const sessionResult = await supabase
      .from('sessions')
      .select('id, engagement_id, seq, status, scheduled_at')
      .in('status', ['recorded', 'feedback_done'])
      .order('scheduled_at', { ascending: false })

    if (sessionResult.error) {
      setErrorMessage('피드백 대기 목록을 불러오지 못했습니다.')
      console.error('코치 대기함 세션 조회 실패:', sessionResult.error.message)
      setLoading(false)
      return
    }

    const sessionIds = sessionResult.data.map((session) => session.id)
    if (!sessionIds.length) {
      setItems([])
      setLoading(false)
      return
    }

    const [engagementResult, recordResult] = await Promise.all([
      supabase
        .from('engagements')
        .select('id, client_id')
        .in('id', [...new Set(sessionResult.data.map((session) => session.engagement_id))]),
      supabase
        .from('session_records')
        .select('id, session_id, topic_text, insight_text, submitted_at')
        .eq('written_by', 'client')
        .in('session_id', sessionIds),
    ])

    if (engagementResult.error || recordResult.error) {
      const error = engagementResult.error ?? recordResult.error
      setErrorMessage('세션 기록과 고객 정보를 불러오지 못했습니다.')
      console.error('코치 대기함 기록 조회 실패:', error?.message)
      setLoading(false)
      return
    }

    const clientIds = [...new Set(engagementResult.data.map((engagement) => engagement.client_id))]
    const profileResult = await supabase.from('profiles').select('id, name').in('id', clientIds)
    if (profileResult.error) {
      setErrorMessage('고객 이름을 불러오지 못했습니다.')
      console.error('대기함 고객 조회 실패:', profileResult.error.message)
      setLoading(false)
      return
    }

    const recordIds = recordResult.data.map((record) => record.id)
    const feedbackResult = recordIds.length
      ? await supabase
          .from('feedbacks')
          .select('id, target_id, text, emoji')
          .eq('target_type', 'record')
          .in('target_id', recordIds)
      : { data: [], error: null }
    if (feedbackResult.error) {
      setErrorMessage('기존 피드백을 불러오지 못했습니다.')
      console.error('코치 피드백 조회 실패:', feedbackResult.error.message)
      setLoading(false)
      return
    }

    const engagementById = new Map(
      engagementResult.data.map((engagement) => [engagement.id, engagement.client_id]),
    )
    const clientNameById = new Map(
      profileResult.data.map((profile) => [profile.id, profile.name ?? '이름 없음']),
    )
    const feedbackByRecordId = new Map<string, FeedbackRow[]>()
    feedbackResult.data.forEach((feedback) => {
      const current = feedbackByRecordId.get(feedback.target_id) ?? []
      current.push(feedback)
      feedbackByRecordId.set(feedback.target_id, current)
    })
    const recordBySessionId = new Map(recordResult.data.map((record) => [record.session_id, record]))

    setItems(
      sessionResult.data.flatMap((session) => {
        const record = recordBySessionId.get(session.id)
        const clientId = engagementById.get(session.engagement_id)
        if (!record || !clientId) return []
        return [{
          session,
          record,
          clientName: clientNameById.get(clientId) ?? '이름 없음',
          feedbacks: feedbackByRecordId.get(record.id) ?? [],
        }]
      }),
    )
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const pendingCount = items.filter((item) => item.feedbacks.length === 0).length
  const visibleItems = useMemo(
    () => items.filter((item) => showCompleted || item.feedbacks.length === 0),
    [items, showCompleted],
  )

  const submitFeedback = async (item: InboxItem) => {
    const draft = drafts[item.session.id]
    if (!draft?.text.trim()) {
      setErrorMessage('피드백 내용을 입력해 주세요.')
      return
    }

    setErrorMessage(null)
    setNotice(null)
    setIsSubmitting(true)
    const { error } = await supabase.rpc('submit_session_feedback', {
      p_session_id: item.session.id,
      p_text: draft.text.trim(),
      p_emoji: draft.emoji || null,
    })
    setIsSubmitting(false)

    if (error) {
      setErrorMessage('피드백을 저장하지 못했습니다. 세션 상태와 DB 설정을 확인해 주세요.')
      console.error('코치 피드백 저장 실패:', error.message)
      return
    }

    setNotice(`${item.clientName}님의 ${item.session.seq}회차에 피드백을 보냈어요.`)
    setDrafts((current) => ({ ...current, [item.session.id]: { text: '', emoji: '' } }))
    await load()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-brand-sage">코치 공간</p>
          <h1 className="mt-1 font-serif text-2xl text-brand-primary">대기함</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCompleted((current) => !current)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-brand-primary"
        >
          {showCompleted ? '미작성만 보기' : '완료한 피드백 포함'}
        </button>
      </header>

      <p className="text-sm text-text-sub">피드백 작성 대기 {pendingCount}건</p>
      {notice && <p role="status" className="rounded-lg border border-line bg-surface p-4 text-sm text-brand-sage">{notice}</p>}
      {errorMessage && <p role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm text-red-700">{errorMessage}</p>}

      {loading ? (
        <p className="rounded-xl border border-line bg-surface p-5 text-sm text-text-sub">대기 중인 기록을 불러오고 있어요.</p>
      ) : visibleItems.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-5 text-sm text-text-sub">
          {showCompleted ? '표시할 세션 기록이 없어요.' : '모든 세션의 피드백을 작성했어요.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {visibleItems.map((item) => (
            <li key={item.session.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-text-sub">{formatDate(item.session.scheduled_at)} · {item.session.seq}회차</p>
                  <h2 className="mt-1 font-serif text-lg text-brand-primary">{item.clientName}</h2>
                </div>
                <span className="text-xs text-text-sub">
                  {item.feedbacks.length ? '피드백 완료' : '피드백 대기'}
                </span>
              </div>

              <div className="mt-4 space-y-3 rounded-lg bg-app p-4 text-sm">
                <p><span className="text-text-sub">오늘의 주제 · </span>{item.record.topic_text || '기록 없음'}</p>
                <p className="whitespace-pre-wrap">
                  <span className="text-text-sub">오늘의 발견 · </span>{item.record.insight_text || '기록 없음'}
                </p>
              </div>

              {item.feedbacks.map((feedback) => (
                <p key={feedback.id} className="mt-3 whitespace-pre-wrap border-l-2 border-brand-sage pl-3 text-sm text-text-sub">
                  {feedback.emoji} {feedback.text}
                </p>
              ))}

              {item.feedbacks.length === 0 && (
                <div className="mt-4 space-y-3">
                  <label className="block space-y-1.5 text-sm">
                    <span>코치 피드백</span>
                    <textarea
                      value={drafts[item.session.id]?.text ?? ''}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.session.id]: {
                            text: event.target.value,
                            emoji: current[item.session.id]?.emoji ?? '',
                          },
                        }))
                      }
                      rows={4}
                      className="w-full resize-y rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand-sage"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-text-sub">
                      <span>응원 표시</span>
                      <select
                        value={drafts[item.session.id]?.emoji ?? ''}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.session.id]: {
                              text: current[item.session.id]?.text ?? '',
                              emoji: event.target.value,
                            },
                          }))
                        }
                        className="rounded-lg border border-line bg-surface px-2 py-1.5"
                      >
                        <option value="">없음</option>
                        <option value="💚">💚</option>
                        <option value="🌿">🌿</option>
                        <option value="✨">✨</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void submitFeedback(item)}
                      disabled={isSubmitting}
                      className="rounded-lg bg-brand-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      피드백 보내기
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
