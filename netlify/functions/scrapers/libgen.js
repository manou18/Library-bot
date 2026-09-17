const axios = require('axios');
const cheerio = require('cheerio');

async function searchBooksOnLibGen(searchQuery) {
    // استخدام النطاق البديل والأكثر استقراراً
    const baseUrl = 'https://libgen.rs/search.php'; 
    
    try {
        const response = await axios.get(baseUrl, { 
            params: { req: searchQuery, res: 25, column: 'def' },
            timeout: 5000, // إيقاف المحاولة إذا استغرقت أكثر من 5 ثوانٍ
            headers: {
                // التخفي كمتصفح حقيقي لتجاوز الحظر
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });
        
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

            // تحسين استخراج العنوان في حال كان الرابط مخفياً
            const finalTitle = title || $(tds[2]).text().replace(/\[.*?\]/g, '').trim();

            if (finalTitle && md5 && language === 'english') {
                booksList.push({ title: finalTitle, author, year, extension, download_id: md5, source: 'libgen', language });
            }
        });
        
        return booksList.slice(0, 5);
    } catch (error) {
        console.error("LibGen Error:", error.message);
        return [];
    }
}

async function getDirectDownloadLink(md5) {
    // إرجاع صفحة التحميل الرسمية مباشرة لتجنب حظر الاستضافة وسرعة الاستجابة
    return `http://library.lol/main/${md5}`;
}

module.exports = { searchBooksOnLibGen, getDirectDownloadLink };
