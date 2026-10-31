import Link from 'next/link'

export default function ClientLoginHelpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] items-center bg-app p-5">
      <section className="w-full space-y-6 rounded-xl border border-line bg-surface p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-sage">
            Mind Theory Works · 고객
          </p>
          <h1 className="font-serif text-2xl text-brand-primary">문자 인증이 되지 않나요?</h1>
          <p className="text-sm leading-[1.6] text-text-sub">
            고객 로그인은 비밀번호가 아니라 초대된 휴대폰 번호와 문자 인증번호를 사용합니다.
          </p>
        </header>

        <div className="space-y-5 text-sm leading-[1.7] text-text-main">
          <section className="space-y-1">
            <h2 className="font-medium text-brand-primary">인증 문자가 오지 않아요</h2>
            <p className="text-text-sub">
              코치에게 초대받은 번호를 입력했는지 확인해 주세요. 번호가 맞는데도 문자가 오지 않으면 코치에게 등록된 번호 확인을 요청해 주세요.
            </p>
          </section>
          <section className="space-y-1">
            <h2 className="font-medium text-brand-primary">번호나 인증번호가 맞지 않는다고 나와요</h2>
            <p className="text-text-sub">
              초대받은 휴대폰 번호인지 확인하고, 여러 번 요청했다면 가장 최근에 받은 6자리 번호를 입력해 주세요. 계속 실패하면 코치에게 번호 확인을 요청해 주세요.
            </p>
          </section>
          <section className="space-y-1">
            <h2 className="font-medium text-brand-primary">초대 링크가 없거나 만료됐어요</h2>
            <p className="text-text-sub">
              코치에게 새 초대 링크를 요청해 주세요. 이 서비스는 고객용 이메일 회원가입이나 비밀번호 로그인을 사용하지 않습니다.
            </p>
          </section>
        </div>

        <Link
          href="/client/login"
          className="block w-full rounded-lg bg-brand-primary px-4 py-3 text-center text-sm text-white"
        >
          휴대폰 로그인으로 돌아가기
        </Link>
      </section>
    </main>
  )
}
