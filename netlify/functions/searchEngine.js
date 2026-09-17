const libgenScraper = require('./scrapers/libgen');
const annasScraper = require('./scrapers/annasArchive');
const zlibScraper = require('./scrapers/zlibrary');

// 💡 دالة جديدة لفرض حد زمني (Timeout) لحماية البوت من التعليق
const withTimeout = (promise, ms, sourceName) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Timeout: ${sourceName} took more than ${ms/1000} seconds.`));
        }, ms);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => clearTimeout(timeoutId));
};

async function searchAllSources(searchQuery) {
    try {
        // 💡 إرسال الطلبات مع حد زمني أقصاه 9 ثوانٍ لكل مكتبة
        const results = await Promise.allSettled([
            withTimeout(libgenScraper.searchBooksOnLibGen(searchQuery), 9000, 'LibGen'),
            withTimeout(annasScraper.search(searchQuery), 9000, 'AnnaArchive'),
            withTimeout(zlibScraper.search(searchQuery), 9000, 'ZLibrary')
        ]);

        let combinedBooks = [];
        results.forEach(res => {
            if (res.status === 'fulfilled' && Array.isArray(res.value)) {
                combinedBooks = combinedBooks.concat(res.value);
            } else if (res.status === 'rejected') {
                // 💡 طباعة اسم المكتبة المتعطلة في سجلات Netlify بدون إيقاف البوت
                console.error(`⚠️ Search Error:`, res.reason.message || res.reason);
            }
        });

        // 💡 تصفية النتائج وإرسال أفضل 5 فقط
        return combinedBooks.filter(b => b.language === 'english' || !b.language).slice(0, 5);
    } catch (error) {
        console.error("🔴 Fatal Search Error:", error);
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
