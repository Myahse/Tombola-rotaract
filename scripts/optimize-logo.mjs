import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const src = path.resolve("frontend/src/assets/logo.png");
const MAX_WIDTH = 960;

const meta = await sharp(src).metadata();
console.log("source", {
  width: meta.width,
  height: meta.height,
  format: meta.format,
  size: fs.statSync(src).size,
  hasAlpha: meta.hasAlpha,
});

const resized = sharp(src).resize({
  width: MAX_WIDTH,
  withoutEnlargement: true,
});

const png = await resized
  .clone()
  .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
  .toBuffer();

const webp = await resized
  .clone()
  .webp({ quality: 82, effort: 6 })
  .toBuffer();

const webpLossless = await resized
  .clone()
  .webp({ lossless: true, effort: 6 })
  .toBuffer();

const pickedWebp = webp.length <= webpLossless.length ? webp : webpLossless;
const webpKind = webp.length <= webpLossless.length ? "lossy" : "lossless";

console.log("png", png.length);
console.log("webp lossy", webp.length);
console.log("webp lossless", webpLossless.length);
console.log("using webp", webpKind, pickedWebp.length);

const outputs = [
  "frontend/public/logo.png",
  "frontend/public/logo.webp",
  "frontend/src/assets/logo.png",
  "frontend/src/assets/logo.webp",
  "organizer/public/logo.png",
  "organizer/public/logo.webp",
  "organizer/src/assets/logo.png",
  "organizer/src/assets/logo.webp",
];

for (const rel of outputs) {
  const dest = path.resolve(rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, rel.endsWith(".webp") ? pickedWebp : png);
  console.log("wrote", rel, fs.statSync(dest).size);
}
