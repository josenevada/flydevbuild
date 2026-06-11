/* Headless-Chrome verification: console errors, screenshots at desktop &
   mobile viewports, scroll-through animation check, basic FPS sample. */
import puppeteer from "puppeteer";

const URL = "http://localhost:4173/";
const shots = process.argv.includes("--shots");

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--enable-gpu", "--use-gl=angle", "--use-angle=swiftshader"],
});

async function run(name, viewport, isMobile = false) {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

  await page.setViewport({ ...viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2600)); // preloader + hero intro

  const webgl = await page.evaluate(() => {
    const c = document.getElementById("heroCanvas");
    return !!(c && (c.getContext("webgl2") || c.width > 0));
  });
  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );

  if (shots) await page.screenshot({ path: `shots/${name}-hero.png` });

  // sample FPS while idling in the hero
  const fps = await page.evaluate(() => new Promise((res) => {
    let frames = 0;
    const start = performance.now();
    const tick = () => {
      frames++;
      if (performance.now() - start < 1000) requestAnimationFrame(tick);
      else res(frames);
    };
    requestAnimationFrame(tick);
  }));

  // scroll through the page, screenshot each section
  for (const [label, sel] of [["process", "#process"], ["stack", "#stack"], ["cta", "#contact"]]) {
    await page.evaluate((s) => {
      document.querySelector(s).scrollIntoView({ behavior: "instant", block: "start" });
      window.scrollBy(0, -40);
    }, sel);
    await new Promise((r) => setTimeout(r, 1600));
    if (shots) await page.screenshot({ path: `shots/${name}-${label}.png` });
  }

  // confirm reveals actually ran (no opacity-0 elements left in view)
  const hiddenRevealed = await page.evaluate(() =>
    [...document.querySelectorAll("[data-reveal]")].filter((el) => {
      const r = el.getBoundingClientRect();
      const inView = r.top < innerHeight && r.bottom > 0;
      return inView && parseFloat(getComputedStyle(el).opacity) < 0.9;
    }).length
  );

  console.log(`\n=== ${name} (${viewport.width}x${viewport.height}) ===`);
  console.log(`webgl canvas active : ${webgl}`);
  console.log(`horizontal overflow : ${overflowX}px`);
  console.log(`hero idle fps       : ~${fps}`);
  console.log(`unrevealed in view  : ${hiddenRevealed}`);
  console.log(`console issues      : ${errors.length ? "\n  " + errors.join("\n  ") : "none"}`);
  await page.close();
  return errors.length === 0 && overflowX === 0 && hiddenRevealed === 0;
}

import { mkdirSync } from "fs";
if (shots) mkdirSync("shots", { recursive: true });

const okDesktop = await run("desktop", { width: 1440, height: 900 });
const okMobile = await run("mobile", { width: 390, height: 844 }, true);

await browser.close();
console.log(`\nRESULT: ${okDesktop && okMobile ? "PASS" : "FAIL"}`);
process.exit(okDesktop && okMobile ? 0 : 1);
