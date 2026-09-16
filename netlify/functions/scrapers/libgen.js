const axios = require('axios');
const cheerio = require('cheerio');

async function searchBooksOnLibGen(searchQuery) {
    const baseUrl = 'https://libgen.is/search.php';
    try {
        const response = await axios.get(baseUrl, { params: { req: searchQuery, res: 25, column: 'def' } });
        const $ = cheerio.load(response.data);
        const booksList = [];

        $('table.c tr').each((index, element) => {
            if (index === 0) return;
            const tds = $(element).find('td');
            const author = $(tds[1]).text().trim();
            const title = $(tds[2]).find('a[id^="1"]').text().trim();
            const year = $(tds[4]).text().trim();
            const language = $(tds[6]).text().trim().toLowerCase();
            const extension = $(tds[8]).text().trim();
            const md5Link = $(tds[2]).find('a[href*="md5"]').attr('href');
            const md5 = md5Link ? md5Link.split('md5=')[1] : null;

            if (title && md5 && language === 'english') {
                booksList.push({ title, author, year, extension, download_id: md5, source: 'libgen', language });
            }
        });
        return booksList.slice(0, 5);
    } catch (error) {
        console.error("LibGen Error:", error.message);
        return [];
    }
}

async function getDirectDownloadLink(md5) {
    try {
        const response = await axios.get(`http://library.lol/main/${md5}`);
        const $ = cheerio.load(response.data);
        return $('#download h2 a').attr('href') || null;
    } catch (error) {
        return null;
    }
}

module.exports = { searchBooksOnLibGen, getDirectDownloadLink };

