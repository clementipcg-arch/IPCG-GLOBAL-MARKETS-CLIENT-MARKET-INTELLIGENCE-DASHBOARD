// Visual QA: renders the review copy at phone and desktop widths and exercises the controls.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const file = 'file://' + path.resolve(__dirname, '../dist/preview-standalone.html');
  for (const [w, h, tag] of [[390, 844, 'phone'], [1280, 900, 'desktop']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
    p.on('console', (m) => m.type() === 'error' && !/fonts/.test(m.text()) && errors.push(`${tag} console: ${m.text()}`));
    for (const v of ['overview', 'equities', 'rates', 'markets', 'news', 'calendar']) {
      await p.goto(file + '#' + v); await p.waitForTimeout(250);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) errors.push(`${tag} ${v}: horizontal overflow`);
      await p.screenshot({ path: `dist/shots/${tag}-${v}.png`, fullPage: true });
    }
    // interactions
    await p.goto(file + '#rates'); await p.waitForTimeout(200);
    await p.click('[data-act="compare"][data-v="month"]'); await p.click('[data-act="tip"][data-i="6"]');
    await p.screenshot({ path: `dist/shots/${tag}-rates-interact.png` });
    await p.goto(file + '#overview'); await p.waitForTimeout(200);
    await p.click('[data-act="toggle"]'); await p.click('[data-act="period"][data-v="week"]');
    await p.click('[data-act="share"]'); await p.waitForTimeout(100);
    await p.screenshot({ path: `dist/shots/${tag}-share.png` });
    await p.click('[data-act="close-sheet"]');
    await p.click('[data-act="lang"]'); await p.waitForTimeout(100);
    await p.screenshot({ path: `dist/shots/${tag}-zh.png` });
    await p.click('[data-act="lang"]');
    await p.click('[data-act="demo-on"]'); await p.waitForTimeout(100);
    await p.goto(file + '#equities'); await p.waitForTimeout(100);
    await p.click('[data-act="demo-on"]').catch(() => {});
    await p.waitForTimeout(150);
    await p.screenshot({ path: `dist/shots/${tag}-demo-equities.png`, fullPage: true });
    await p.close();
  }
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'no errors, no overflow');
})();
