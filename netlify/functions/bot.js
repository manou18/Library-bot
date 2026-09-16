const TelegramBot = require('node-telegram-bot-api');
const { canUserDownload, isUserVip, getSystemStats, upgradeUserToVip, getAllUsers } = require('./database');
const { searchAllSources, getDirectDownloadLink } = require('./searchEngine');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_CHAT_ID;
const SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (event.headers['x-telegram-bot-api-secret-token'] !== SECRET_TOKEN) {
        return { statusCode: 403, body: 'Forbidden' };
    }

    try {
        const update = JSON.parse(event.body);
        if (update.message && update.message.successful_payment) {
            await handleSuccessfulPayment(update.message);
        } else {
            await handleUpdate(update);
        }
        return { statusCode: 200, body: JSON.stringify({ status: 'ok' }) };
    } catch (e) {
        return { statusCode: 200, body: 'Error handled' };
    }
};

async function handleUpdate(update) {
    if (update.callback_query) return await handleCallbackQuery(update.callback_query);
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id.toString();
        const text = update.message.text.trim();

        if (chatId === ADMIN_ID) {
            if (text === '/stats') {
                const s = await getSystemStats();
                return bot.sendMessage(chatId, `📊 Stats:\nUsers: ${s.totalUsers}\nVIPs: ${s.vipUsers}\nActive: ${s.activeThisMonth}`);
            }
            if (text.startsWith('/addvip')) {
                const parts = text.split(' ');
                if (parts.length === 3) {
                    const expiry = await upgradeUserToVip(parts[1], parseInt(parts[2]));
                    return bot.sendMessage(chatId, expiry ? `✅ VIP Active until ${expiry.toISOString().split('T')[0]}` : `❌ User not found`);
                }
            }
            if (text.startsWith('/broadcast ')) {
                const msg = text.replace('/broadcast ', '');
                const users = await getAllUsers();
                for (const u of users) {
                    try { await bot.sendMessage(u.telegram_id, msg); } catch(e){}
                }
                return bot.sendMessage(chatId, `✅ Broadcast sent.`);
            }
        }

        if (text === '/start') {
            return bot.sendMessage(chatId, "Welcome to Academic Library Bot! 📚\nSend any book title or author to search.");
        }
        await processSearch(chatId, text);
    }
}

async function processSearch(chatId, query) {
    const loading = await bot.sendMessage(chatId, `⏳ Searching across libraries for: *${query}*...`, { parse_mode: 'Markdown' });
    const books = await searchAllSources(query);

    if (books.length === 0) {
        await bot.deleteMessage(chatId, loading.message_id);
        const vip = await isUserVip(chatId);
        let kb = vip ? [[{ text: "📩 Request Book", callback_data: `req_${query}` }]] : [];
        return bot.sendMessage(chatId, `❌ No English results found.`, { reply_markup: { inline_keyboard: kb } });
    }

    let text = `📚 *Results for:* ${query}\n\n`;
    let keyboard = [];
    books.forEach((b, i) => {
        text += `${i+1}. *${b.title}*\n👤 ${b.author} | 🌐 ${b.source}\n\n`;
        keyboard.push([{ text: `📥 Download (${b.extension}) - ${i+1}`, callback_data: `dl_${b.source}_${b.download_id}` }]);
    });

    await bot.deleteMessage(chatId, loading.message_id);
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
}

async function handleCallbackQuery(cq) {
    const chatId = cq.message.chat.id.toString();
    const data = cq.data;
    await bot.answerCallbackQuery(cq.id);

    if (data === 'show_pricing') {
        return bot.sendMessage(chatId, "👑 *VIP Passes (Telegram Stars ⭐)*\n\nChoose a plan:", {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⭐ Monthly (150 Stars)", callback_data: "buy_monthly" }],
                    [{ text: "⭐ Semester (500 Stars)", callback_data: "buy_semester" }],
                    [{ text: "🔙 Back", callback_data: "back_to_start" }]
                ]
            }
        });
    }

    if (data === 'buy_monthly' || data === 'buy_semester') {
        const isM = data === 'buy_monthly';
        return bot.sendInvoice(
            chatId,
            isM ? "Monthly VIP Pass" : "Semester VIP Pass",
            isM ? "30 days unlimited access" : "180 days unlimited access",
            isM ? "vip_30" : "vip_180",
            "",
            "XTR",
            [{ label: isM ? "Monthly" : "Semester", amount: isM ? 150 : 500 }]
        );
    }

    if (data === 'back_to_start') {
        return bot.sendMessage(chatId, "Send me a book title or author to search.");
    }

    if (data.startsWith('dl_')) {
        const parts = data.split('_');
        const source = parts[1];
        const downloadId = parts.slice(2).join('_');

        const status = await canUserDownload(chatId);
        if (!status.allowed) {
            return bot.sendMessage(chatId, status.message, {
                reply_markup: { inline_keyboard: [[{ text: "👑 View VIP Pricing", callback_data: "show_pricing" }]] }
            });
        }

        const waitMsg = await bot.sendMessage(chatId, "⏳ Getting link...");
        const link = await getDirectDownloadLink(source, downloadId);
        await bot.deleteMessage(chatId, waitMsg.message_id);

        if (!link) return bot.sendMessage(chatId, "❌ Link not found.");
        return bot.sendMessage(chatId, "📚 *Your download link:*", {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "📥 Download File", url: link }]] }
        });
    }
}

async function handleSuccessfulPayment(msg) {
    const chatId = msg.chat.id.toString();
    const p = msg.successful_payment;
    if (p && p.currency === 'XTR') {
        const days = p.invoice_payload === 'vip_180' ? 180 : 30;
        const expiry = await upgradeUserToVip(chatId, days);
        if (expiry) {
            await bot.sendMessage(chatId, `🎉 Payment successful! VIP active until: ${expiry.toISOString().split('T')[0]} 👑`);
            if (ADMIN_ID) bot.sendMessage(ADMIN_ID, `💰 New Telegram Stars Payment! User: \`${chatId}\``, { parse_mode: 'Markdown' });
        }
    }
}

