/** Keep the existing Tendso mark readable when email clients darken its surroundings. */
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');

sharp(path.join(root, 'public/v2/brand/mark-ink-256.png'))
    // The background must be image pixels: email clients may override CSS fills.
    .flatten({ background: '#FFFFFF' })
    .removeAlpha()
    .png()
    .toFile(path.join(root, 'public/v2/brand/mark-email-white-256.png'))
    .catch(() => {
        console.error('Could not build the email brand mark.');
        process.exitCode = 1;
    });
