const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

// Health check endpoint
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
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
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

    // Load the LiveTrack page
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for either the triplet or an 'Average Pace' label to appear
    await page.waitForFunction(
      () => {
        const t = document.body.innerText;
        return t.includes(' /mi') || t.includes(' /km') || t.includes('Average Pace');
      },
      { timeout: 30000 }
    );

    // Extra buffer for JS-rendered values to settle
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const scrapedData = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // --- PACE ---
      let averagePace = null;
      let paceUnit = null;

      // Attempt 1: labelled "Average Pace"
      const paceMatch = bodyText.match(/Average Pace[:\s]*([\d:]+)\s*\/\s*(mi|km)/i);
      if (paceMatch) {
        averagePace = paceMatch[1];
        paceUnit = paceMatch[2];
      } else {
        // Attempt 2: unlabelled triplet (distance / duration / pace)
        const tripletMatch = bodyText.match(
          /\d+(?:\.\d+)?\s*(?:mi|km)\s*\n\s*\d+:\d{2}:\d{2}\s*\n\s*(\d+:\d{2})\s*\/\s*(mi|km)/i
        );
        if (tripletMatch) {
          averagePace = tripletMatch[1];
          paceUnit = tripletMatch[2];
        }
      }

      // --- START TIME ---
      // Handles both "Started Sat @ 7:07 AM" and "Started @ 12:11 PM"
      const startMatch = bodyText.match(
        /Started\s+(?:(\w{3})\s+)?@\s+(\d{1,2}:\d{2}\s*[AP]M)/i
      );

      // --- STATUS FLAGS ---
      const isEnded =
        bodyText.includes('Session Complete') || bodyText.includes('has ended');

      return {
        averagePace: averagePace,
        paceUnit: paceUnit,
        startedDay: startMatch ? startMatch[1] : null,
        startedTime: startMatch ? startMatch[2] : null,
        isEnded: isEnded,
      };
    });

    // DIAGNOSTIC: Log the first 300 characters of the page text to Render's logs
    const rawText = await page.evaluate(() => document.body.innerText.substring(0, 300));
    console.log("=== RAW PAGE TEXT (first 300 chars) ===");
    console.log(rawText);
    console.log("=== END RAW PAGE TEXT ===");

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
