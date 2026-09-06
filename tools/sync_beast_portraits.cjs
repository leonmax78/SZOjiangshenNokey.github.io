const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const normalize = value => value.replace(/\([^)]*資訊月[^)]*\)/g, '').replace(/[\s\[\]（）()．・·‧._-]/g, '');

async function main() {
  const context = { window: {} };
  vm.runInNewContext(await fs.readFile(path.join(root, 'data/beasts.bundle.js'), 'utf8'), context);
  const beasts = context.window.SZO_BEASTS;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  const outputDir = path.join(root, 'assets/beast-portraits');
  await fs.mkdir(outputDir, { recursive: true });
  const records = [];
  try {
    for (const category of [...new Set(beasts.map(row => row.category))]) {
      const url = 'https://sites.google.com/view/szounofficial/封獸/寵物/' + category + '封甕';
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const entries = await page.locator('p').filter({ hasText: /寵物名稱\s*[:：]/ }).evaluateAll(elements => elements.map(element => {
        const section = element.closest('section');
        const names = [...section.querySelectorAll('p')].filter(p => /寵物名稱\s*[:：]/.test(p.textContent));
        const images = [...section.querySelectorAll('img')];
        const index = names.indexOf(element);
        const image = names.length === images.length ? images[index] : null;
        return { name: element.textContent.replace(/^.*?寵物名稱\s*[:：]/, '').trim(), images: image ? [image.src] : [] };
      }));
      for (const beast of beasts.filter(row => row.category === category)) {
        const key = normalize(beast.name === '化靈四聖太宰' ? '靈四聖太宰化' : beast.name);
        const matches = entries.filter(entry => normalize(entry.name) === key);
        if (matches.length !== 1 || matches[0].images.length !== 1) {
          records.push({ name: beast.name, id: beast.monsterId, status: 'unmatched' });
          continue;
        }
        const imageUrl = matches[0].images[0];
        const response = await page.request.get(imageUrl);
        if (!response.ok()) throw new Error(`${beast.name}: HTTP ${response.status()}`);
        const bytes = await response.body();
        const hex = bytes.subarray(0, 12).toString('hex');
        const extension = hex.startsWith('47494638') ? 'gif' : hex.startsWith('89504e47') ? 'png' : hex.startsWith('ffd8ff') ? 'jpg' : bytes.subarray(8,12).toString() === 'WEBP' ? 'webp' : '';
        if (!extension) throw new Error(`${beast.name}: unsupported image`);
        const filename = `beast-${beast.monsterId || 'pending-' + beasts.indexOf(beast)}.${extension}`;
        await fs.writeFile(path.join(outputDir, filename), bytes);
        beast.portrait = 'assets/beast-portraits/' + filename;
        records.push({ name: beast.name, id: beast.monsterId, sourcePage: url, imageUrl, path: beast.portrait, bytes: bytes.length, status: 'matched' });
      }
      console.log(category + ': ' + records.filter(row => row.status === 'matched').length + ' matched so far');
    }
    await fs.writeFile(path.join(root, 'data/beasts.bundle.js'), 'window.SZO_BEASTS=' + JSON.stringify(beasts) + ';\n');
    await fs.writeFile(path.join(root, 'reports/beast-portrait-sources.json'), JSON.stringify({ source: '巨門×神州', records }, null, 2) + '\n');
    console.log(JSON.stringify({ matched: records.filter(row => row.status === 'matched').length, unmatched: records.filter(row => row.status !== 'matched') }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
