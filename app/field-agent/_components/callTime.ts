/**
 * How the booking pages write a call's time, and the one outside link they
 * build. Everything is said in Manila time: the call is held there, the
 * availability action speaks Manila days, and the emails quote Manila time.
 * Manila is UTC+8 all year with no DST.
 */

const MANILA = "Asia/Manila";

/** "9:00 PM" */
export function formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString("en-US", {
        timeZone: MANILA,
        hour: "numeric",
        minute: "2-digit",
    });
}

/** "Tuesday, September 29" */
export function formatDay(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", {
        timeZone: MANILA,
        weekday: "long",
        month: "long",
        day: "numeric",
    });
}

/** "Tue, Sep 29" */
export function formatDayShort(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", {
        timeZone: MANILA,
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}

/**
 * Google's own add-to-calendar URL, so the button is a real one. Worth offering
 * after a move in particular: if they saved the call to their calendar when
 * they booked, that copy still points at the old time and nothing we do to our
 * calendar fixes theirs. Same link the confirmation and moved emails carry.
 */
export function addToCalendarUrl(startMs: number, meetUrl: string | null): string {
    const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: "10-Minute-Meeting with Tendso",
        dates: `${stamp(startMs)}/${stamp(startMs + 10 * 60_000)}`,
        details: meetUrl ? `Google Meet: ${meetUrl}` : "Your Google Meet link is in your email.",
        ctz: MANILA,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * "a•••@gmail.com". The manage page opens from a link in an email, and a link
 * can be forwarded, so it shows enough of the address to recognise it and no
 * more (the kit masks phone numbers the same way).
 */
export function maskEmail(email: string): string {
    const at = email.lastIndexOf("@");
    if (at < 1) return email;
    return `${email.slice(0, 1)}•••${email.slice(at)}`;
}
