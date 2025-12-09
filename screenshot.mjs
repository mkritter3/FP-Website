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

    // Simulate scrolling to mid position (8 events = scrollZ ~400, camera at z=400)
    await page.evaluate(() => {
        for (let i = 0; i < 8; i++) {
            window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
        }
    });
    await page.waitForTimeout(2000);

    // Screenshot 2: Medium shot (halfway to TV)
    await page.screenshot({ path: 'screenshot_medium.png' });
    console.log('Captured: Medium shot (camera z~400)');

    // Scroll more toward screen (6 more events = scrollZ ~700, camera at z=100)
    await page.evaluate(() => {
        for (let i = 0; i < 6; i++) {
            window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
        }
    });
    await page.waitForTimeout(2000);

    // Screenshot 3: Close-up (very close to TV, before transition)
    await page.screenshot({ path: 'screenshot_closeup.png' });
    console.log('Captured: Close-up shot (camera z~100)');

    await browser.close();
    console.log('\nScreenshots saved!');
}

captureScene().catch(console.error);
