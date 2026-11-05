import { syncPhotoSlots } from '../../components/v2/owner-editor/previewHtml';

function preview() {
    const image = { tagName: 'IMG', src: 'original.jpg', getAttribute: () => 'hero.image', setAttribute: (_key: string, value: string) => { image.src = value; } };
    const background = { tagName: 'DIV', style: { backgroundImage: '' }, getAttribute: () => 'about.image', querySelector: () => null };
    const iframe = { contentDocument: { querySelectorAll: () => [image, background] } } as unknown as HTMLIFrameElement;
    return { iframe, image, background };
}

const originals = [{ field: 'hero.image', src: 'original.jpg' }, { field: 'about.image', src: 'about.jpg' }];

describe('draft photo replay', () => {
    it('restores saved image and background replacements on each page load', () => {
        for (let load = 0; load < 2; load++) {
            const { iframe, image, background } = preview();
            syncPhotoSlots(iframe, originals, (field) => field === 'hero.image' ? 'replacement.jpg' : 'new-about.jpg');
            expect(image.src).toBe('replacement.jpg');
            expect(background.style.backgroundImage).toBe('url("new-about.jpg")');
        }
    });

    it('restores the original when undo removes a replacement', () => {
        const { iframe, image, background } = preview();
        syncPhotoSlots(iframe, originals, () => 'replacement.jpg');
        syncPhotoSlots(iframe, originals, () => undefined);
        expect(image.src).toBe('original.jpg');
        expect(background.style.backgroundImage).toBe('url("about.jpg")');
    });
});
