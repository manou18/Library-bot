const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    telegram_id: { type: String, required: true, unique: true },
    download_count: { type: Number, default: 0 },
    last_download_date: { type: Date, default: null },
    is_vip: { type: Boolean, default: false },
    vip_expiry_date: { type: Date, default: null }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

let cachedDb = null;
async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    const db = await mongoose.connect(process.env.MONGODB_URI);
    cachedDb = db;
    return db;
}

async function canUserDownload(telegramId) {
    await connectToDatabase();
    let user = await User.findOne({ telegram_id: telegramId });
    if (!user) {
        user = await User.create({ telegram_id: telegramId });
    }

    if (user.is_vip && user.vip_expiry_date > new Date()) {
        return { allowed: true, message: "👑 VIP" };
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const lastDownload = user.last_download_date ? new Date(user.last_download_date) : null;

    if (!lastDownload || lastDownload.getMonth() !== currentMonth || lastDownload.getFullYear() !== currentYear) {
        user.download_count = 0;
        user.last_download_date = new Date();
    }

    const MAX_FREE = 3;
    if (user.download_count < MAX_FREE) {
        user.download_count += 1;
        user.last_download_date = new Date();
        await user.save();
        return { allowed: true, message: `✅ Allowed (${MAX_FREE - user.download_count} free left this month)` };
    } else {
        return { allowed: false, message: "❌ You have exhausted your 3 free monthly downloads. Upgrade to VIP for unlimited access!" };
    }
}

async function isUserVip(telegramId) {
    await connectToDatabase();
    const user = await User.findOne({ telegram_id: telegramId });
    return Boolean(user && user.is_vip && user.vip_expiry_date > new Date());
}

async function getSystemStats() {
    await connectToDatabase();
    const totalUsers = await User.countDocuments();
    const vipUsers = await User.countDocuments({ is_vip: true, vip_expiry_date: { $gt: new Date() } });
    const currentMonth = new Date().getMonth();
    const activeThisMonth = await User.countDocuments({
        $expr: { $eq: [{ $month: "$last_download_date" }, currentMonth + 1] }
    });
    return { totalUsers, vipUsers, activeThisMonth };
}

async function upgradeUserToVip(telegramId, days) {
    await connectToDatabase();
    const user = await User.findOne({ telegram_id: telegramId });
    if (!user) return null;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    user.is_vip = true;
    user.vip_expiry_date = expiryDate;
    await user.save();
    return expiryDate;
}

async function getAllUsers() {
    await connectToDatabase();
    return await User.find({}, 'telegram_id');
}

module.exports = { canUserDownload, isUserVip, getSystemStats, upgradeUserToVip, getAllUsers };
