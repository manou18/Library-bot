const axios = require('axios');
const cheerio = require('cheerio');

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'https://my-flaresolverr.onrender.com/v1';

async function search(searchQuery) {
    const targetUrl = `https://z-lib.is/s/${encodeURIComponent(searchQuery)}`;
    try {
        const response = await axios.post(FLARESOLVERR_URL, {
            cmd: 'request.get',
            url: targetUrl,
            maxTimeout: 9000 
        }, { headers: { 'Content-Type': 'application/json' } });

        const $ = cheerio.load(response.data.solution.response);
        const books = [];

        $('.resItemBox').each((index, element) => {
            const titleElem = $(element).find('h3 a');
            const title = titleElem.text().trim();
            const bookId = titleElem.attr('href') ? titleElem.attr('href').split('/').pop() : null;
            const author = $(element).find('.authors').text().trim();
            const propertyList = $(element).find('.property_value').text().toLowerCase();

            let extension = propertyList.includes('epub') ? 'epub' : 'pdf';
            const yearMatch = propertyList.match(/\b(19|20)\d{2}\b/);
            const year = yearMatch ? yearMatch[0] : 'Unknown';

            if (title && bookId) {
                books.push({ title, author: author || 'Unknown', year, extension, language: 'english', download_id: bookId, source: 'zlib' });
            }
        });
        return books.slice(0, 5);
    } catch (error) {
        console.error("Z-Library Error:", error.message);
        return [];
    }
}

async function getDirectDownloadLink(bookId) {
    return `https://z-lib.is/book/${bookId}`;
}

module.exports = { search, getDirectDownloadLink };
