type LogInputProps = {
  customerName: string | null
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}

export function LogInput({
  customerName,
  value,
  onChange,
  onSubmit,
}: LogInputProps) {
  const disabled = !customerName || value.trim().length === 0

  return (
    <form
      className="border-t border-line bg-offwhite px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled) onSubmit()
      }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sage">
        {customerName ? `${customerName} · 로그` : "고객을 선택하세요"}
      </p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="세션 메모를 입력하세요"
        rows={4}
        className="mt-3 w-full resize-none bg-transparent text-[15px] leading-6 text-deepgreen outline-none placeholder:text-sage/60"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={disabled}
          className="border border-line px-3 py-1.5 text-[13px] font-medium text-deepgreen disabled:text-sage"
        >
          기록
        </button>
      </div>
    </form>
  )
}
