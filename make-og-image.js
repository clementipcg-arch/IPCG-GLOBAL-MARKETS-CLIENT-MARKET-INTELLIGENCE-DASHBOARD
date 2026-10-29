// Renders public/og-image.png (1200x630) for WhatsApp / social link previews. Text-only, provisional branding.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:#13233f;color:#f4f1ea;font-family:Georgia,'Times New Roman',serif;display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box">
    <div style="display:inline-block;border:2px solid #b8975a;color:#e6d6b2;letter-spacing:.18em;font-size:30px;padding:8px 14px 6px 18px;width:max-content">IPCG</div>
    <div style="font-size:84px;margin-top:36px;line-height:1.05">IPCG Global Markets</div>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:30px;color:#c8cfdc;margin-top:22px;letter-spacing:.06em;text-transform:uppercase">Daily Market Intelligence</div>
    <div style="height:2px;background:#b8975a;width:120px;margin-top:40px"></div>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:26px;color:#c8cfdc;margin-top:28px">Global equities · Treasuries &amp; fixed income · Commodities &amp; FX · Calendar</div>
  </body></html>`);
  await p.screenshot({ path: path.join(__dirname, '../public/og-image.png') });
  await b.close();
  console.log('og-image.png written');
})();
