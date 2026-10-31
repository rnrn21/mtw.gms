'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hashInviteToken, normalizeKoreanMobilePhone } from '@/lib/coaching/phone'

type ClientRow = {
  id: string
  name: string | null
  phone: string | null
  created_at: string
}
type EngagementRow = {
  id: string
  client_id: string
  title: string
  objective_text: string | null
  total_sessions: number
  status: string
}
type SessionRow = {
  id: string
  engagement_id: string
  seq: number
  scheduled_at: string | null
  scheduled_end_at: string | null
  status: string
}
type ActionRow = { id: string; session_id: string; text: string; status: string }

function createRawToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function formatSchedule(value: string | null) {
  if (!value) return '일정 미정'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function CoachClients() {
  const supabase = createClient()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [engagements, setEngagements] = useState<EngagementRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [actions, setActions] = useState<ActionRow[]>([])
  const [name, setName] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [objectiveText, setObjectiveText] = useState('')
  const [totalSessions, setTotalSessions] = useState('10')
  const [firstSessionAt, setFirstSessionAt] = useState('')
  const [firstSessionEndAt, setFirstSessionEndAt] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [scheduleEndAt, setScheduleEndAt] = useState('')
  const [actionDrafts, setActionDrafts] = useState<Record<string, string>>({})
  const [cheerDrafts, setCheerDrafts] = useState<Record<string, string>>({})
  const [reportDrafts, setReportDrafts] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadClients = useCallback(async () => {
    setErrorMessage(null)
    const clientResult = await supabase
      .from('profiles')
      .select('id, name, phone, created_at')
      .order('created_at', { ascending: false })

    if (clientResult.error) {
      setErrorMessage('고객 목록을 불러오지 못했습니다. 권한과 DB 설정을 확인해 주세요.')
      console.error('코치 고객 목록 조회 실패:', clientResult.error.message)
      setIsLoading(false)
      return
    }

    setClients(clientResult.data)
    const clientIds = clientResult.data.map((client) => client.id)
    if (!clientIds.length) {
      setEngagements([])
      setSessions([])
      setActions([])
      setIsLoading(false)
      return
    }

    const engagementResult = await supabase
      .from('engagements')
      .select('id, client_id, title, objective_text, total_sessions, status')
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })

    if (engagementResult.error) {
      setErrorMessage('고객의 코칭 과정을 불러오지 못했습니다.')
      console.error('코칭 과정 조회 실패:', engagementResult.error.message)
      setIsLoading(false)
      return
    }

    setEngagements(engagementResult.data)
    const engagementIds = engagementResult.data.map((engagement) => engagement.id)
    if (!engagementIds.length) {
      setSessions([])
      setActions([])
      setIsLoading(false)
      return
    }

    const sessionResult = await supabase
      .from('sessions')
      .select('id, engagement_id, seq, scheduled_at, scheduled_end_at, status')
      .in('engagement_id', engagementIds)
      .order('seq', { ascending: true })

    if (sessionResult.error) {
      setErrorMessage('회차 정보를 불러오지 못했습니다.')
      console.error('코칭 회차 조회 실패:', sessionResult.error.message)
      setIsLoading(false)
      return
    }

    setSessions(sessionResult.data)
    const sessionIds = sessionResult.data.map((session) => session.id)
    if (!sessionIds.length) {
      setActions([])
      setIsLoading(false)
      return
    }

    const actionResult = await supabase
      .from('actions')
      .select('id, session_id, text, status')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true })

    if (actionResult.error) {
      setErrorMessage('회차 액션을 불러오지 못했습니다.')
      console.error('회차 액션 조회 실패:', actionResult.error.message)
      setIsLoading(false)
      return
    }

    setActions(actionResult.data)
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadClients(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadClients])

  const createInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setNotice(null)
    setInviteUrl(null)

    const normalizedPhone = normalizeKoreanMobilePhone(phoneInput)
    if (!normalizedPhone) {
      setErrorMessage('010으로 시작하는 휴대폰 번호를 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      const rawToken = createRawToken()
      const tokenHash = await hashInviteToken(rawToken)
      const { error } = await supabase.rpc('create_client_invite', {
        p_name: name.trim(),
        p_phone: normalizedPhone,
        p_token_hash: tokenHash,
      })

      if (error) {
        setErrorMessage('초대를 만들지 못했습니다. 번호 중복 여부와 DB 설정을 확인해 주세요.')
        console.error('고객 초대 생성 실패:', error.message)
        return
      }

      setInviteUrl(`${window.location.origin}/invite/${rawToken}`)
      setNotice('7일 동안 사용할 수 있는 1회용 시작 링크를 만들었어요. 링크를 복사해 고객에게 직접 전달해 주세요.')
      setName('')
      setPhoneInput('')
      await loadClients()
    } catch (error) {
      const message = error instanceof Error ? error.message : '초대를 만들지 못했습니다.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyInvite = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setNotice('시작 링크를 복사했어요. 고객에게 직접 전달해 주세요.')
    } catch (error) {
      const message = error instanceof Error ? error.message : '링크 복사에 실패했습니다.'
      setErrorMessage(message)
    }
  }

  const createEngagement = async (event: React.FormEvent<HTMLFormElement>, clientId: string) => {
    event.preventDefault()
    setErrorMessage(null)
    setNotice(null)
    if (!firstSessionAt || !firstSessionEndAt) {
      setErrorMessage('첫 세션의 시작과 종료 시각을 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.rpc('create_engagement_with_first_session', {
      p_client_id: clientId,
      p_title: courseTitle.trim(),
      p_objective_text: objectiveText.trim(),
      p_total_sessions: Number(totalSessions),
      p_first_session_at: new Date(firstSessionAt).toISOString(),
      p_first_session_end_at: new Date(firstSessionEndAt).toISOString(),
    })
    setIsSubmitting(false)

    if (error) {
      setErrorMessage('코칭 과정을 만들지 못했습니다. 입력값과 DB 마이그레이션 상태를 확인해 주세요.')
      console.error('코칭 과정 생성 실패:', error.message)
      return
    }

    setNotice('코칭 과정과 첫 회차를 만들었어요.')
    setCourseTitle('')
    setObjectiveText('')
    setFirstSessionAt('')
    setFirstSessionEndAt('')
    await loadClients()
  }

  const scheduleNextSession = async (
    event: React.FormEvent<HTMLFormElement>,
    engagement: EngagementRow,
  ) => {
    event.preventDefault()
    const courseSessions = sessions.filter((session) => session.engagement_id === engagement.id)
    const nextSequence = Math.max(0, ...courseSessions.map((session) => session.seq)) + 1
    if (nextSequence > engagement.total_sessions) {
      setErrorMessage('이 과정에 등록된 모든 회차를 만들었습니다.')
      return
    }
    if (!scheduleAt || !scheduleEndAt) {
      setErrorMessage('세션의 시작과 종료 시각을 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.rpc('schedule_coaching_session', {
      p_engagement_id: engagement.id,
      p_seq: nextSequence,
      p_scheduled_at: new Date(scheduleAt).toISOString(),
      p_scheduled_end_at: new Date(scheduleEndAt).toISOString(),
    })
    setIsSubmitting(false)

    if (error) {
      setErrorMessage('회차 일정을 저장하지 못했습니다.')
      console.error('회차 일정 저장 실패:', error.message)
      return
    }

    setNotice(`${nextSequence}회차 일정을 등록했어요.`)
    setScheduleAt('')
    setScheduleEndAt('')
    await loadClients()
  }

  const createAction = async (event: React.FormEvent<HTMLFormElement>, sessionId: string) => {
    event.preventDefault()
    const text = actionDrafts[sessionId]?.trim()
    if (!text) {
      setErrorMessage('액션 내용을 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.from('actions').insert({ session_id: sessionId, text })
    setIsSubmitting(false)
    if (error) {
      setErrorMessage('액션을 저장하지 못했습니다.')
      console.error('액션 등록 실패:', error.message)
      return
    }

    setActionDrafts((current) => ({ ...current, [sessionId]: '' }))
    await loadClients()
  }

  const sendCheer = async (event: React.FormEvent<HTMLFormElement>, engagementId: string) => {
    event.preventDefault()
    const text = cheerDrafts[engagementId]?.trim()
    if (!text) {
      setErrorMessage('응원 메시지를 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.from('cheers').insert({ engagement_id: engagementId, text })
    setIsSubmitting(false)
    if (error) {
      setErrorMessage('응원 메시지를 보내지 못했습니다.')
      console.error('코치 응원 전송 실패:', error.message)
      return
    }
    setCheerDrafts((current) => ({ ...current, [engagementId]: '' }))
    setNotice('고객에게 응원을 보냈어요.')
  }

  const publishReport = async (event: React.FormEvent<HTMLFormElement>, engagementId: string) => {
    event.preventDefault()
    const coachLetter = reportDrafts[engagementId]?.trim()
    if (!coachLetter) {
      setErrorMessage('리포트 내용을 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.from('reports').insert({
      engagement_id: engagementId,
      coach_letter: coachLetter,
      published_at: new Date().toISOString(),
    })
    setIsSubmitting(false)
    if (error) {
      setErrorMessage('리포트를 발행하지 못했습니다.')
      console.error('코치 리포트 발행 실패:', error.message)
      return
    }
    setReportDrafts((current) => ({ ...current, [engagementId]: '' }))
    setNotice('리포트를 발행했어요. 고객 서재에서 확인할 수 있습니다.')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-brand-sage">코치 공간</p>
        <h1 className="font-serif text-2xl text-brand-primary">고객</h1>
        <p className="text-sm text-text-sub">초대 링크는 한 번만 사용할 수 있고 7일 후 만료됩니다.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-serif text-lg text-brand-primary">고객 초대</h2>
          <form onSubmit={createInvite} className="mt-4 space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span>고객 이름</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand-sage"
                required
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span>휴대폰 번호</span>
              <input
                type="tel"
                inputMode="tel"
                placeholder="010-1234-5678"
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand-sage"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm text-white disabled:opacity-60"
            >
              {isSubmitting ? '만드는 중...' : '초대 링크 만들기'}
            </button>
          </form>

          {inviteUrl && (
            <div className="mt-5 space-y-3 rounded-lg border border-line bg-app p-4">
              <p className="text-sm leading-[1.6]">{notice}</p>
              <p className="break-all text-xs text-text-sub">{inviteUrl}</p>
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-brand-primary"
              >
                링크 복사
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-serif text-lg text-brand-primary">등록된 고객</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-text-sub">목록을 불러오고 있어요.</p>
          ) : clients.length === 0 ? (
            <p className="mt-4 text-sm text-text-sub">아직 등록된 고객이 없어요.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {clients.map((client) => (
                <li key={client.id} className="py-3">
                  <p className="font-medium">{client.name ?? '이름 없음'}</p>
                  <p className="text-sm text-text-sub">{client.phone ?? '휴대폰 미등록'}</p>
                  {engagements.filter((engagement) => engagement.client_id === client.id).length === 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-brand-primary">코칭 과정 만들기</summary>
                      <form onSubmit={(event) => void createEngagement(event, client.id)} className="mt-3 space-y-3">
                        <label className="block space-y-1 text-xs">
                          <span>과정 이름</span>
                          <input
                            value={courseTitle}
                            onChange={(event) => setCourseTitle(event.target.value)}
                            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                            required
                          />
                        </label>
                        <label className="block space-y-1 text-xs">
                          <span>코칭 목표 (선택)</span>
                          <textarea
                            value={objectiveText}
                            onChange={(event) => setObjectiveText(event.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block space-y-1 text-xs">
                          <span>전체 회차</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={totalSessions}
                            onChange={(event) => setTotalSessions(event.target.value)}
                            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                            required
                          />
                        </label>
                        <label className="block space-y-1 text-xs">
                          <span>첫 세션 시작</span>
                          <input
                            type="datetime-local"
                            value={firstSessionAt}
                            onChange={(event) => setFirstSessionAt(event.target.value)}
                            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                            required
                          />
                        </label>
                        <label className="block space-y-1 text-xs">
                          <span>첫 세션 종료</span>
                          <input
                            type="datetime-local"
                            value={firstSessionEndAt}
                            onChange={(event) => setFirstSessionEndAt(event.target.value)}
                            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                            required
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="rounded-lg bg-brand-primary px-3 py-2 text-sm text-white disabled:opacity-50"
                        >
                          과정과 첫 회차 저장
                        </button>
                      </form>
                    </details>
                  )}
                  {engagements
                    .filter((engagement) => engagement.client_id === client.id)
                    .map((engagement) => {
                      const courseSessions = sessions.filter(
                        (session) => session.engagement_id === engagement.id,
                      )
                      const nextSequence = Math.max(0, ...courseSessions.map((session) => session.seq)) + 1
                      return (
                        <section key={engagement.id} className="mt-4 rounded-lg border border-line p-3">
                          <h3 className="font-medium text-brand-primary">{engagement.title}</h3>
                          {engagement.objective_text && (
                            <p className="mt-1 text-xs text-text-sub">{engagement.objective_text}</p>
                          )}
                          <form
                            onSubmit={(event) => void sendCheer(event, engagement.id)}
                            className="mt-3 flex gap-2"
                          >
                            <input
                              value={cheerDrafts[engagement.id] ?? ''}
                              onChange={(event) =>
                                setCheerDrafts((current) => ({
                                  ...current,
                                  [engagement.id]: event.target.value,
                                }))
                              }
                              placeholder="중간 응원 보내기"
                              aria-label={`${engagement.title} 응원 메시지`}
                              className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-xs"
                              required
                            />
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="rounded-lg border border-line px-2 py-1.5 text-xs text-brand-primary disabled:opacity-50"
                            >
                              보내기
                            </button>
                          </form>
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs text-brand-primary">리포트 발행</summary>
                            <form
                              onSubmit={(event) => void publishReport(event, engagement.id)}
                              className="mt-2 space-y-2"
                            >
                              <textarea
                                value={reportDrafts[engagement.id] ?? ''}
                                onChange={(event) =>
                                  setReportDrafts((current) => ({
                                    ...current,
                                    [engagement.id]: event.target.value,
                                  }))
                                }
                                placeholder="고객에게 전할 코칭 편지를 작성해 주세요."
                                aria-label={`${engagement.title} 리포트`}
                                rows={4}
                                className="w-full rounded-lg border border-line px-2 py-2 text-xs"
                                required
                              />
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="rounded-lg border border-line px-2 py-1.5 text-xs text-brand-primary disabled:opacity-50"
                              >
                                발행하기
                              </button>
                            </form>
                          </details>
                          <p className="mt-1 text-xs text-text-sub">
                            {courseSessions.length}/{engagement.total_sessions}회차 등록
                          </p>
                          <ul className="mt-3 space-y-3">
                            {courseSessions.map((session) => (
                              <li key={session.id} className="border-t border-line pt-3">
                                <p className="text-xs text-text-sub">
                                  {session.seq}회차 · {formatSchedule(session.scheduled_at)}
                                </p>
                                {actions
                                  .filter((action) => action.session_id === session.id)
                                  .map((action) => (
                                    <p key={action.id} className="mt-1 text-xs">
                                      {action.text}
                                    </p>
                                  ))}
                                <form
                                  onSubmit={(event) => void createAction(event, session.id)}
                                  className="mt-2 flex gap-2"
                                >
                                  <input
                                    value={actionDrafts[session.id] ?? ''}
                                    onChange={(event) =>
                                      setActionDrafts((current) => ({
                                        ...current,
                                        [session.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="회차 액션 추가"
                                    aria-label={`${session.seq}회차 액션`}
                                    className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-xs"
                                    required
                                  />
                                  <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="rounded-lg border border-line px-2 py-1.5 text-xs text-brand-primary disabled:opacity-50"
                                  >
                                    추가
                                  </button>
                                </form>
                              </li>
                            ))}
                          </ul>
                          {nextSequence <= engagement.total_sessions && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs text-brand-primary">
                                {nextSequence}회차 예약
                              </summary>
                              <form
                                onSubmit={(event) => void scheduleNextSession(event, engagement)}
                                className="mt-3 space-y-2"
                              >
                                <label className="block space-y-1 text-xs">
                                  <span>시작</span>
                                  <input
                                    type="datetime-local"
                                    value={scheduleAt}
                                    onChange={(event) => setScheduleAt(event.target.value)}
                                    className="w-full rounded-lg border border-line px-2 py-1.5"
                                    required
                                  />
                                </label>
                                <label className="block space-y-1 text-xs">
                                  <span>종료</span>
                                  <input
                                    type="datetime-local"
                                    value={scheduleEndAt}
                                    onChange={(event) => setScheduleEndAt(event.target.value)}
                                    className="w-full rounded-lg border border-line px-2 py-1.5"
                                    required
                                  />
                                </label>
                                <button
                                  type="submit"
                                  disabled={isSubmitting}
                                  className="rounded-lg border border-line px-3 py-1.5 text-xs text-brand-primary disabled:opacity-50"
                                >
                                  일정 저장
                                </button>
                              </form>
                            </details>
                          )}
                        </section>
                      )
                    })}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {notice && !inviteUrl && <p role="status" className="text-sm text-brand-sage">{notice}</p>}
      {errorMessage && <p role="alert" className="text-sm text-red-700">{errorMessage}</p>}
    </div>
  )
}
