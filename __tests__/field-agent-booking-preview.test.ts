import type { ReactElement } from 'react';

jest.mock('next/navigation', () => ({ notFound: jest.fn(() => { throw new Error('NOT_FOUND'); }) }));
jest.mock('@/app/field-agent/design-preview/BookingDesignPreview', () => {
    previewModuleLoaded();
    return { BookingDesignPreview: previewComponent };
});

import { notFound } from 'next/navigation';
import page from '@/app/field-agent/design-preview/page';

const previewModuleLoaded = jest.fn();
const previewComponent = jest.fn(function MockBookingDesignPreview() { return null; });

beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { jest.restoreAllMocks(); });
function environment(value: 'test' | 'development' | 'production') {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: value });
}

it('returns notFound before importing or rendering the fictional booking preview in production', async () => {
    environment('production');
    await expect(page()).rejects.toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(previewModuleLoaded).not.toHaveBeenCalled();
    expect(previewComponent).not.toHaveBeenCalled();
});

it('also keeps preview fixtures unavailable in other non-development environments', async () => {
    environment('test');
    await expect(page()).rejects.toThrow('NOT_FOUND');
    expect(previewModuleLoaded).not.toHaveBeenCalled();
    expect(previewComponent).not.toHaveBeenCalled();
});

it('loads the local presentation component in development without booking actions', async () => {
    environment('development');
    const element: ReactElement = await page();
    expect(notFound).not.toHaveBeenCalled();
    expect(previewModuleLoaded).toHaveBeenCalledTimes(1);
    expect(element.type).toBe(previewComponent);
    expect(element.props).toEqual({});
});
