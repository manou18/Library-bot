const axios = require('axios');
const cheerio = require('cheerio');

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'https://my-flaresolverr.onrender.com/v1';

async function search(searchQuery) {
    const targetUrl = `https://annas-archive.org/search?q=${encodeURIComponent(searchQuery)}`;
    try {
        const response = await axios.post(FLARESOLVERR_URL, {
            cmd: 'request.get',
            url: targetUrl,
            maxTimeout: 9000 
        }, { headers: { 'Content-Type': 'application/json' } });

        const $ = cheerio.load(response.data.solution.response);
        const books = [];

        $('a[href^="/md5/"]').each((index, element) => {
            const link = $(element).attr('href');
            const md5 = link ? link.replace('/md5/', '').trim() : null;
            const title = $(element).find('h3').text().trim() || $(element).find('.font-bold').first().text().trim();
            const author = $(element).find('.italic').first().text().trim();
            const metaString = $(element).find('.text-xs, .text-sm').text().toLowerCase();

            let language = metaString.includes('english') || metaString.includes('[en]') ? 'english' : 'unknown';
            let extension = metaString.includes('pdf') ? 'pdf' : (metaString.includes('epub') ? 'epub' : 'unknown');
            const yearMatch = metaString.match(/\b(19|20)\d{2}\b/);
            const year = yearMatch ? yearMatch[0] : 'Unknown';

            if (title && md5 && language === 'english') {
                books.push({ title, author: author || 'Unknown', year, extension, language, download_id: md5, source: 'annasArchive' });
            }
        });
        return books.slice(0, 5);
    } catch (error) {
        console.error("Anna's Archive Error:", error.message);
        return [];
    }
}

module.exports = { search };
