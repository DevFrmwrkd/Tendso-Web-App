import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Daily at midnight UTC: aggregate yesterday's daily analytics into monthly
crons.daily(
    'aggregate-daily-analytics',
    { hourUTC: 0, minuteUTC: 0 },
    internal.analyticsJobs.aggregateDailyToMonthly
);

// Hourly: auto-unpublish websites for submissions that haven't paid within 3 days
crons.hourly(
    'auto-unpublish-overdue-websites',
    { minuteUTC: 0 },
    internal.unpublish.checkAndUnpublish
);

// Hourly (offset by 15 min): final-day payment follow-up email
// Targets pending_payment submissions where sentEmailAt is 48–72h old AND
// followUpEmailSentAt is not yet set. Runs ahead of the :00 unpublish cron so
// the business owner gets a last nudge before their site is taken offline.
crons.hourly(
    'payment-followup-final-day',
    { minuteUTC: 15 },
    internal.followUp.checkAndSendFollowUps
);

// Hourly (offset by 30 min): poll Wise for stalled withdrawals + send creator follow-up emails
// Catches transfers that are stuck in "processing" between admin approval and final delivery
crons.hourly(
    'withdrawal-status-followup',
    { minuteUTC: 30 },
    internal.withdrawals.checkProcessingStatusCron
);

// Hourly (offset by 45 min): auto-release prospect claims older than 24h.
// Stops creators from permanently squatting on Outscraper-discovered leads
// they claimed but never interviewed. See WEB-BUILD-CRM.md Step 9.
crons.hourly(
    'release-stale-prospect-claims',
    { minuteUTC: 45 },
    internal.outscraper.releaseStaleClaimsInternal,
);

// Hourly (offset by 50 min): release booked call slots whose calendar event was
// cancelled or deleted. Deleting the event frees the calendar but not our own
// confirmed row, and availability blocks on either — so without this a cancelled
// call leaves a dead slot forever. The admin Sync button runs the same job.
crons.hourly(
    'release-cancelled-call-bookings',
    { minuteUTC: 50 },
    internal.booking.syncCancelledBookingsCron,
);

// Hourly (offset by 20 min): copy conference durations off Google onto the
// bookings they belong to. Conference records expire after 30 days, so a call
// nobody syncs before then leaves no trace of whether it happened at all.
crons.hourly(
    'pull-meet-conference-durations',
    { minuteUTC: 20 },
    internal.booking.syncConferenceDurationsCron,
);

// Every 2 minutes: poll open Knowledge Hub escalation threads for a human reply,
// turn it into a KB Q&A, and notify the asker. No-op unless KB_ESCALATION_ENABLED.
crons.interval(
    'poll-kb-escalations',
    { minutes: 2 },
    internal.escalations.pollPending,
    {},
);

// Every 2 minutes: post new creators awaiting approval to Discord's
// #pending-approvals channel and read ✅/❌ reactions to certify/reject them.
// No-op unless DISCORD_APPROVALS_ENABLED (and the channel + bot token are set).
crons.interval(
    'poll-pending-approvals',
    { minutes: 2 },
    internal.approvals.pollPending,
    {},
);

// Every 6 hours: refresh the Discord guild member list that the outreach tracker
// searches (separate repo: tendso-outreach-tracker, same Convex deployment).
// Upsert-only — never overwrites outreach state. No-op unless DISCORD_BOT_TOKEN
// and DISCORD_GUILD_ID are set.
crons.interval(
    'sync-discord-members',
    { hours: 6 },
    internal.discordMembers.syncGuildMembers,
    {},
);

export default crons;
