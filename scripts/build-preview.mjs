/* Build a fully self-contained preview HTML (fonts, CSS, JS inlined)
   that runs from file:// with no server. */
import { readFileSync, writeFileSync, statSync } from "fs";

let html = readFileSync("index.html", "utf8");
let css = readFileSync("css/style.css", "utf8");

css = css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) =>
  `url("data:font/woff2;base64,${readFileSync("fonts/" + f).toString("base64")}")`
);

// split/join avoids String.replace's special "$" handling in minified code
function swap(needle, replacement) {
  if (!html.includes(needle)) throw new Error("needle not found: " + needle);
  html = html.split(needle).join(replacement);
}
const inline = (p) => readFileSync(p, "utf8").replace(/<\/script/gi, "<\\/script");

html = html.replace(/\s*<link rel="preload"[^>]*\/>/g, "");
swap('<link rel="stylesheet" href="css/style.css" />', "<style>" + css + "</style>");
swap('<script src="vendor/gsap.min.js"></script>', "<script>" + inline("vendor/gsap.min.js") + "</script>");
swap('<script src="vendor/ScrollTrigger.min.js"></script>', "<script>" + inline("vendor/ScrollTrigger.min.js") + "</script>");
swap('<script src="vendor/lenis.min.js"></script>', "<script>" + inline("vendor/lenis.min.js") + "</script>");
swap('<script type="module" src="js/main.js"></script>', "<script>" + inline("/tmp/app.bundle.js") + "</script>");

writeFileSync("/tmp/flydevbuild-preview.html", html);
console.log("size:", (statSync("/tmp/flydevbuild-preview.html").size / 1048576).toFixed(2), "MB");
