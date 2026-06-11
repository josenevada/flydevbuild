# flydevbuild.com

Landing page for **flydevbuild** — a vibecoding agency that ships high-fidelity,
production-grade MVPs in exactly 14 days.

## Stack

Fully static — no build step. Everything is vendored locally for speed and
offline-safe deploys:

- **GSAP + ScrollTrigger** — scroll-scrubbed reveals, split-text animations,
  velocity-reactive marquee, magnetic buttons, custom cursor
- **Three.js** — hero scene: an instanced voxel structure (~400 cubes, one draw
  call) that assembles at speed on load, idles with float/rotation, and
  disassembles as you scroll
- **Lenis** — smooth scrolling, driven by GSAP's ticker
- **Self-hosted fonts** — Space Grotesk, Inter, JetBrains Mono (woff2)

## Structure

```
index.html        single page: hero / marquee / process bento / stack / CTA
css/style.css     design system + responsive + reduced-motion handling
js/main.js        GSAP/Lenis orchestration + micro-interactions
js/scene.js       Three.js hero scene (InstancedMesh)
vendor/           gsap, ScrollTrigger, lenis, three (pinned dist files)
fonts/            self-hosted woff2
scripts/verify.mjs  headless-Chrome checks (console, overflow, reveals, fps)
```

## Develop

```sh
npm install        # only needed for the verify script (puppeteer)
npm run dev        # serve on http://localhost:4173
npm run verify     # headless Chrome: desktop + mobile checks + screenshots
```

## Performance & accessibility notes

- Hero renderer caps DPR (1.5 mobile / 2 desktop), pauses when offscreen via
  IntersectionObserver, and uses a single InstancedMesh draw call
- `prefers-reduced-motion` disables smooth scroll, the 3D scene, and all
  animation — content renders fully visible
- Custom cursor and magnetic effects only activate on fine pointers
- No-JS fallback: preloader is removed, content stays visible
