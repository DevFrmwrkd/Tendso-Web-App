import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EMAIL_PREVIEW_BRAND_ASSETS } from '../previewDocument';

/** Read fixed, public brand files only. No account data, credentials, or network requests. */
export async function getProposalBrandAssets(): Promise<Record<string, string>> {
    return Object.fromEntries(await Promise.all(Object.entries(EMAIL_PREVIEW_BRAND_ASSETS).map(async ([url, asset]) => [
        url,
        `data:${asset.mime};base64,${(await readFile(join(process.cwd(), 'public', asset.path))).toString('base64')}`,
    ])));
}
