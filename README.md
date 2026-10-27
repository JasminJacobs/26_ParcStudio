# 26_ParcStudio

Interaction prototype on the Ground News article
["Hundreds of thousands march across France…"](https://ground.news/article/hundreds-of-thousands-march-across-france-in-protests-over-schools-and-policing_85989f).
Mobile only, designed for iPhone 16 Pro (402 × 874). Vite + vanilla JS/CSS.

**Live:** https://jasminjacobs.github.io/26_ParcStudio/

## Setup

```bash
npm install
npm run dev
```

To test on the iPhone: open the "Network" URL the dev server prints (same Wi-Fi).
The microphone only works on the live HTTPS site or on `localhost`.

## Structure

```
src/
├─ main.js              app entry, shared state, switches between interactions
├─ data/articles.json   article list (title, source, bias, date, reads, image)
├─ interactions/
│  ├─ slider.js         horizontal gallery, left to right
│  ├─ overview.js       zoomed-out grid / map of all articles
│  └─ mic.js            blow into the mic → show most-read articles
└─ styles/
   ├─ tokens.css        colors, type, spacing — from Figma
   └─ main.css
public/assets/articles/ article images
```

## Deploy

Every push to `main` builds and deploys to GitHub Pages automatically
(`.github/workflows/deploy.yml`).
One-time: repo **Settings → Pages → Source: GitHub Actions**.

## Workflow

- Pull before you start: `git pull`
- Small commits, push to `main`
- Design values only in `tokens.css`, never hard-coded in the interactions
