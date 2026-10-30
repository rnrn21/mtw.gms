'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  name: string
  summary: string | null
}

interface SessionLog {
  id: string
  customer_id: string
  content: string
  created_at: string
}

export default function Home() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<SessionLog[]>([])
  const [newLog, setNewLog] = useState('')
  const [newName, setNewName] = useState('')
  const [newSummary, setNewSummary] = useState('')
  const [loading, setLoading] = useState(true)

  // 1. 프로필 목록 가져오기
  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setProfiles(data)
        if (!selectedId) setSelectedId(data[0].id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // 2. 세션 메모 가져오기
  const fetchLogs = async (customerId: string) => {
    const { data } = await supabase
      .from('session_logs')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })

    if (data) setLogs(data)
  }

  useEffect(() => {
    fetchProfiles()
  }, [])

  useEffect(() => {
    if (selectedId) fetchLogs(selectedId)
  }, [selectedId])

  // 3. 새 고객 등록
  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return

    const { data } = await supabase
      .from('profiles')
      .insert([{ name: newName, summary: newSummary }])
      .select()

    if (data && data.length > 0) {
      setProfiles([data[0], ...profiles])
      setSelectedId(data[0].id)
      setNewName('')
      setNewSummary('')
    }
  }

  // 4. 세션 메모 등록
  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLog.trim() || !selectedId) return

    const { data } = await supabase
      .from('session_logs')
      .insert([{ customer_id: selectedId, content: newLog }])
      .select()

    if (data && data.length > 0) {
      setLogs([...logs, data[0]])
      setNewLog('')
    }
  }

  const selectedProfile = profiles.find((p) => p.id === selectedId)

  return (
    <main className="max-w-md mx-auto min-h-screen p-5 bg-[#FAF8F5] text-[#1F3A2B] font-sans">
      {/* 헤더 */}
      <header className="border-b border-[#E6E2DB] pb-4 mb-6">
        <span className="text-[11px] tracking-widest text-[#4A6B5D] font-mono uppercase block mb-1">
          Mind Theory Works
        </span>
        <h1 className="text-2xl font-bold tracking-tight">코칭 기록 관리</h1>
      </header>

      {/* 새 고객 등록 폼 */}
      <form onSubmit={handleAddProfile} className="p-4 border border-[#E6E2DB] rounded-lg bg-white space-y-3 mb-6 shadow-sm">
        <h2 className="text-xs font-semibold text-[#4A6B5D] uppercase tracking-wider">새 고객 등록</h2>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="고객 이름"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full p-2.5 border border-[#E6E2DB] rounded text-sm focus:outline-none focus:border-[#1F3A2B] bg-[#FAF8F5]/50"
          />
          <input
            type="text"
            placeholder="메모/요약 (예: 주 1회)"
            value={newSummary}
            onChange={(e) => setNewSummary(e.target.value)}
            className="w-full p-2.5 border border-[#E6E2DB] rounded text-sm focus:outline-none focus:border-[#1F3A2B] bg-[#FAF8F5]/50"
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-[#1F3A2B] text-[#FAF8F5] text-sm font-medium rounded hover:bg-[#4A6B5D] transition mt-1"
          >
            고객 추가하기
          </button>
        </div>
      </form>

      {/* 고객 목록 & 세션 노트 */}
      {loading ? (
        <p className="text-sm text-[#4A6B5D] py-4 text-center">데이터 불러오는 중...</p>
      ) : (
        <div className="space-y-6">
          {/* 고객 목록 */}
          <div>
            <h2 className="text-xs font-semibold text-[#4A6B5D] uppercase tracking-wider mb-2">
              고객 목록 ({profiles.length})
            </h2>
            <div className="space-y-2">
              {profiles.length === 0 ? (
                <p className="text-xs text-[#4A6B5D]">등록된 고객이 없습니다.</p>
              ) : (
                profiles.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`p-3 border rounded-lg cursor-pointer transition flex justify-between items-center ${
                      selectedId === p.id
                        ? 'border-[#1F3A2B] bg-[#1F3A2B] text-[#FAF8F5]'
                        : 'border-[#E6E2DB] bg-white text-[#1F3A2B] hover:border-[#4A6B5D]'
                    }`}
                  >
                    <span className="font-medium text-sm">{p.name}</span>
                    {p.summary && (
                      <span className={`text-xs ${selectedId === p.id ? 'text-[#FAF8F5]/80' : 'text-[#4A6B5D]'}`}>
                        {p.summary}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 세션 메모 */}
          {selectedProfile && (
            <div className="border-t border-[#E6E2DB] pt-5 space-y-3">
              <h2 className="text-xs font-semibold text-[#4A6B5D] uppercase tracking-wider">
                {selectedProfile.name} 님 세션 노트
              </h2>

              <div className="space-y-2 max-h-[250px] overflow-y-auto border border-[#E6E2DB] p-3 rounded-lg bg-white">
                {logs.length === 0 ? (
                  <p className="text-xs text-[#4A6B5D]/70 py-2 text-center">기록된 메모가 없습니다.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-2 border-b border-[#E6E2DB]/60 last:border-0">
                      <p className="text-sm text-[#1F3A2B] whitespace-pre-wrap">{log.content}</p>
                      <span className="text-[10px] text-[#4A6B5D] mt-1 block">
                        {new Date(log.created_at).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddLog} className="flex gap-2">
                <input
                  type="text"
                  placeholder="세션 메모 입력..."
                  value={newLog}
                  onChange={(e) => setNewLog(e.target.value)}
                  className="flex-1 p-2.5 border border-[#E6E2DB] rounded-lg text-sm focus:outline-none focus:border-[#1F3A2B] bg-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#1F3A2B] text-[#FAF8F5] text-sm font-medium rounded-lg hover:bg-[#4A6B5D] transition shrink-0"
                >
                  기록
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </main>
  )
}