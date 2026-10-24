// Builds artifact/index.html: the page fragment for hosts that wrap the page in their own document
// skeleton (no <html>/<head>/<body>) and prefer inline CSS. JS modules are published alongside from dist/.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = await readFile(join(root, 'styles.css'), 'utf8');
const html = `<title>SaveForge</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}</style>
<div id="app"></div>
<noscript>This editor needs JavaScript.</noscript>
<script type="module" src="./ui/main.js"></script>
`;
await mkdir(join(root, 'artifact'), { recursive: true });
await writeFile(join(root, 'artifact', 'index.html'), html);
console.log('Wrote artifact/index.html');
