// Turns the black-on-white logo JPG into brand assets:
//   public/brand/frontyard-logo.png  transparent wordmark (used as a CSS mask so it can be any colour)
//   public/brand/icon-192.png / icon-512.png  home-screen icons
//   src/app/apple-icon.png                    iOS home-screen icon
//
// Re-run with `npm run brand:logo` whenever a new logo source is dropped in assets/brand/.
import sharp from "sharp";

const SOURCE = "assets/brand/frontyard-logo-source.jpg";
const CREAM = { r: 0xf6, g: 0xee, b: 0xe1 };
const ESPRESSO = { r: 0x2a, g: 0x1b, b: 0x12 };

// Ink coverage from luminance, with JPEG noise near pure white/black clamped away.
function luminanceToAlpha(l) {
  const WHITE = 235;
  const BLACK = 40;
  if (l >= WHITE) return 0;
  if (l <= BLACK) return 255;
  return Math.round(((WHITE - l) / (WHITE - BLACK)) * 255);
}

async function wordmark() {
  const trimmed = await sharp(SOURCE)
    .greyscale()
    .trim({ background: "#ffffff", threshold: 30 })
    .extend({ top: 12, bottom: 12, left: 12, right: 12, background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = trimmed.info;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4 + 3] = luminanceToAlpha(trimmed.data[i]);
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } }).png();
}

async function tintedWordmark(color, maxWidth) {
  const mark = await (await wordmark()).toBuffer();
  const { data, info } = await sharp(mark)
    .resize({ width: maxWidth })
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function squareIcon(size, out) {
  const logo = await tintedWordmark(ESPRESSO, Math.round(size * 0.78));
  await sharp({ create: { width: size, height: size, channels: 4, background: { ...CREAM, alpha: 1 } } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
}

const mark = await wordmark();
const info = await mark.toFile("public/brand/frontyard-logo.png");
console.log(`wordmark ${info.width}x${info.height}`);

await squareIcon(192, "public/brand/icon-192.png");
await squareIcon(512, "public/brand/icon-512.png");
await squareIcon(180, "src/app/apple-icon.png");
console.log("icons written");
