// Renders "print on the wall" room mockups for a product photo.
// Usage (repo root, local server on :8765 serving the repo):
//   node tools/mockups.js images/NAME.jpg HANDLE
// Writes images/mockups/HANDLE-living.jpg and HANDLE-office.jpg (2400x1600) + images/mockups/sm/ (1200x800).
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const [, , src, handle] = process.argv;
if (!src || !handle) { console.error("usage: node tools/mockups.js images/NAME.jpg HANDLE"); process.exit(1); }
const root = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(root, "images/mockups/sm"), { recursive: true });

const plant = `<svg class="plant" viewBox="0 0 200 420"><g fill="#55684f">
  <path d="M100 250 C60 200 20 190 5 120 C60 140 85 180 100 250Z"/><path d="M100 250 C140 190 185 175 195 105 C140 130 115 175 100 250Z" fill="#647a5c"/>
  <path d="M100 250 C80 170 70 110 95 20 C120 100 118 170 100 250Z" fill="#4c5f47"/><path d="M100 250 C55 230 25 245 0 210 C45 200 80 215 100 250Z" fill="#6b8162"/>
  <path d="M100 250 C150 225 180 240 200 200 C155 195 120 215 100 250Z" fill="#5a6e53"/></g>
  <path d="M55 250 H145 L135 410 Q100 420 65 410Z" fill="#d9d2c6"/><path d="M55 250 H145 L143 270 H57Z" fill="#cbc3b5"/></svg>`;

const scenes = {
  living: (ar) => `
  <div class="wall" style="background: radial-gradient(120% 90% at 25% 0%, #f3efe8 0%, #e7e1d7 55%, #ddd6ca 100%)"></div>
  <div class="floor" style="top:78%; background: repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0 2px, transparent 2px 210px), linear-gradient(#b8936a, #9c7752)"></div>
  <div class="base" style="top:77%"></div>
  ${art(ar, { cx: 50, bottom: 40.5, maxW: 44, maxH: 33 })}
  <div class="sofa">
    <div class="s-shadow"></div>
    <div class="s-back"></div><div class="s-c1"></div><div class="s-c2"></div><div class="s-c3"></div>
    <div class="s-seat"></div><div class="s-armL"></div><div class="s-armR"></div>
    <div class="s-leg" style="left:6%"></div><div class="s-leg" style="right:6%"></div>
  </div>
  <div class="side"><div class="side-top"></div><div class="side-leg"></div><div class="side-foot"></div></div>
  <div class="lampbase"></div><div class="lampshade"></div>
  <div style="position:absolute;left:4%;bottom:12%;width:12%;">${plant}</div>`,
  office: (ar) => `
  <div class="wall" style="background: radial-gradient(120% 90% at 70% 0%, #f1f1ee 0%, #e3e4e0 55%, #d7d8d3 100%)"></div>
  <div class="floor" style="top:80%; background: linear-gradient(#8f8a83, #77726b)"></div>
  <div class="base" style="top:79%"></div>
  ${art(ar, { cx: 48, bottom: 57, maxW: 42, maxH: 35 })}
  <div class="desk"><div class="d-shadow"></div><div class="d-top"></div><div class="d-legL"></div><div class="d-legR"></div><div class="d-drawer"></div></div>
  <div class="monitor"><div class="m-screen"></div><div class="m-neck"></div><div class="m-foot"></div></div>
  <div class="books"><i style="height:62px;background:#8c6d55"></i><i style="height:74px;background:#3f4a55"></i><i style="height:56px;background:#c9b79c"></i><i style="height:68px;background:#6e7a68"></i></div>
  <div class="mug"></div>
  <div class="chair"><div class="c-back"></div><div class="c-seat"></div><div class="c-post"></div><div class="c-base"></div></div>
  <div style="position:absolute;right:3%;bottom:13%;width:11%;">${plant}</div>`,
};

// The print: sized from the photo's shape, hung with its bottom edge at `bottom`% from the floor of the scene.
function art(ar, { cx, bottom, maxW, maxH }) {
  // scene is 3:2, so 1% of width = 2/3 % of height
  let w = maxW, h = (w / ar) * 1.5;
  if (h > maxH) { h = maxH; w = (h * ar) / 1.5; }
  return `<div class="art" style="left:${cx - w / 2}%; width:${w}%; height:${h}%; bottom:${bottom}%"><div class="photo"></div></div>`;
}

const css = `
  *{margin:0;box-sizing:border-box} body{width:2400px;height:1600px;overflow:hidden}
  .scene{position:relative;width:2400px;height:1600px;overflow:hidden}
  .wall,.floor{position:absolute;left:0;right:0} .wall{top:0;bottom:0} .floor{bottom:0}
  .base{position:absolute;left:0;right:0;height:22px;background:#f4f1ec;box-shadow:0 3px 6px rgba(0,0,0,.08)}
  .art{position:absolute;box-shadow:0 2px 3px rgba(0,0,0,.25), 0 22px 40px -10px rgba(0,0,0,.35), 14px 30px 60px -20px rgba(0,0,0,.25)}
  .art .photo{position:absolute;inset:0;background:url(SRC) center/cover no-repeat}
  .art::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.08),transparent 40%,rgba(0,0,0,.06))}
  /* sofa */
  .sofa{position:absolute;left:24%;width:52%;bottom:15%;height:22%}
  .sofa>div{position:absolute;border-radius:28px}
  .s-shadow{left:2%;right:2%;bottom:-6%;height:20%;background:rgba(0,0,0,.25);filter:blur(28px);border-radius:50%!important}
  .s-back{left:4%;right:4%;top:0;height:62%;background:linear-gradient(#9aa094,#8a9085)}
  .s-c1,.s-c2,.s-c3{top:10%;height:48%;width:29%;background:linear-gradient(#a7ad9f,#959b8e);box-shadow:inset 0 -6px 12px rgba(0,0,0,.08)}
  .s-c1{left:6%}.s-c2{left:35.5%}.s-c3{left:65%}
  .s-seat{left:3%;right:3%;top:52%;height:30%;background:linear-gradient(#9da396,#878d81);box-shadow:inset 0 8px 14px rgba(255,255,255,.12)}
  .s-armL,.s-armR{top:30%;width:9%;height:52%;background:linear-gradient(90deg,#8d9388,#9ca295)}
  .s-armL{left:0}.s-armR{right:0;background:linear-gradient(270deg,#8d9388,#9ca295)}
  .s-leg{bottom:0;width:2.4%;height:18%;background:#5a4636;border-radius:3px!important}
  .side{position:absolute;left:79%;width:9%;bottom:15%;height:17%}
  .side-top{position:absolute;top:0;left:0;right:0;height:9%;background:#7b5b40;border-radius:6px;box-shadow:0 6px 10px rgba(0,0,0,.15)}
  .side-leg{position:absolute;left:47%;width:6%;top:9%;bottom:6%;background:#6b4f38}
  .side-foot{position:absolute;left:25%;right:25%;bottom:0;height:6%;background:#6b4f38;border-radius:4px}
  .lampbase{position:absolute;left:82.3%;width:2.4%;bottom:32%;height:9%;background:linear-gradient(90deg,#c9c2b6,#e3ddd2);border-radius:40% 40% 10% 10%}
  .lampshade{position:absolute;left:80.5%;width:6%;bottom:40.5%;height:8%;background:linear-gradient(90deg,#efe7d8,#fbf6ec);clip-path:polygon(18% 0,82% 0,100% 100%,0 100%);filter:drop-shadow(0 0 30px rgba(255,236,200,.8))}
  .plant{width:100%;display:block;filter:drop-shadow(0 18px 22px rgba(0,0,0,.18))}
  /* office */
  .desk{position:absolute;left:20%;width:56%;bottom:13%;height:25%}
  .desk>div{position:absolute}
  .d-shadow{left:3%;right:3%;bottom:-4%;height:14%;background:rgba(0,0,0,.25);filter:blur(24px);border-radius:50%}
  .d-top{left:0;right:0;top:0;height:7%;background:linear-gradient(#b48c63,#9d774f);border-radius:4px;box-shadow:0 8px 14px rgba(0,0,0,.18)}
  .d-legL,.d-legR{top:7%;bottom:0;width:2%;background:#2f2f2f}.d-legL{left:4%}.d-legR{right:4%}
  .d-drawer{right:6%;top:7%;width:22%;height:34%;background:#ece9e3;border-radius:0 0 4px 4px;box-shadow:0 6px 10px rgba(0,0,0,.12)}
  .monitor{position:absolute;left:27%;width:15%;bottom:38.5%;height:15%}
  .m-screen{position:absolute;left:0;right:0;top:0;height:80%;background:linear-gradient(135deg,#2b2f36,#16181c);border-radius:8px;border:6px solid #1d1f23}
  .m-neck{position:absolute;left:46%;width:8%;top:80%;height:14%;background:#c9c9c9}
  .m-foot{position:absolute;left:34%;width:32%;bottom:0;height:6%;background:#bdbdbd;border-radius:4px}
  .books{position:absolute;left:58%;bottom:38.5%;display:flex;gap:4px;align-items:flex-end}
  .books i{display:block;width:22px;border-radius:2px}
  .mug{position:absolute;left:66%;bottom:38.5%;width:36px;height:44px;background:#f4f2ee;border-radius:4px 4px 8px 8px;box-shadow:inset -6px 0 8px rgba(0,0,0,.08)}
  .chair{position:absolute;left:38%;width:14%;bottom:6%;height:30%}
  .chair>div{position:absolute;background:#2d2d2f}
  .c-back{left:12%;right:12%;top:0;height:46%;border-radius:22px;background:linear-gradient(#3a3a3d,#2a2a2c)}
  .c-seat{left:4%;right:4%;top:50%;height:13%;border-radius:16px;background:linear-gradient(#3a3a3d,#262628)}
  .c-post{left:46%;width:8%;top:63%;height:24%}
  .c-base{left:10%;right:10%;bottom:0;height:5%;border-radius:8px}
`;

(async () => {
  const { imageSize } = await (async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto(`http://localhost:8765/${src}`);
    const s = await p.evaluate(() => { const i = document.querySelector("img"); return { w: i.naturalWidth, h: i.naturalHeight }; });
    await b.close(); return { imageSize: s };
  })();
  const ar = imageSize.w / imageSize.h;
  const browser = await chromium.launch();
  for (const [name, scene] of Object.entries(scenes)) {
    const page = await browser.newPage({ viewport: { width: 2400, height: 1600 } });
    await page.setContent(`<style>${css.replace("SRC", `http://localhost:8765/${src}`)}</style><div class="scene">${scene(ar)}</div>`);
    await page.waitForLoadState("networkidle");
    const out = path.join(root, `images/mockups/${handle}-${name}.jpg`);
    await page.screenshot({ path: out, type: "jpeg", quality: 88 });
    require("child_process").execFileSync("python3", ["-c",
      "import sys;from PIL import Image;im=Image.open(sys.argv[1]);im.resize((1200,800),Image.LANCZOS).save(sys.argv[2],'JPEG',quality=85,progressive=True)",
      out, path.join(root, `images/mockups/sm/${handle}-${name}.jpg`)]);
    await page.close();
    console.log("wrote", out);
  }
  await browser.close();
})();
