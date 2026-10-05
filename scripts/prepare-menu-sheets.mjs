// Cuts the product photo sheets (assets/menu-sheets/) into one clean photo per
// product in public/menu/. Re-run with `npm run menu:sheets` after replacing a
// sheet or changing an entry below.
//
// Each sheet is a grid of products on white with the name printed underneath.
// For every product we only give the vertical band it sits in (between the
// label above and its own label below) and which column it is in; the script
// finds the product's exact edges itself, so the label and the neighbouring
// product never end up in the photo.
//
// Every output is the same size: a square with the product centred and enough
// white around it that it also fits uncut in the 4:3 views (featured row and
// product sheet), which trim the top and bottom of the square.
//
// Which product uses which photo is set in src/data/menu-photos.ts.
import sharp from "sharp";

const OUT_SIZE = 640; // px, square
const FIT_WIDTH = 0.8; // product may fill at most 80% of the width…
const FIT_HEIGHT = 0.7; // …and 70% of the height (the 4:3 views show the middle 75%)
const INK = 40; // a pixel counts as "product" when it is this much darker than white
const MARGIN = 24; // px of the sheet kept around the product (soft shadows)

// rows: [top, bottom] in sheet pixels for each row of products, labels excluded.
// names: [left, right] product photo names per row (null = skip).
const SHEETS = [
  {
    file: "sheet-1-coffee.png",
    rows: [[0, 283], [318, 622], [660, 970], [1006, 1310]],
    names: [
      ["iced-spanish-latte", "caramel-macchiato"],
      ["mocha-latte", "sea-salt-latte"],
      ["biscoff-latte", "sea-salt-biscoff-latte"],
      ["iced-latte", "americano"],
    ],
  },
  {
    file: "sheet-2-matcha-fizzy.png",
    rows: [[0, 298], [335, 636], [675, 974], [1013, 1330]],
    names: [
      ["matcha-latte", "dirty-matcha"],
      ["strawberry-matcha", "strawberry-cream"],
      ["green-apple-fizzy", "lychee-fizzy"],
      ["strawberry-fizzy", "lemon-fizzy"],
    ],
  },
  {
    file: "sheet-3-snacks.png",
    rows: [[0, 438], [484, 896], [944, 1320]],
    names: [
      ["shawarma-wrap", "seasoned-fries"],
      ["truffle-fries", "nachos-overload"],
      ["chocolate-chip-cookie", "pork-enoki-stick"],
    ],
  },
  {
    file: "sheet-4-rice-meals.png",
    rows: [[0, 440], [480, 854], [895, 1290]],
    names: [
      ["breakfast-rice-meal", "bento-meal"],
      ["shawarma-rice-meal", "chicken-rice-meal"],
      ["kimchi-rice-meal", "spam-egg-rice-meal"],
    ],
  },
];

const FEATHER = 14; // px over which the kept area fades into the white canvas

// The sheet's background is a hair off-white, which would show as a faint box
// on the pure-white canvas. Push near-white to white, and fade the edges of the
// kept area (soft shadows) into white so there is no visible seam.
async function cleanPiece(src, area) {
  const { data, info } = await sharp(src).removeAlpha().extract(area).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      const fade = Math.min(1, edge / FEATHER); // 0 at the border → 1 inside
      const lightest = Math.min(data[i], data[i + 1], data[i + 2]);
      const whiten = lightest >= 250 ? 1 : lightest <= 238 ? 0 : (lightest - 238) / 12; // near-white → white
      const toWhite = 1 - fade * (1 - whiten);
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (255 - data[i + c]) * toWhite);
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

for (const sheet of SHEETS) {
  const src = `assets/menu-sheets/${sheet.file}`;
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const isInk = (x, y) => {
    const i = (y * W + x) * 3;
    return 255 - Math.min(data[i], data[i + 1], data[i + 2]) > INK;
  };

  for (const [rowIndex, [top, bottom]] of sheet.rows.entries()) {
    // The gap between the two products: the emptiest column near the middle.
    let gutter = Math.floor(W / 2);
    let fewest = Infinity;
    for (let x = Math.floor(W * 0.4); x < Math.floor(W * 0.6); x++) {
      let count = 0;
      for (let y = top; y <= bottom; y++) if (isInk(x, y)) count++;
      if (count < fewest) [fewest, gutter] = [count, x];
    }

    for (const [side, name] of sheet.names[rowIndex].entries()) {
      if (!name) continue;
      const [x0, x1] = side === 0 ? [0, gutter] : [gutter, W - 1];

      // Product edges inside its band and column.
      let left = x1, right = x0, upper = bottom, lower = top;
      for (let y = top; y <= bottom; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!isInk(x, y)) continue;
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < upper) upper = y;
          if (y > lower) lower = y;
        }
      }

      // Keep a little of the sheet around it (shadow), never crossing the band/gutter.
      const keep = {
        left: Math.max(x0, left - MARGIN),
        top: Math.max(top, upper - MARGIN),
      };
      keep.width = Math.min(x1, right + MARGIN) - keep.left + 1;
      keep.height = Math.min(bottom, lower + MARGIN) - keep.top + 1;

      // Square canvas: product centred, filling at most FIT_WIDTH × FIT_HEIGHT.
      const productW = right - left + 1;
      const productH = lower - upper + 1;
      const side_ = Math.ceil(Math.max(productW / FIT_WIDTH, productH / FIT_HEIGHT));
      const offsetX = Math.round(side_ / 2 - ((left + right) / 2 - keep.left));
      const offsetY = Math.round(side_ / 2 - ((upper + lower) / 2 - keep.top));

      const piece = await cleanPiece(src, keep);
      const info2 = await sharp({
        create: { width: side_, height: side_, channels: 3, background: { r: 255, g: 255, b: 255 } },
      })
        .composite([{ input: piece, left: offsetX, top: offsetY }])
        .png()
        .toBuffer()
        .then((square) =>
          sharp(square)
            .resize(OUT_SIZE, OUT_SIZE, { kernel: "lanczos3" })
            .sharpen({ sigma: 0.5 })
            .jpeg({ quality: 82, mozjpeg: true })
            .toFile(`public/menu/${name}.jpg`),
        );
      console.log(
        `menu/${name}.jpg ${info2.width}x${info2.height} ${Math.round(info2.size / 1024)}KB ` +
          `(product ${productW}x${productH} at ${left},${upper}; scale ${(OUT_SIZE / side_).toFixed(2)})`,
      );
    }
  }
}
