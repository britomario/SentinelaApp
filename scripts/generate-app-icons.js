#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const sourceArg = process.argv[2];

if (!sourceArg) {
  console.error('Usage: node scripts/generate-app-icons.js <path-to-icon.png>');
  process.exit(1);
}

const sourcePath = path.resolve(projectRoot, sourceArg);
if (!fs.existsSync(sourcePath)) {
  console.error(`Source icon not found: ${sourcePath}`);
  process.exit(1);
}

const androidTargets = [
  {dir: 'mipmap-mdpi', size: 48},
  {dir: 'mipmap-hdpi', size: 72},
  {dir: 'mipmap-xhdpi', size: 96},
  {dir: 'mipmap-xxhdpi', size: 144},
  {dir: 'mipmap-xxxhdpi', size: 192},
];

const iosTargets = [
  {size: 40, idiom: 'iphone', scale: '2x', base: '20x20'},
  {size: 60, idiom: 'iphone', scale: '3x', base: '20x20'},
  {size: 58, idiom: 'iphone', scale: '2x', base: '29x29'},
  {size: 87, idiom: 'iphone', scale: '3x', base: '29x29'},
  {size: 80, idiom: 'iphone', scale: '2x', base: '40x40'},
  {size: 120, idiom: 'iphone', scale: '3x', base: '40x40'},
  {size: 120, idiom: 'iphone', scale: '2x', base: '60x60'},
  {size: 180, idiom: 'iphone', scale: '3x', base: '60x60'},
  {size: 1024, idiom: 'ios-marketing', scale: '1x', base: '1024x1024'},
];

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, {recursive: true});
}

async function generateAndroidIcons() {
  for (const target of androidTargets) {
    const outDir = path.join(
      projectRoot,
      'android',
      'app',
      'src',
      'main',
      'res',
      target.dir,
    );
    await ensureDir(outDir);
    const launcherPath = path.join(outDir, 'ic_launcher.png');
    const roundPath = path.join(outDir, 'ic_launcher_round.png');
    await sharp(sourcePath)
      .resize(target.size, target.size)
      .png()
      .toFile(launcherPath);
    await sharp(sourcePath)
      .resize(target.size, target.size)
      .png()
      .toFile(roundPath);
  }
}

async function generateIosIcons() {
  const appIconDir = path.join(
    projectRoot,
    'ios',
    'SentinelaApp',
    'Images.xcassets',
    'AppIcon.appiconset',
  );
  await ensureDir(appIconDir);

  const images = [];
  for (const target of iosTargets) {
    const fileName = `icon-${target.size}.png`;
    await sharp(sourcePath)
      .resize(target.size, target.size)
      .png()
      .toFile(path.join(appIconDir, fileName));
    images.push({
      filename: fileName,
      idiom: target.idiom,
      scale: target.scale,
      size: target.base,
    });
  }

  const contentsJson = {
    images,
    info: {
      author: 'xcode',
      version: 1,
    },
  };
  await fs.promises.writeFile(
    path.join(appIconDir, 'Contents.json'),
    `${JSON.stringify(contentsJson, null, 2)}\n`,
    'utf8',
  );
}

async function main() {
  await generateAndroidIcons();
  await generateIosIcons();
  console.log('Icons generated for Android and iOS.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
