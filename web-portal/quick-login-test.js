const { chromium } = require('playwright');

async function testDemoLogin() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Testing demo login flow...');
    
    // Navigate to the app
    await page.goto('http://localhost:3003');
    await page.waitForURL(/.*login.*/);
    console.log('✅ Redirected to login page');
    
    // Click the demo login button
    await page.click('text=Try Demo Account');
    console.log('✅ Clicked demo login button');
    
    // Wait for redirect to dashboard or success
    try {
      await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });
      console.log('✅ Successfully logged in and redirected to dashboard');
    } catch (error) {
      console.log('⚠️ Login may have failed or redirected elsewhere');
      console.log('Current URL:', page.url());
    }
    
    // Check current page content
    const pageTitle = await page.title();
    const url = page.url();
    console.log('Final URL:', url);
    console.log('Page title:', pageTitle);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testDemoLogin();