import { redirect } from 'next/navigation';

/** Old editor bookmarks now open the owner workspace and its change-request flow. */
export default function MySitePage() {
    redirect('/my-business');
}
