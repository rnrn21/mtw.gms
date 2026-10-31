export function normalizeKoreanMobilePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  const nationalNumber = digits.startsWith('82') ? `0${digits.slice(2)}` : digits

  if (!/^010\d{8}$/.test(nationalNumber)) {
    return null
  }

  return `+82${nationalNumber.slice(1)}`
}

export function hashInviteToken(token: string) {
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(token))
    .then((buffer) =>
      Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    )
}
