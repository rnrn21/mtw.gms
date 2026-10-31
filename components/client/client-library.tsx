'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ReportRow = {
  id: string
  auto_summary: unknown
  coach_letter: string | null
  published_at: string | null
  survey: unknown
}

function formatPublishedAt(value: string | null) {
  if (!value) return '발행일 미정'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
}

function formatJson(value: unknown) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return JSON.stringify(value, null, 2)
}

export function ClientLibrary({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      const { data: engagements, error: engagementError } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', clientId)

      if (engagementError) {
        setErrorMessage('서재를 불러오지 못했습니다.')
        console.error('서재 과정 조회 실패:', engagementError.message)
        setLoading(false)
        return
      }

      const ids = engagements.map((engagement) => engagement.id)
      if (!ids.length) {
        setReports([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('reports')
        .select('id, auto_summary, coach_letter, published_at, survey')
        .in('engagement_id', ids)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })

      if (error) {
        setErrorMessage('발행된 리포트를 불러오지 못했습니다.')
        console.error('고객 리포트 조회 실패:', error.message)
      } else {
        setReports(data)
      }
      setLoading(false)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [clientId, supabase])

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="text-sm text-brand-sage">코칭의 기록</p>
        <h1 className="font-serif text-2xl text-brand-primary">서재</h1>
        <p className="text-sm text-text-sub">코치가 발행한 리포트와 편지를 모아두는 곳이에요.</p>
      </header>

      {errorMessage && <p role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm text-red-700">{errorMessage}</p>}
      {loading ? (
        <p className="text-sm text-text-sub">리포트를 불러오고 있어요.</p>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-5 text-sm text-text-sub">
          아직 발행된 리포트가 없어요. 코치가 준비하면 이곳에서 확인할 수 있어요.
        </p>
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => (
            <li key={report.id} className="space-y-4 rounded-xl border border-line bg-surface p-5">
              <p className="text-xs text-text-sub">{formatPublishedAt(report.published_at)}</p>
              {report.coach_letter && (
                <div>
                  <h2 className="font-serif text-lg text-brand-primary">코치의 편지</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-[1.7]">{report.coach_letter}</p>
                </div>
              )}
              {formatJson(report.auto_summary) && (
                <details className="border-t border-line pt-3">
                  <summary className="cursor-pointer text-sm text-brand-primary">여정 요약</summary>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-[1.7] text-text-sub">
                    {formatJson(report.auto_summary)}
                  </pre>
                </details>
              )}
              {formatJson(report.survey) && (
                <details className="border-t border-line pt-3">
                  <summary className="cursor-pointer text-sm text-brand-primary">함께 살펴본 질문</summary>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-[1.7] text-text-sub">
                    {formatJson(report.survey)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
