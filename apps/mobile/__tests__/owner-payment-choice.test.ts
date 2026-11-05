import { parsePayChoice, payChoiceForState } from '../lib/v2/payMath';
import type { PaymentState } from '../lib/v2/ownerTypes';

const payment = { billable: true as const, status: 'approved', total: 4999, amountPaid: 0, balanceDue: 4999,
  paidInFull: false, depositPaid: false, minDownPayment: 500, canPayFull: true, canPayDeposit: true,
  canPayBalance: false, needsApproval: false, xenditEnabled: true, pendingTokens: [] };

it('uses the current quote for full and balance payments rather than a route-supplied amount', () => {
  expect(payChoiceForState('full', '1', payment)).toEqual({ kind: 'full', amount: 4999 });
  expect(payChoiceForState('balance', '1', { ...payment, canPayFull: false, canPayBalance: true, amountPaid: 1000, balanceDue: 3999 }))
    .toEqual({ kind: 'balance', amount: 3999 });
});

it.each([undefined, { billable: false, status: 'draft' }, { ...payment, paidInFull: true }, { ...payment, needsApproval: true }])(
  'does not authorize checkout from unavailable or ineligible billing state', state => {
    expect(payChoiceForState('full', '4999', state as PaymentState | undefined)).toBeNull();
  },
);

it.each([['full', '4999', 'canPayFull'], ['deposit', '1000', 'canPayDeposit'], ['balance', '4999', 'canPayBalance']])(
  'honors the server permission for %s payments', (kind, amount, flag) => {
    expect(payChoiceForState(kind, amount, { ...payment, [flag]: false })).toBeNull();
  },
);

it('uses the server deposit minimum and preserves an exact valid amount instead of inventing another charge', () => {
  expect(payChoiceForState('deposit', '500', { ...payment, minDownPayment: 1000 })).toBeNull();
  expect(payChoiceForState('deposit', '1000', { ...payment, minDownPayment: 1000 })).toEqual({ kind: 'deposit', amount: 1000 });
  expect(payChoiceForState('deposit', '750', payment)).toEqual({ kind: 'deposit', amount: 750 });
});

it.each(['', '0', '-1', '500.50', '1e3', 'Infinity', '4999', [], ['1000'], undefined].map(value => [value]))('rejects an invalid deposit route value %j', amount => {
  expect(parsePayChoice('deposit', amount, 4999, 4999)).toBeNull();
});

it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('does not fall back to a charge for invalid total %s', total => {
  expect(parsePayChoice('full', '4999', total, 0)).toBeNull();
});
