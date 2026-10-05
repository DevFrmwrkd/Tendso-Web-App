import { formatPHP } from "@/lib/pricing";

/**
 * Money on screen: ₱ with no space, comma thousands, no centavos unless they
 * exist, a true minus (−) on debits and + only on credits.
 *
 *   sign "none"   ₱500, and −₱500 for a negative amount
 *   sign "auto"   +₱500 / −₱500 by the amount's own sign
 *   sign "credit" +₱500 (money in)
 *   sign "debit"  −₱500 (money out, even when stored as a positive number)
 */
export function formatMoney(amount: number, sign: "none" | "credit" | "debit" | "auto" = "none"): string {
    const abs = Math.abs(amount);
    const whole = Math.floor(abs + 1e-9);
    const cents = Math.round((abs - whole) * 100);
    const body = cents > 0 && cents < 100 ? `${formatPHP(whole)}.${String(cents).padStart(2, "0")}` : formatPHP(Math.round(abs));
    if (amount === 0) return body;
    if (sign === "debit" || (sign !== "credit" && amount < 0)) return `−${body}`;
    if (sign === "credit" || (sign === "auto" && amount > 0)) return `+${body}`;
    return body;
}
