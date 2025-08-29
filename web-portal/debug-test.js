const { chromium } = require('playwright');

async function debugFrontend() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  const page = await browser.newPage();
  
  // Listen for console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3003/login', { waitUntil: 'networkidle' });
    
    console.log('Page title:', await page.title());
    console.log('Current URL:', page.url());
    
    // Get all visible text
    const bodyText = await page.textContent('body');
    console.log('Body text:', bodyText?.substring(0, 500));
    
    // Find all input elements
    const inputs = await page.locator('input').all();
    console.log('Found', inputs.length, 'input elements');
    
    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].getAttribute('type');
      const name = await inputs[i].getAttribute('name');
      const placeholder = await inputs[i].getAttribute('placeholder');
      console.log(`Input ${i}: type=${type}, name=${name}, placeholder=${placeholder}`);
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'frontend-debug.png' });
    console.log('Screenshot saved as frontend-debug.png');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugFrontend();