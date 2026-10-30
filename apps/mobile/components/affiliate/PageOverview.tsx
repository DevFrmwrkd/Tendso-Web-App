import React from 'react';
import { AffiliateAccess, Notice } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';
import { affiliateDraft, affiliateName } from './model';
import { ShareTools } from './ShareTools';

// Compatibility imports open the current editor directly; no intermediate overview or redirect.
export { AffiliatePageScreen } from './PageEditor';

export function AffiliateShareScreen() {
  return <AffiliateAccess>{({ account, isPreview, isOffline }) => <AffiliateToolFrame title="Share QR & poster" preview={isPreview} offline={isOffline} suspended={account.status !== 'active'}>
    {account.affiliateHandle ? <ShareTools handle={account.affiliateHandle} displayName={affiliateName(account)} photo={account.affiliatePhoto} referralCode={account.referralCode} price={Number(affiliateDraft(account).price)} disabled={isPreview || isOffline || account.status !== 'active'} /> : <Notice tone="warn">Your page handle is unavailable. Contact Tendso support for help.</Notice>}
  </AffiliateToolFrame>}</AffiliateAccess>;
}