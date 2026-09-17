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

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the pace text to appear (max 30s)
    await page.waitForFunction(
      () => document.body.innerText.includes('Average Pace'),
      { timeout: 30000 }
    );

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
