const sharp = require("sharp");
const fs = require("fs");

// SVG do asterisco verde esmeralda com 8 pontas arredondadas e SEM FUNDO (transparente)
const transparentAsteriskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g stroke="#10b981" stroke-width="64" stroke-linecap="round" stroke-linejoin="round">
    <line x1="256" y1="56" x2="256" y2="456" />
    <line x1="56" y1="256" x2="456" y2="256" />
    <line x1="114" y1="114" x2="398" y2="398" />
    <line x1="398" y1="114" x2="114" y2="398" />
  </g>
</svg>`;

// SVG para Apple Touch Icon (iOS) e Android PWA - quadrado verde esmeralda com asterisco branco no centro
const appIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="115" ry="115" fill="#10b981" />
  <g stroke="#ffffff" stroke-width="50" stroke-linecap="round" stroke-linejoin="round">
    <line x1="256" y1="100" x2="256" y2="412" />
    <line x1="100" y1="256" x2="412" y2="256" />
    <line x1="145" y1="145" x2="367" y2="367" />
    <line x1="367" y1="145" x2="145" y2="367" />
  </g>
</svg>`;

// Maskable PWA para Android
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#10b981" />
  <g stroke="#ffffff" stroke-width="48" stroke-linecap="round" stroke-linejoin="round">
    <line x1="256" y1="130" x2="256" y2="382" />
    <line x1="130" y1="256" x2="382" y2="256" />
    <line x1="166" y1="166" x2="346" y2="346" />
    <line x1="346" y1="166" x2="166" y2="346" />
  </g>
</svg>`;

async function run() {
  fs.writeFileSync("public/icon.svg", transparentAsteriskSvg);

  const transparentBuf = Buffer.from(transparentAsteriskSvg);
  const appIconBuf = Buffer.from(appIconSvg);
  const maskableBuf = Buffer.from(maskableSvg);

  // 1. Favicons transparentes (asterisco verde vibrante exatamente sem fundo)
  await sharp(transparentBuf).resize(64, 64).png().toFile("public/favicon.png");
  await sharp(transparentBuf).resize(48, 48).png().toFile("public/favicon.ico");
  await sharp(transparentBuf).resize(32, 32).png().toFile("public/favicon-32x32.png");
  await sharp(transparentBuf).resize(16, 16).png().toFile("public/favicon-16x16.png");
  console.log("Favicons transparentes criados com sucesso.");

  // 2. iPhone / iPad (apple-touch-icon: quadrado verde com cantos arredondados e asterisco branco)
  await sharp(appIconBuf).resize(180, 180).png().toFile("public/apple-touch-icon.png");
  console.log("apple-touch-icon.png criado.");

  // 3. Android / PWA (pwa-192, pwa-512, maskable)
  await sharp(appIconBuf).resize(192, 192).png().toFile("public/pwa-192x192.png");
  await sharp(appIconBuf).resize(512, 512).png().toFile("public/pwa-512x512.png");
  await sharp(maskableBuf).resize(512, 512).png().toFile("public/pwa-maskable-512x512.png");
  console.log("Icones PWA / Android criados.");
}

run().catch(console.error);
