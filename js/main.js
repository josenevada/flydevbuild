/* ========================================================================
   flydevbuild — main.js
   GSAP + ScrollTrigger + Lenis orchestration, micro-interactions.
   ===================================================================== */

import { initScene } from "./scene.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

document.documentElement.classList.add("js");
gsap.registerPlugin(ScrollTrigger);

/* ---------- smooth scroll (Lenis driven by GSAP's ticker) ---------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.11, anchors: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------- helpers ---------- */
function splitWords(el) {
  const words = el.innerHTML.split(/<br\s*\/?>/i).map((line) =>
    line.trim().split(/\s+/).filter(Boolean)
  );
  el.innerHTML = "";
  el.setAttribute("aria-label", words.flat().join(" "));
  words.forEach((line, li) => {
    line.forEach((w) => {
      const wrap = document.createElement("span");
      wrap.className = "word";
      wrap.setAttribute("aria-hidden", "true");
      const inner = document.createElement("span");
      inner.className = "word-inner";
      inner.textContent = w;
      wrap.appendChild(inner);
      el.appendChild(wrap);
      el.appendChild(document.createTextNode(" "));
    });
    if (li < words.length - 1) el.appendChild(document.createElement("br"));
  });
  return el.querySelectorAll(".word-inner");
}

/* ---------- three.js hero scene ---------- */
const heroCanvas = document.getElementById("heroCanvas");
let scene3d = null;
if (!reduceMotion && heroCanvas && window.WebGLRenderingContext) {
  try {
    scene3d = initScene(heroCanvas);
  } catch (err) {
    console.warn("3D scene unavailable:", err);
    heroCanvas.style.display = "none";
  }
}

/* ---------- preloader + hero intro ---------- */
const preloader = document.getElementById("preloader");
const countEl = document.getElementById("preloaderCount");

function heroIntro() {
  const lines = gsap.utils.toArray(".hero-line-inner");
  if (reduceMotion) {
    gsap.set([...lines, "[data-hero-fade]"], { clearProps: "all", opacity: 1 });
    return;
  }
  scene3d?.kickAssembly();
  gsap.timeline({ defaults: { ease: "power4.out" } })
    .from(lines, { yPercent: 115, duration: 1.1, stagger: 0.09 })
    .to("[data-hero-fade]", { opacity: 1, y: 0, duration: 0.9, stagger: 0.12 }, "-=0.55")
    .add(runCounters(".hero [data-count]"), "-=0.6");
}

if (reduceMotion) {
  preloader.remove();
  heroIntro();
} else {
  gsap.set("[data-hero-fade]", { y: 26 });
  const counter = { v: 0 };
  gsap.timeline()
    .to(counter, {
      v: 100,
      duration: 1.1,
      ease: "power2.inOut",
      onUpdate: () => (countEl.textContent = String(Math.round(counter.v)).padStart(3, "0")),
    })
    .to(preloader, {
      yPercent: -100,
      duration: 0.7,
      ease: "power4.inOut",
      onComplete: () => preloader.remove(),
    }, "+=0.1")
    .add(heroIntro, "-=0.45");
}

/* ---------- nav state ---------- */
const nav = document.getElementById("nav");
ScrollTrigger.create({
  start: 0,
  end: "max",
  onUpdate: (self) => nav.classList.toggle("is-scrolled", self.scroll() > 40),
});

/* ---------- hero scroll: disassemble structure + parallax copy ---------- */
if (!reduceMotion) {
  ScrollTrigger.create({
    trigger: "#hero",
    start: "top top",
    end: "bottom top",
    scrub: true,
    onUpdate: (self) => {
      scene3d?.setScroll(self.progress);
      gsap.set(".hero-content", { y: self.progress * 110, opacity: 1 - self.progress * 0.9 });
    },
  });
}

/* ---------- split-word section titles ---------- */
document.querySelectorAll("[data-split]").forEach((el) => {
  const inners = splitWords(el);
  if (reduceMotion) return;
  gsap.from(inners, {
    yPercent: 110,
    duration: 0.9,
    ease: "power4.out",
    stagger: 0.06,
    scrollTrigger: { trigger: el, start: "top 85%" },
  });
});

/* ---------- generic reveals ---------- */
document.querySelectorAll("[data-reveal]").forEach((el) => {
  if (reduceMotion) { el.style.opacity = 1; return; }
  gsap.fromTo(el,
    { opacity: 0, y: 44 },
    {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    }
  );
});

/* ---------- counters ---------- */
function runCounters(selector) {
  const tl = gsap.timeline();
  document.querySelectorAll(selector).forEach((el) => {
    const target = +el.dataset.count;
    const obj = { v: 0 };
    tl.to(obj, {
      v: target,
      duration: 1.4,
      ease: "power2.out",
      onUpdate: () => (el.textContent = Math.round(obj.v)),
    }, 0);
  });
  return tl;
}
if (reduceMotion) {
  document.querySelectorAll("[data-count]").forEach((el) => (el.textContent = el.dataset.count));
} else {
  ScrollTrigger.create({
    trigger: ".speed-metrics",
    start: "top 85%",
    once: true,
    onEnter: () => runCounters(".speed-metrics [data-count]"),
  });
}

/* ---------- marquee: infinite loop, speed reacts to scroll velocity ---------- */
const marqueeTrack = document.getElementById("marqueeTrack");
if (marqueeTrack && !reduceMotion) {
  const proxy = { x: 0 };
  let boost = 0;
  gsap.ticker.add((_, delta) => {
    boost *= 0.94; // ease the scroll-velocity kick back down
    proxy.x -= (delta / 1000) * 4.2 * (1 + boost);
    if (proxy.x <= -50) proxy.x += 50;
    gsap.set(marqueeTrack, { xPercent: proxy.x });
  });
  ScrollTrigger.create({
    trigger: marqueeTrack,
    start: "top bottom",
    end: "bottom top",
    onUpdate: (self) => {
      boost = Math.min(8, Math.abs(self.getVelocity()) / 300);
    },
  });
}

/* ---------- bento: cursor-tracked glow ---------- */
if (finePointer) {
  document.querySelectorAll(".bento-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
}

/* ---------- terminal typing ---------- */
const terminal = document.getElementById("terminalBody");
if (terminal) {
  const LINES = [
    { text: "$ flydev new unicorn-mvp", cls: "" },
    { text: "⚡ scaffolding app … done in 3.2s", cls: "t-dim" },
    { text: "⚡ agents online: 4/4", cls: "t-dim" },
    { text: "$ flydev ship --prod", cls: "" },
    { text: "✓ live at unicorn.app — day 14", cls: "t-accent" },
  ];
  const type = () => {
    let li = 0, ci = 0;
    const cursor = document.createElement("span");
    cursor.className = "terminal-cursor";
    let lineEl = document.createElement("span");
    lineEl.className = LINES[0].cls;
    terminal.append(lineEl, cursor);
    const tick = () => {
      if (li >= LINES.length) return;
      const line = LINES[li];
      ci++;
      lineEl.textContent = line.text.slice(0, ci);
      if (ci >= line.text.length) {
        li++; ci = 0;
        if (li < LINES.length) {
          terminal.insertBefore(document.createTextNode("\n"), cursor);
          lineEl = document.createElement("span");
          lineEl.className = LINES[li].cls;
          terminal.insertBefore(lineEl, cursor);
          setTimeout(tick, line.text.startsWith("$") ? 420 : 160);
        }
        return;
      }
      setTimeout(tick, reduceMotion ? 0 : 26);
    };
    tick();
  };
  if (reduceMotion) {
    terminal.innerHTML = LINES.map((l) => `<span class="${l.cls}">${l.text}</span>`).join("\n");
  } else {
    ScrollTrigger.create({
      trigger: terminal,
      start: "top 80%",
      once: true,
      onEnter: type,
    });
  }
}

/* ---------- magnetic buttons ---------- */
if (finePointer && !reduceMotion) {
  document.querySelectorAll(".magnetic").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.32);
      yTo((e.clientY - r.top - r.height / 2) * 0.32);
    });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  });
}

/* ---------- custom cursor ---------- */
if (finePointer && !reduceMotion) {
  const dot = document.getElementById("cursorDot");
  const ring = document.getElementById("cursorRing");
  gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: -100, y: -100 });
  const dx = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power2.out" });
  const dy = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power2.out" });
  const rx = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3.out" });
  const ry = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3.out" });
  window.addEventListener("pointermove", (e) => {
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
  }, { passive: true });
  document.querySelectorAll("[data-cursor='hover'], .pill, input, textarea").forEach((el) => {
    el.addEventListener("pointerenter", () => gsap.to(ring, { scale: 1.8, duration: 0.3 }));
    el.addEventListener("pointerleave", () => gsap.to(ring, { scale: 1, duration: 0.3 }));
  });
}

/* ---------- budget pills ---------- */
const pills = document.querySelectorAll(".pill");
pills.forEach((pill) => {
  pill.addEventListener("click", () => {
    pills.forEach((p) => { p.classList.remove("is-active"); p.removeAttribute("aria-pressed"); });
    pill.classList.add("is-active");
    pill.setAttribute("aria-pressed", "true");
  });
});

/* ---------- intake form -> friction-free mailto draft ---------- */
const form = document.getElementById("ctaForm");
form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const fields = ["name", "email", "idea"].map((n) => form.elements.namedItem(n));
  const [name, email, idea] = fields.map((f) => f.value.trim());
  if (!name || !email || !idea) {
    fields.find((f) => !f.value.trim())?.focus();
    return;
  }
  const budget = document.querySelector(".pill.is-active")?.textContent ?? "TBD";
  const body = encodeURIComponent(
    `Hi flydevbuild,\n\nI'm ${name} (${email}).\n\nWhat we're building:\n${idea}\n\nBudget range: ${budget}\n\nLet's start the 14-day clock.`
  );
  window.location.href =
    `mailto:hello@flydevbuild.com?subject=${encodeURIComponent(`Build slot request — ${name}`)}&body=${body}`;
  const success = document.getElementById("formSuccess");
  success.hidden = false;
  if (!reduceMotion) gsap.from(success, { opacity: 0, y: 8, duration: 0.5 });
});
