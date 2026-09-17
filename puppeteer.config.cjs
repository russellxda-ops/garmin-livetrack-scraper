const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to match the build and env var.
  cacheDirectory: join(__dirname, '.puppeteer-cache'),
};
