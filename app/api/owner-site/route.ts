import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/** Website updates are handled through Ask for a change, including old editor clients. */
export async function POST() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    return NextResponse.json({
        code: 'OWNER_WEBSITE_CHANGES_BY_REQUEST',
        error: 'To update your website, use Ask for a change in your business workspace. The Tendso team will make the changes for you.',
    }, { status: 403 });
}
