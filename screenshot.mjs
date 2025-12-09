import { chromium } from 'playwright';

async function captureScene() {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:8765/index.html');

    // Wait for Three.js to initialize and render
    await page.waitForTimeout(3000);

    // Screenshot 1: Wide shot (initial view)
    await page.screenshot({ path: 'screenshot_wide.png' });
    console.log('Captured: Wide shot (scroll 0%)');

    // Simulate scrolling to mid position
    await page.evaluate(() => {
        for (let i = 0; i < 50; i++) {
            window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
        }
    });
    await page.waitForTimeout(2000);

    // Screenshot 2: Medium shot
    await page.screenshot({ path: 'screenshot_medium.png' });
    console.log('Captured: Medium shot (scroll ~50%)');

    // Scroll more toward screen
    await page.evaluate(() => {
        for (let i = 0; i < 80; i++) {
            window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
        }
    });
    await page.waitForTimeout(2000);

    // Screenshot 3: Close-up
    await page.screenshot({ path: 'screenshot_closeup.png' });
    console.log('Captured: Close-up shot (scroll ~100%)');

    await browser.close();
    console.log('\nScreenshots saved!');
}

captureScene().catch(console.error);
