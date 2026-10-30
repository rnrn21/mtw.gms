"use client"

import { useMemo, useState } from "react"
import { CustomerList } from "@/components/coaching/customer-list"
import { LogInput } from "@/components/coaching/log-input"
import {
  placeholderCustomers,
  type CoachingCustomer,
} from "@/lib/coaching/types"

type CoachingWorkspaceProps = {
  customers?: CoachingCustomer[]
  supabaseReady?: boolean
}

export function CoachingWorkspace({
  customers = placeholderCustomers,
  supabaseReady = false,
}: CoachingWorkspaceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    customers[0]?.id ?? null,
  )
  const [log, setLog] = useState("")
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedId) ?? null,
    [customers, selectedId],
  )

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sage">
          Mind Theory Works
        </p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-deepgreen">
          코칭
        </h1>
        <p className="mt-2 text-[13px] text-sage">
          {supabaseReady
            ? "Supabase 연결 준비됨"
            : ".env.local에 Supabase 키를 넣으면 연동됩니다"}
        </p>
      </header>

      <section className="flex-1">
        <CustomerList
          customers={customers}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            setLog("")
            setSavedAt(null)
          }}
        />
      </section>

      {savedAt ? (
        <p className="border-t border-line px-5 py-2 text-[12px] text-sage">
          {savedAt}에 기록됨
        </p>
      ) : null}

      <LogInput
        customerName={selectedCustomer?.name ?? null}
        value={log}
        onChange={setLog}
        onSubmit={() => {
          setSavedAt(
            new Intl.DateTimeFormat("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date()),
          )
          setLog("")
        }}
      />
    </div>
  )
}
