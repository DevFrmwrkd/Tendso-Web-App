import type { Facts, PipelineInput } from '@/lib/aiPipeline/types';
import { EMPTY_FACTS } from '@/lib/aiPipeline/facts';

/** A JPEG-shaped byte array with a real SOF0 header (w × h) and `size` bytes. */
export function fakeJpeg(width: number, height: number, size = 64 * 1024, seed = 1): Uint8Array {
    const b = new Uint8Array(size);
    for (let i = 0; i < size; i++) b[i] = (i * 31 + seed * 17) & 0xff;
    // SOI, then SOF0 segment: FF C0, length 17, precision 8, height, width
    b.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff], 0);
    return b;
}

export function makeInput(over: Partial<PipelineInput> = {}): PipelineInput {
    return {
        submissionId: 'sub_1',
        businessName: "Mang Ariel's Barbershop",
        businessType: 'Barbershop',
        ownerName: 'Ariel Bautista',
        ownerPhone: '0917 123 4567',
        ownerEmail: 'ariel@example.com',
        address: '12 Rizal St, Brgy. San Jose',
        city: 'Lipa',
        contentSource: 'owner_intake',
        answers: [
            { q: 'What do you offer?', a: 'Gupit lang po, 150 pesos, tapos may shave 100. Open kami alas otso hanggang alas siyete, Monday to Saturday.' },
            { q: 'How did you start?', a: 'Nagsimula ako noong 2014 sa maliit na pwesto sa palengke. Now we have our own shop.' },
        ],
        transcript: '',
        shots: [
            { index: 0, url: 'https://r2.example/headshot.jpg', role: 'headshot' },
            { index: 1, url: 'https://r2.example/inside.jpg', role: 'interior_1' },
            { index: 2, url: 'https://r2.example/inside2.jpg', role: 'interior_2' },
            { index: 3, url: 'https://r2.example/front.jpg', role: 'exterior' },
        ],
        keepOriginals: false,
        hasBuiltSite: false,
        isPublished: false,
        ...over,
    };
}

export function makeFacts(over: Partial<Facts> = {}): Facts {
    return {
        ...EMPTY_FACTS,
        businessName: "Mang Ariel's Barbershop",
        ownerName: 'Ariel Bautista',
        businessType: 'Barbershop',
        city: 'Lipa',
        services: [
            { name: 'Haircut', price: '₱150', note: '' },
            { name: 'Shave', price: '₱100', note: 'with hot towel' },
        ],
        hours: [{ days: 'Mon-Sat', time: '8am-7pm' }],
        yearStarted: '2014',
        story: 'Started in 2014 at a small stall in the market. Now we have our own shop.',
        customersLove: ['the clean fades'],
        paymentMethods: ['cash', 'GCash'],
        language: 'taglish',
        ...over,
    };
}
