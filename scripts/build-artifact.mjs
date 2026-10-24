// Builds artifact/index.html: the page fragment for hosts that wrap the page in their own document
// skeleton (no <html>/<head>/<body>) and prefer inline CSS. JS modules are published alongside from dist/.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = await readFile(join(root, 'styles.css'), 'utf8');
// The Claude-hosted copy keeps loading its fonts from Google Fonts; the deployed site bundles them (fonts/, see index.html).
const fonts = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Pixelify+Sans:wght@500;700&display=swap';
const html = `<title>SaveForge</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>
${css}</style>
<div id="app"></div>
<noscript>This editor needs JavaScript.</noscript>
<script type="module" src="./ui/main.js"></script>
`;
await mkdir(join(root, 'artifact'), { recursive: true });
await writeFile(join(root, 'artifact', 'index.html'), html);
console.log('Wrote artifact/index.html');
