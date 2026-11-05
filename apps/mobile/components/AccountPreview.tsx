import type { ReactNode } from 'react';
import { useMobileAccount } from '../hooks/useMobileAccount';
import { BigNumber, Card, ScreenShell, Text, formatPeso } from './v2';
import { space } from '../theme/v2';

function Preview({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScreenShell insetBottom={false} title={title} subtitle="Sample account. Read-only preview." contentStyle={{ gap: space.lg }}>
      {children}
    </ScreenShell>
  );
}
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="lg">
      <BigNumber value={value} label={label} />
    </Card>
  );
}
export function PreviewWallet() {
  return (
    <Preview title="Earn">
      <Tile label="Available balance" value={formatPeso(0)} />
      <Tile label="Total earned" value={formatPeso(0)} />
      <Text variant="bodyLg" tone="ink2">
        Earnings and your Wise payout setup show up here. Withdrawing is off in preview.
      </Text>
    </Preview>
  );
}
export function PreviewProfile() {
  const { view } = useMobileAccount();
  return (
    <Preview title="Me">
      <Tile label="Account type" value={view === 'affiliate' ? 'Creator' : 'Field agent'} />
      <Tile label="Name" value="Sample account" />
      <Text variant="bodyLg" tone="ink2">
        Your details and settings show up here. Use Admin view to manage real accounts.
      </Text>
    </Preview>
  );
}
export function CreatorDashboardPreview() {
  return (
    <Preview title="Home">
      <Tile label="Sites" value="0" />
      <Tile label="Available balance" value={formatPeso(0)} />
      <Text variant="bodyLg" tone="ink2">
        Field agents visit shops, take photos and record an interview. Their sites and leads show up here.
      </Text>
    </Preview>
  );
}
