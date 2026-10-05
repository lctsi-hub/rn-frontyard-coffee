// Crops the shop's real photos (assets/photos/) into web-sized images in public/menu/,
// for the few items without a studio photo (those come from the photo sheets:
// scripts/prepare-menu-sheets.mjs),
// and prepares the GCash QR (assets/payments/) for public/payments/.
// Re-run with `npm run menu:photos` after adding or changing an entry below.
//
// Each crop is { left, top, width, height } in pixels of the source photo.
// Product photos are square so they fill the menu cards; the product sheet
// shows them slightly wider, so keep the drink or dish in the middle.
//
// Which product uses which photo is set in src/data/menu-photos.ts.
import sharp from "sharp";

const PHOTOS = [
  // ---- drinks --------------------------------------------------------------
  { out: "strawberry-milk", src: "strawberry-drink.jpg", crop: { left: 0, top: 524, width: 1450, height: 1450 } },

  // ---- food ----------------------------------------------------------------
  { out: "cheese-sandwich", src: "cheese-overload-sandwiches.jpg", crop: { left: 10, top: 130, width: 700, height: 700 } },
  { out: "cheese-sticks", src: "cheese-sticks.jpg", crop: { left: 68, top: 420, width: 1400, height: 1400 } },
  { out: "pork-enoki-bento", src: "pork-enoki-bentos-and-skewers.jpg", crop: { left: 230, top: 440, width: 485, height: 485 } },

  // ---- menu banner ---------------------------------------------------------
  { out: "banner-drinks", src: "drinks-and-fries.jpg", crop: { left: 0, top: 100, width: 1536, height: 864 } },
];

for (const photo of PHOTOS) {
  const info = await sharp(`assets/photos/${photo.src}`)
    .rotate()
    .extract(photo.crop)
    .resize({ width: 1000, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(`public/menu/${photo.out}.jpg`);
  console.log(`menu/${photo.out}.jpg ${info.width}x${info.height} ${Math.round(info.size / 1024)}KB`);
}

// GCash / InstaPay QR: enlarge with hard pixel edges so the squares stay crisp.
const qr = sharp("assets/payments/gcash-instapay-qr.png");
const { width: qrWidth } = await qr.metadata();
const qrInfo = await qr
  .resize({ width: qrWidth * 4, kernel: "nearest" })
  .png()
  .toFile("public/payments/gcash-qr.png");
console.log(`payments/gcash-qr.png ${qrInfo.width}x${qrInfo.height}`);
