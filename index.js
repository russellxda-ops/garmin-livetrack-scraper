const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to parse JSON request bodies
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.status(200).send('Garmin LiveTrack Scraper is running.');
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Missing "url" in request body.' });
    }

    let browser;
    try {
        // Launch a headless browser with arguments recommended for serverless environments
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
            ],
        });

        const page = await browser.newPage();
        
        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate to the Garmin LiveTrack page
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for the data to be rendered on the page
        // We wait for a common element, like the footer or a specific text label.
        await page.waitForFunction(
            () => document.body.innerText.includes('Average Pace'),
            { timeout: 30000 }
        );

        // Extract the data by evaluating JavaScript in the page context
        const scrapedData = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            
            // Regex to find "Average Pace: 5:20 /km"
            const paceMatch = bodyText.match(/Average Pace[:\s]*([\d:]+)\s*\/km/i);
            // Regex to find "Started Sat @ 7:07 AM"
            const startMatch = bodyText.match(/Started\s+(\w{3})\s+@\s+(\d{1,2}:\d{2}\s*[AP]M)/i);

            return {
                averagePace: paceMatch ? paceMatch[1] : null,
                startedDay: startMatch ? startMatch[1] : null,
                startedTime: startMatch ? startMatch[2] : null,
            };
        });

        await browser.close();

        // Return the scraped data as JSON
        res.json(scrapedData);

    } catch (error) {
        console.error('Scraping failed:', error);
        if (browser) {
            await browser.close();
        }
        res.status(500).json({ error: 'Failed to scrape data.', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
