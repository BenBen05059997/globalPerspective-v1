'use strict';

const fs = require('fs');
const path = require('path');

// Install the bundled TTF fonts to /tmp for librsvg/fontconfig (shared by mapImageGenerator and storyCardImage).
// librsvg ignores @font-face/woff2. It only uses system TTF/OTF via fontconfig.
// Lambda has no /usr/share/fonts, so we bundle TTFs and configure fontconfig.
// Must run BEFORE sharp renders anything. Safe to call more than once.
let done = false;

function setupFonts(label = 'fontSetup') {
  if (done) return;
  done = true;
  try {
    const fontDir = '/tmp/fonts';
    const configDir = '/tmp/fontconfig';
    fs.mkdirSync(fontDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync('/tmp/fontconfig-cache', { recursive: true });

    // Copy bundled TTF fonts to /tmp
    const srcFonts = path.join(__dirname, 'fonts');
    if (fs.existsSync(srcFonts)) {
      for (const file of fs.readdirSync(srcFonts)) {
        if (file.endsWith('.ttf') || file.endsWith('.otf')) {
          const dest = path.join(fontDir, file);
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(path.join(srcFonts, file), dest);
          }
        }
      }
    }

    // Write fontconfig pointing to /tmp/fonts
    const fontsConf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/fonts</dir>
  <cachedir>/tmp/fontconfig-cache</cachedir>
  <config><rescan><int>0</int></rescan></config>
</fontconfig>`;
    fs.writeFileSync(path.join(configDir, 'fonts.conf'), fontsConf);

    process.env.FONTCONFIG_PATH = configDir;
    process.env.FONTCONFIG_FILE = path.join(configDir, 'fonts.conf');

    const installed = fs.readdirSync(fontDir).filter(f => f.endsWith('.ttf'));
    console.log(`${label}: ${installed.length} fonts installed in /tmp/fonts: ${installed.join(', ')}`);
  } catch (e) {
    console.error(`${label}: font setup failed:`, e.message);
  }
}

module.exports = { setupFonts };
