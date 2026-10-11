import type { Id } from '../convex/_generated/dataModel'

/**
 * Payment token status enum
 */
export enum PaymentTokenStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * Payment token document structure
 */
export interface PaymentToken {
  _id: Id<'paymentTokens'>
  _creationTime: number
  submissionId: Id<'submissions'>
  token: string
  referenceCode: string
  amount: number
  status: PaymentTokenStatus
  createdAt: number
  expiresAt: number
  emailSentAt?: number
  usedAt?: number
  paymentReceivedAt?: number
  wiseTransactionId?: string
  adminNotes?: string
}

/**
 * Payment token creation args
 */
export interface CreatePaymentTokenArgs {
  submissionId: Id<'submissions'>
  referenceCode: string
  amount: number
}

/**
 * Payment token response (returned from action)
 */
export interface CreatePaymentTokenResponse extends Pick<
  PaymentToken,
  '_id' | '_creationTime' | 'submissionId' | 'token' | 'referenceCode' | 'amount' | 'status' | 'createdAt' | 'expiresAt'
> {}
