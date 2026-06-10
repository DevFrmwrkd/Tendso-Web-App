/**
 * Payment system configuration
 * Centralized environment variables and defaults
 */

export const getPaymentConfig = () => {
  // App URL - defaults to Vercel deployment
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    'https://tendso.vercel.app'

  // Ensure no trailing slash
  const normalizedUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl

  // Wise email for payment receipts
  const wiseEmail =
    process.env.NEXT_PUBLIC_WISE_EMAIL || process.env.WISE_EMAIL

  // Token expiration (in milliseconds)
  const tokenExpirationMs = 30 * 24 * 60 * 60 * 1000 // 30 days

  if (!wiseEmail) {
    console.warn(
      'WISE_EMAIL or NEXT_PUBLIC_WISE_EMAIL not configured. Payment emails may not work correctly.'
    )
  }

  return {
    appUrl: normalizedUrl,
    wiseEmail,
    tokenExpirationMs,
    getPaymentLink: (token: string) => `${normalizedUrl}/pay/${token}`,
  }
}

export const paymentConfig = getPaymentConfig()
