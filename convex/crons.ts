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

// Every 2 minutes: poll open Knowledge Hub escalation threads for a human reply,
// turn it into a KB Q&A, and notify the asker. No-op unless KB_ESCALATION_ENABLED.
crons.interval(
    'poll-kb-escalations',
    { minutes: 2 },
    internal.escalations.pollPending,
    {},
);

export default crons;
