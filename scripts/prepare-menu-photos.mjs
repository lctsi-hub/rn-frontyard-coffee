// Crops the shop's photos (assets/photos/) into web-sized images in public/menu/,
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
  { out: "latte-iced", src: "iced-latte-bar.jpg", crop: { left: 232, top: 826, width: 1000, height: 1000 } },
  { out: "latte-pair", src: "bar-night-drinks.jpg", crop: { left: 480, top: 1330, width: 560, height: 560 } },
  { out: "coffee-dark", src: "matcha-and-coffee-tray.jpg", crop: { left: 340, top: 525, width: 380, height: 380 } },
  { out: "caramel-macchiato", src: "strawberry-matcha-and-caramel.jpg", crop: { left: 605, top: 1035, width: 900, height: 900 } },
  { out: "biscoff", src: "drinks-and-fries.jpg", crop: { left: 820, top: 480, width: 560, height: 560 } },
  { out: "strawberry-milk", src: "strawberry-drink.jpg", crop: { left: 0, top: 524, width: 1450, height: 1450 } },
  { out: "strawberry-latte", src: "strawberry-and-coffee.jpg", crop: { left: 50, top: 300, width: 620, height: 620 } },
  { out: "strawberry-matcha", src: "strawberry-matcha-and-caramel.jpg", crop: { left: 95, top: 1060, width: 800, height: 800 } },
  { out: "matcha", src: "matcha-and-coffee-tray.jpg", crop: { left: 0, top: 525, width: 380, height: 380 } },
  { out: "fizz-green", src: "fruit-fizz-daytime.jpg", crop: { left: 30, top: 1200, width: 760, height: 760 } },
  { out: "fizz-clear", src: "fruit-fizz-daytime.jpg", crop: { left: 790, top: 1100, width: 740, height: 740 } },
  { out: "fizz-red", src: "bar-night-drinks.jpg", crop: { left: 976, top: 1440, width: 560, height: 560 } },

  // ---- food ----------------------------------------------------------------
  { out: "shawarma", src: "shawarma-wraps.jpg", crop: { left: 70, top: 180, width: 640, height: 640 } },
  { out: "cheese-sandwich", src: "cheese-overload-sandwiches.jpg", crop: { left: 10, top: 130, width: 700, height: 700 } },
  { out: "cheese-sticks", src: "cheese-sticks.jpg", crop: { left: 68, top: 420, width: 1400, height: 1400 } },
  { out: "spam-egg", src: "spam-egg-plate.jpg", crop: { left: 80, top: 330, width: 600, height: 600 } },
  { out: "pork-enoki-bento", src: "pork-enoki-bentos-and-skewers.jpg", crop: { left: 230, top: 440, width: 485, height: 485 } },
  { out: "rice-plate", src: "rice-plate-and-cheese-fries.jpg", crop: { left: 40, top: 0, width: 540, height: 540 } },
  { out: "bento-pork-samgy", src: "bento-pork-samgy.jpg", crop: { left: 0, top: 448, width: 1536, height: 1152 } },
  { out: "pork-enoki-stick", src: "nachos-and-enoki.jpg", crop: { left: 269, top: 1103, width: 1100, height: 825 } },
  { out: "beef-nachos-overload", src: "nachos-and-fries.jpg", crop: { left: 0, top: 547, width: 1000, height: 750 } },
  { out: "french-fries", src: "drinks-and-fries.jpg", crop: { left: 0, top: 1147, width: 900, height: 675 } },

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
