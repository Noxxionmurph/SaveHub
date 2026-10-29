# Agent skills

Skills that Claude Code loads in every session on this repo.

- `web-design-guidelines` – reviews UI code against Vercel's Web Interface Guidelines (accessibility, focus, forms, animation, typography, performance).
- `writing-guidelines` – reviews docs and page copy against Vercel's writing handbook.

Both fetch their rules fresh from GitHub when run. They were copied from
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) at commit
`1a2c79d` (MIT licence). The repo's React, React Native, Next.js and Vercel
deployment skills were left out because SaveForge is plain TypeScript hosted on
GitHub Pages.
