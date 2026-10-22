/**
 * The seam for the Xendit checkout (GCash, Maya, card), built by another stream.
 *
 * /v2/pay/[token] shows the three buttons disabled with "Coming soon" until
 * NEXT_PUBLIC_XENDIT_ENABLED is "true". When it is, a tap calls this function with the
 * method. Wire it to the checkout-session mutation once that exists: it should start the
 * session for the page's payment token and send the browser to Xendit's hosted page. Until
 * then it throws, and the page says so in one line instead of failing silently.
 */
export type XenditMethod = "gcash" | "maya" | "card";

export async function startXenditCheckout(method: XenditMethod): Promise<void> {
    void method;
    throw new Error("GCash, Maya and card are not connected yet. Pay with Wise for now.");
}
