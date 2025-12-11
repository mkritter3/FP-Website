const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    // Navigate to the local server
    await page.goto('http://localhost:8000/index.html');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Scroll down to trigger transition to spiral view
    for (let i = 0; i < 40; i++) {
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(50);
    }

    // Wait for transition animation
    await page.waitForTimeout(2000);

    // Screenshot 1: Initial spiral view
    await page.screenshot({ path: 'fog-1-initial.png', fullPage: false });
    console.log('Screenshot 1: fog-1-initial.png');

    // Scroll to see more beam
    for (let i = 0; i < 15; i++) {
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    // Screenshot 2: Mid-scroll
    await page.screenshot({ path: 'fog-2-mid.png', fullPage: false });
    console.log('Screenshot 2: fog-2-mid.png');

    // Scroll more to see light source
    for (let i = 0; i < 20; i++) {
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    // Screenshot 3: Further down
    await page.screenshot({ path: 'fog-3-far.png', fullPage: false });
    console.log('Screenshot 3: fog-3-far.png');

    await browser.close();
})();
