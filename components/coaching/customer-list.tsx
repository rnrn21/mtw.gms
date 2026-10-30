import type { CoachingCustomer } from "@/lib/coaching/types"

type CustomerListProps = {
  customers: CoachingCustomer[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CustomerList({
  customers,
  selectedId,
  onSelect,
}: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <p className="px-5 py-8 text-[13px] leading-6 text-sage">
        등록된 코칭 고객이 없습니다.
      </p>
    )
  }

  return (
    <ul>
      {customers.map((customer) => {
        const selected = customer.id === selectedId

        return (
          <li key={customer.id} className="border-b border-line">
            <button
              type="button"
              onClick={() => onSelect(customer.id)}
              className={`flex w-full flex-col items-start px-5 py-4 text-left ${
                selected ? "bg-deepgreen/4" : "bg-transparent"
              }`}
            >
              <span className="text-[15px] font-medium text-deepgreen">
                {customer.name}
              </span>
              <span className="mt-1 text-[13px] text-sage">
                {customer.summary}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
