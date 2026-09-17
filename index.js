const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

// Health check endpoint (Koyeb pings this to know the service is alive)
app.get('/', (req, res) => {
  res.status(200).send('Garmin LiveTrack Scraper is running.');
});

app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes('livetrack.garmin.com')) {
    return res.status(400).json({ error: 'Missing or invalid LiveTrack URL.' });
  }

  let browser;
  try {
browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 
                  '/opt/render/project/src/.puppeteer-cache/chrome/linux-127.0.6533.88/chrome-linux64/chrome',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--single-process',
    '--no-zygote',
    '--disable-gpu',
  ],
});

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // DIAGNOSTIC: Log what the page actually contains
await new Promise(resolve => setTimeout(resolve, 10000)); // wait 10s for JS to render

const pageContent = await page.evaluate(() => {
  return {
    title: document.title,
    url: window.location.href,
    bodyTextSample: document.body.innerText.substring(0, 2000),
    hasAveragePace: document.body.innerText.includes('Average Pace'),
    hasStarted: document.body.innerText.includes('Started'),
    hasEnded: document.body.innerText.toLowerCase().includes('ended'),
    hasExpired: document.body.innerText.toLowerCase().includes('expired'),
  };
});

console.log("=== PAGE DIAGNOSTIC ===");
console.log(JSON.stringify(pageContent, null, 2));
console.log("=== END DIAGNOSTIC ===");

// Return the diagnostic instead of trying to scrape
return res.json(pageContent);

    const scrapedData = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const paceMatch = bodyText.match(/Average Pace[:\s]*([\d:]+)\s*\/km/i);
      const startMatch = bodyText.match(/Started\s+(\w{3})\s+@\s+(\d{1,2}:\d{2}\s*[AP]M)/i);

      return {
        averagePace: paceMatch ? paceMatch[1] : null,
        startedDay: startMatch ? startMatch[1] : null,
        startedTime: startMatch ? startMatch[2] : null,
      };
    });

    await browser.close();

    res.json(scrapedData);
  } catch (error) {
    console.error('Scraping failed:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Failed to scrape data.', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
