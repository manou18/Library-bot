const libgenScraper = require('./scrapers/libgen');
const annasScraper = require('./scrapers/annasArchive');
const zlibScraper = require('./scrapers/zlibrary');

async function searchAllSources(searchQuery) {
    try {
        const results = await Promise.allSettled([
            libgenScraper.searchBooksOnLibGen(searchQuery),
            annasScraper.search(searchQuery),
            zlibScraper.search(searchQuery)
        ]);

        let combinedBooks = [];
        results.forEach(res => {
            if (res.status === 'fulfilled' && Array.isArray(res.value)) {
                combinedBooks = combinedBooks.concat(res.value);
            }
        });

        return combinedBooks.filter(b => b.language === 'english').slice(0, 5);
    } catch (error) {
        return [];
    }
}

async function getDirectDownloadLink(source, downloadId) {
    if (source === 'libgen') return await libgenScraper.getDirectDownloadLink(downloadId);
    if (source === 'annasArchive') return `https://annas-archive.org/md5/${downloadId}`;
    if (source === 'zlib') return await zlibScraper.getDirectDownloadLink(downloadId);
    return null;
}

module.exports = { searchAllSources, getDirectDownloadLink };

