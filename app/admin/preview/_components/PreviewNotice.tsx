import styles from './PreviewNotice.module.css';

export function PreviewNotice({ view }: { view: 'Affiliate' | 'Creator' | 'Business owner' }) {
    return <aside className={styles.notice} aria-label={`${view} preview information`}>
        <span className={styles.badge}>{view} preview · Sample data</span>
        <div><p>{view === 'Affiliate'
            ? 'Explore the current portal and try the page editor with sample details. Edits stay in this preview; uploads, sharing and payouts are disabled.'
            : view === 'Business owner'
                ? 'Explore the current business-owner workspace with sample websites and drafts. Payments, account changes and sharing are disabled.'
                : 'Explore the current field-agent dashboard with sample shops, submissions and earnings. Account changes and paid actions are disabled.'}</p>
            <p className={styles.return}>Use View as above to return to your admin dashboard.</p></div>
    </aside>;
}
