require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const mongoose = require('mongoose');
const { createCanvas, loadImage } = require('canvas');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');
const https = require('https');
const ms = require('ms');
const {
    Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent,
    AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelType, PermissionFlagsBits,
    ModalBuilder, TextInputBuilder, TextInputStyle, ActivityType,
    REST, Routes, SlashCommandBuilder
} = require('discord.js');

// ==========================================
// 1. تعريف الـ Schemas (قاعدة البيانات)
// ==========================================


const AdminCmdConfig = mongoose.model('AdminCmdConfig', new mongoose.Schema({
    guildId: String,
    adminRoles: { type: [String], default: [] },
    settings: {
        lock: { shortcut: { type: String, default: '-ق' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        unlock: { shortcut: { type: String, default: '-ف' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        timeout: { shortcut: { type: String, default: '-ت' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        untimeout: { shortcut: { type: String, default: '-فت' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        ban: { shortcut: { type: String, default: '-ب' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        unban: { shortcut: { type: String, default: '-فب' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        kick: { shortcut: { type: String, default: '-ك' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } }
    }
}));

const KickConfig = mongoose.model('KickConfig', new mongoose.Schema({
    guildId: String,
    streamers: [{
        kickUsername: String,
        channelId: String,
        roleId: String,
        customMessage: String,
        isLive: { type: Boolean, default: false },
        lastCategoryName: { type: String, default: null }
    }]
}));

const ticketDataSchema = new mongoose.Schema({
    ticketCount: { type: Number, default: 0 },
    guildId: String,
    channelId: String,
    ownerId: String,
    activeTicketKey: String,
    ticketType: { type: String, default: 'تذكرة دعم' },
    adminRole: String,
    categoryId: String,
    claimedBy: String,
    openedAt: Date,
    closedAt: Date,
    closedBy: String,
    archivedAt: Date
});
ticketDataSchema.index({ activeTicketKey: 1 }, { unique: true, partialFilterExpression: { activeTicketKey: { $type: 'string' } } });
const TicketData = mongoose.model('TicketData', ticketDataSchema);

const UserLevel = mongoose.model('UserLevel', new mongoose.Schema({
    guildId: String,
    userId: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    msgCount: { type: Number, default: 0 }
}));

const LevelBackup = mongoose.model('LevelBackup', new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    resetBy: { type: String, required: true },
    resetAt: { type: Date, default: Date.now },
    levels: [{
        userId: { type: String, required: true },
        xp: { type: Number, default: 0 },
        level: { type: Number, default: 1 },
        msgCount: { type: Number, default: 0 }
    }]
}, { timestamps: false }));

const Warn = mongoose.model('Warn', new mongoose.Schema({
    guildId: String,
    userId: String,
    reason: String,
    moderatorId: String,
    createdAt: { type: Date, default: Date.now }
}));

const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    autoReply: [{
        trigger: String,
        reply: String
    }],
    security: {
        antiLinks: Boolean,
        badWords: String,
        badEmojis: String,
        punishment: { type: String, default: 'none' },
        bypassRoles: [String]
    },
    levels: {
        enabled: Boolean,
        xpPerMessage: { type: Number, default: 10 },
        xpCooldownSeconds: { type: Number, default: 60 },
        levelUpChannel: String,
        leaderboardCommand: { type: String, default: '!levels' }
    },
    notificationRoles: {
        imagePath: String,
        channelIds: { type: [String], default: [] },
        roles: [{ roleId: String, label: String, emoji: String }],
        panels: [{ channelId: String, messageId: String }]
    },
    logs: {
        messages: { channel: String, enabled: Boolean },
        moderation: { channel: String, enabled: Boolean },
        members: { channel: String, enabled: Boolean },
        channels: { channel: String, enabled: Boolean },
        roles: { channel: String, enabled: Boolean },
        voice: { channel: String, enabled: Boolean }
    },
    welcome: {
        enabled: { type: Boolean, default: false },
        channel: String,
        embedMessage: { type: String, default: "مرحباً بك {member} في سيرفر {guild}!" },
        imagePath: String,
        avatarX: { type: Number, default: 50 },
        avatarY: { type: Number, default: 50 },
        avatarWidth: { type: Number, default: 150 },
        avatarHeight: { type: Number, default: 150 },
        aiPrompt: { type: String, default: "Anime style landscape, forest, sun light, high quality" },
        bannerURL: String
    },
}));

const Stats = mongoose.model('Stats', new mongoose.Schema({
    guildId: String,
    messages: {
        total: { type: Number, default: 0 },
        daily: { type: Number, default: 0 },
        weekly: { type: Number, default: 0 },
        monthly: { type: Number, default: 0 },
        dailyKey: String,
        weeklyKey: String,
        monthlyKey: String,
        lastUpdate: { type: Date, default: Date.now }
    },
    activeChannels: { type: Map, of: Number, default: {} },
    membersLog: {
        joined: [Date],
        left: [Date]
    },
    modActions: {
        bans: { type: Number, default: 0 },
        kicks: { type: Number, default: 0 },
        warns: { type: Number, default: 0 }
    }
}));

const Giveaway = mongoose.model('Giveaway', new mongoose.Schema({
    guildId: String,
    messageId: String,
    channelId: String,
    endAt: Date,
    winnersCount: Number,
    prize: String,
    description: String,
    imagePath: String,
    participants: { type: [String], default: [] },
    ended: { type: Boolean, default: false }
}));

const SuggestionConfig = mongoose.model('SuggestionConfig', new mongoose.Schema({
    guildId: String,
    channelId: String,
    imagePath: String,
    imageUrl: String,
    emoji1: String,
    emoji2: String
}));


const channelLockSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    previousSendMessages: { type: String, enum: ['allow', 'deny', 'inherit'], default: 'inherit' },
    lockedBy: String,
    lockedAt: { type: Date, default: Date.now }
});
channelLockSchema.index({ guildId: 1, channelId: 1 }, { unique: true });
const ChannelLock = mongoose.model('ChannelLock', channelLockSchema);

const MemberHistory = mongoose.model('MemberHistory', new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ['deleted', 'edited', 'role_added', 'role_removed'], required: true, index: true },
    channelId: String,
    channelName: String,
    messageId: String,
    before: String,
    after: String,
    content: String,
    roleId: String,
    roleName: String,
    executorId: String,
    createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: false }));

const InviteRecord = mongoose.model('InviteRecord', new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    inviterId: { type: String, required: true, index: true },
    invitedUserId: { type: String, required: true, index: true },
    inviteCode: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    currentlyInGuild: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: false }));

const Suggestion = mongoose.model('Suggestion', new mongoose.Schema({
    guildId: String,
    messageId: String,
    channelId: String,
    authorId: String,
    content: String,
    status: { type: String, default: 'pending' },
    votes1: { type: [String], default: [] },
    votes2: { type: [String], default: [] },
    replyThreadId: String,
    createdAt: { type: Date, default: Date.now }
}));

const TicketRating = mongoose.model('TicketRating', new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    channelId: { type: String, required: true },
    ownerId: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    createdAt: { type: Date, default: Date.now }
}));

const TicketConfig = mongoose.model('TicketConfig', new mongoose.Schema({
    guildId: String,
    channelId: String,
    panelMessageId: String,
    title: String,
    description: String,
    color: String,
    topImagePath: String,
    bottomImagePath: String,
    ticketCount: { type: Number, default: 0 },
    buttons: [{ label: String, emoji: String, description: String, adminRole: String, categoryId: String }],
    menuOptions: [{ label: String, emoji: String, description: String, adminRole: String, categoryId: String }]
}));

// ==========================================
// 2. Express App Setup
// ==========================================
const app = express();
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json());
app.set('trust proxy', 1);
app.set('view engine', 'ejs');

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});
app.use('/uploads', express.static(uploadDir, { dotfiles: 'deny', index: false, fallthrough: false }));

// ==========================================
// 3. تعريف الـ Client
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember, Partials.Reaction]
});

const commands = [
    new SlashCommandBuilder().setName('setbanner').setDescription('رفع صورة الخط').addAttachmentOption(o => o.setName('image').setDescription('صورة البنر').setRequired(true)),
    new SlashCommandBuilder().setName('rename_panel').setDescription('لوحة تغيير الاسم').addStringOption(o => o.setName('name').setRequired(true).setDescription('الاسم')).addAttachmentOption(o => o.setName('image').setDescription('صورة اختيارية'))
].map(c => c.toJSON());

// ==========================================
// 4. اتصال قاعدة البيانات
// ==========================================
mongoose.connect(process.env.MONGO_CONNECTION_STRING)
    .then(async () => {
        console.log('[DB] Connected to MongoDB');
        await Promise.all([TicketData.init(), TicketRating.init(), ChannelLock.init()]).catch(error => console.error('[DB] Index initialization warning:', error.message));
    })
    .catch(err => console.log('[DB] Connection Error:', err));

// ==========================================
// 5. الدوال المساعدة
// ==========================================
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
}
async function applySecurityViolation(message, reason, punishment = 'delete') {
    const member = message.member;
    const deleted = await message.delete().then(() => true).catch(() => false);
    let actionText = deleted ? 'تم حذف الرسالة.' : 'تعذر حذف الرسالة؛ تحقق من Manage Messages.';
    if (punishment === 'timeout' && member?.moderatable) {
        await member.timeout(10 * 60 * 1000, `Drayz protection: ${reason}`).then(() => { actionText = `${deleted ? 'تم حذف الرسالة' : 'تعذر حذف الرسالة'} وإعطاء مهلة 10 دقائق.`; }).catch(error => { actionText += ` لم أستطع تطبيق المهلة (${error.code || 'خطأ صلاحيات'}).`; });
    } else if (punishment === 'kick' && member?.kickable) {
        await member.kick(`Drayz protection: ${reason}`).then(() => { actionText = `${deleted ? 'تم حذف الرسالة' : 'تعذر حذف الرسالة'} وطرد العضو.`; }).catch(error => { actionText += ` لم أستطع تطبيق الطرد (${error.code || 'خطأ صلاحيات'}).`; });
    } else if (punishment === 'timeout' || punishment === 'kick') {
        actionText += ' تعذر تنفيذ العقوبة؛ رتبة البوت أو صلاحياته غير كافية.';
    }
    if (punishment !== 'none') {
        const notice = await message.channel.send({ content: `<@${message.author.id}> ${actionText}`, allowedMentions: { users: [message.author.id] } }).catch(() => null);
        if (notice) setTimeout(() => notice.delete().catch(() => {}), 6000).unref?.();
    }
}

async function sendLog(guild, type, embed, files = []) {
    if (!guild?.id || !embed) return;
    try {
        const config = await GuildConfig.findOne({ guildId: guild.id }).lean();
        const logSettings = config?.logs?.[type];
        if (!logSettings?.enabled || !logSettings.channel) return;
        const logChannel = guild.channels.cache.get(logSettings.channel)
            || await guild.channels.fetch(logSettings.channel).catch(() => null);
        if (!logChannel?.isTextBased?.()) return;
        await logChannel.send({ embeds: [embed], ...(files?.length ? { files } : {}) }).catch(() => {});
    } catch (error) {
        console.error('[Send Log Error]', error.message);
    }
}


async function setManagedChannelLock(guild, channel, locked, actorId) {
    if (!guild || !channel?.permissionOverwrites) throw new Error('القناة لا تدعم قفل الإرسال.');
    const filter = { guildId: guild.id, channelId: channel.id };
    if (locked) {
        const overwrite = channel.permissionOverwrites.cache.get(guild.id);
        const previousSendMessages = overwrite?.deny?.has(PermissionFlagsBits.SendMessages) ? 'deny' : overwrite?.allow?.has(PermissionFlagsBits.SendMessages) ? 'allow' : 'inherit';
        const current = await ChannelLock.findOne(filter);
        if (!current) {
            try { await ChannelLock.create({ ...filter, previousSendMessages, lockedBy: actorId }); }
            catch (error) { if (error?.code !== 11000) throw error; }
        }
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        return 'locked';
    }
    const record = await ChannelLock.findOne(filter);
    if (!record) return 'not-managed-locked';
    const value = record.previousSendMessages === 'allow' ? true : record.previousSendMessages === 'deny' ? false : null;
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: value });
    await ChannelLock.deleteOne(filter);
    return 'unlocked';
}

function isoWeekKey(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function updateMessageStats(guildId, channelId, now = new Date()) {
    const dayKey = now.toISOString().slice(0, 10);
    const monthKey = dayKey.slice(0, 7);
    const weekKey = isoWeekKey(now);
    const channelPath = `activeChannels.${channelId}`;
    await Stats.collection.updateOne({ guildId }, [{ $set: {
        'messages.total': { $add: [{ $ifNull: ['$messages.total', 0] }, 1] },
        'messages.daily': { $cond: [{ $eq: ['$messages.dailyKey', dayKey] }, { $add: [{ $ifNull: ['$messages.daily', 0] }, 1] }, 1] },
        'messages.weekly': { $cond: [{ $eq: ['$messages.weeklyKey', weekKey] }, { $add: [{ $ifNull: ['$messages.weekly', 0] }, 1] }, 1] },
        'messages.monthly': { $cond: [{ $eq: ['$messages.monthlyKey', monthKey] }, { $add: [{ $ifNull: ['$messages.monthly', 0] }, 1] }, 1] },
        'messages.dailyKey': dayKey,
        'messages.weeklyKey': weekKey,
        'messages.monthlyKey': monthKey,
        'messages.lastUpdate': now,
        activeChannels: { $mergeObjects: [{ $ifNull: ['$activeChannels', {}] }, { [channelId]: { $add: [{ $ifNull: [`$${channelPath}`, 0] }, 1] } }] }
    } }], { upsert: true });
}

async function recordMemberEvent(guildId, eventType, now = new Date()) {
    const cutoff = new Date(now.getTime() - 7 * 86400000);
    const keepRecent = field => ({ $filter: { input: { $ifNull: [`$membersLog.${field}`, []] }, as: 'stamp', cond: { $gte: ['$$stamp', cutoff] } } });
    const joined = { $concatArrays: [keepRecent('joined'), ...(eventType === 'joined' ? [[now]] : [])] };
    const left = { $concatArrays: [keepRecent('left'), ...(eventType === 'left' ? [[now]] : [])] };
    await Stats.collection.updateOne({ guildId }, [{ $set: { 'membersLog.joined': joined, 'membersLog.left': left } }], { upsert: true });
}

async function recordMemberHistory(data) {
    try {
        if (!data.guildId || !data.userId || !data.type) return;
        await MemberHistory.create({
            ...data,
            before: data.before ? String(data.before).slice(0, 1900) : undefined,
            after: data.after ? String(data.after).slice(0, 1900) : undefined,
            content: data.content ? String(data.content).slice(0, 1900) : undefined
        });
    } catch (err) {
        console.error('[Member History Error]', err.message);
    }
}

function historyButtons(userId, selectedType, page = 0) {
    const buttons = [
        ['deleted', 'الرسائل المحذوفة'],
        ['edited', 'الرسائل المعدلة'],
        ['role_added', 'الرتب التي تم تسليمها له'],
        ['role_removed', 'الرتب التي تم سحبها منه']
    ];
    return new ActionRowBuilder().addComponents(buttons.map(([type, label]) =>
        new ButtonBuilder()
            .setCustomId(`memberhistory:${type}:${userId}:${type === selectedType ? page : 0}`)
            .setLabel(label)
            .setStyle(type === selectedType ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ));
}

async function fetchLegacyMemberHistory(guild, userId) {
    const config = await GuildConfig.findOne({ guildId: guild.id }).lean().catch(() => null);
    const channelIds = [...new Set(Object.values(config?.logs || {}).map(x => x?.channel).filter(Boolean))];
    const result = [];
    const mentionMatches = value => String(value || '').match(new RegExp(`<@!?${userId}>`));
    const fieldValue = (fields, names) => fields.find(f => names.some(n => String(f.name || '').includes(n)))?.value || '';

    for (const channelId of channelIds) {
        const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased?.() || !channel.messages?.fetch) continue;
        let before;
        for (let page = 0; page < 100; page++) {
            const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
            if (!batch?.size) break;
            for (const logMessage of batch.values()) {
                const embed = logMessage.embeds?.[0];
                if (!embed) continue;
                const title = String(embed.title || '').toLowerCase();
                const fields = embed.fields || [];
                const names = fields.map(f => String(f.name || '').toLowerCase()).join(' ');
                const allText = fields.map(f => `${f.name} ${f.value}`).join('\n');
                if (!mentionMatches(allText) && !title.includes(userId)) continue;
                const base = { guildId: guild.id, userId, createdAt: logMessage.createdAt, sourceMessageId: logMessage.id };

                if (title.includes('رسالة محذوفة') || title.includes('message deleted')) {
                    result.push({ ...base, type: 'deleted', channelId: (fieldValue(fields, ['القناة', 'channel']).match(/<#(\d+)>/) || [])[1], content: fieldValue(fields, ['المحتوى', 'content']) });
                } else if (title.includes('رسالة معدلة') || title.includes('message edited') || title.includes('message updated')) {
                    result.push({ ...base, type: 'edited', channelId: (fieldValue(fields, ['القناة', 'channel']).match(/<#(\d+)>/) || [])[1], before: fieldValue(fields, ['قبل', 'before']), after: fieldValue(fields, ['بعد', 'after']) });
                } else if ((title.includes('رتبة') || names.includes('رتبة') || names.includes('role')) && (title.includes('أعط') || title.includes('إضاف') || title.includes('منح') || title.includes('سحب') || title.includes('إزال') || title.includes('remove') || title.includes('add'))) {
                    const isRemoved = title.includes('سحب') || title.includes('إزال') || title.includes('remove') || names.includes('سحب') || names.includes('إزالة');
                    const roleText = fieldValue(fields, ['الرتبة', 'role']) || 'رتبة غير معروفة';
                    const roleId = (roleText.match(/<@&(\d+)>/) || [])[1];
                    result.push({ ...base, type: isRemoved ? 'role_removed' : 'role_added', roleId, roleName: roleText.replace(/<@&\d+>/g, '').trim() });
                }
            }
            before = batch.last()?.id;
            if (batch.size < 100 || !before) break;
        }
    }
    return result;
}

const memberHistoryLegacyCache = new Map();

async function getLegacyCached(guild, userId) {
    const key = `${guild.id}:${userId}`;
    if (!memberHistoryLegacyCache.has(key)) {
        const promise = fetchLegacyMemberHistory(guild, userId).finally(() => setTimeout(() => memberHistoryLegacyCache.delete(key), 30000));
        memberHistoryLegacyCache.set(key, promise);
    }
    return memberHistoryLegacyCache.get(key);
}

async function getCombinedMemberHistory(guild, userId, type) {
    const [stored, legacy] = await Promise.all([
        MemberHistory.find({ guildId: guild.id, userId, type }).lean(),
        getLegacyCached(guild, userId)
    ]);
    const combined = [...stored, ...legacy.filter(x => x.type === type)];
    const seen = new Set();
    return combined.filter(entry => {
        const key = entry.sourceMessageId ? `legacy:${entry.sourceMessageId}:${entry.type}` : `stored:${entry._id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function buildMemberHistoryEmbed(guild, user, type, page = 0) {
    const labels = {
        deleted: 'الرسائل المحذوفة',
        edited: 'الرسائل المعدلة',
        role_added: 'الرتب التي تم تسليمها له',
        role_removed: 'الرتب التي تم سحبها منه'
    };
    const allEntries = await getCombinedMemberHistory(guild, user.id, type);
    const total = allEntries.length;
    const pageSize = 5;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(Math.max(Number(page) || 0, 0), pages - 1);
    const entries = allEntries.slice(page * pageSize, (page + 1) * pageSize);

    const embed = new EmbedBuilder()
        .setTitle(`سجل العضو: ${user.tag}`)
        .setDescription(`العضو: <@${user.id}>\nالقسم: **${labels[type]}**\nإجمالي السجلات في هذا القسم: **${total}**`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setColor(0xd4af37)
        .setFooter({ text: `صفحة ${page + 1} من ${pages} • يتم حفظ السجلات منذ تشغيل النظام` })
        .setTimestamp();

    if (!entries.length) {
        embed.addFields({ name: 'لا توجد سجلات', value: 'لا يوجد شيء محفوظ لهذا العضو في هذا القسم.' });
        return { embed, page };
    }

    for (const [i, entry] of entries.entries()) {
        const date = entry.createdAt ? `<t:${Math.floor(new Date(entry.createdAt).getTime() / 1000)}:F>` : 'وقت غير معروف';
        let value;
        if (type === 'deleted') {
            value = `القناة: ${entry.channelId ? `<#${entry.channelId}>` : entry.channelName || 'غير معروفة'}\nالمحتوى: ${entry.content || '(لا يوجد نص)'}`;
        } else if (type === 'edited') {
            value = `القناة: ${entry.channelId ? `<#${entry.channelId}>` : entry.channelName || 'غير معروفة'}\nقبل: ${entry.before || '(فارغ)'}\nبعد: ${entry.after || '(فارغ)'}`;
        } else {
            value = `الرتبة: **${entry.roleName || 'رتبة محذوفة'}** ${entry.roleId ? `(<@&${entry.roleId}>)` : ''}\nبواسطة: ${entry.executorId ? `<@${entry.executorId}>` : 'غير معروف'}`;
        }
        embed.addFields({ name: `${i + 1 + page * pageSize}. ${date}`, value: value.slice(0, 1024) });
    }
    return { embed, page };
}

async function getExecutor(guild, actionType) {
    try {
        const logs = await guild.fetchAuditLogs({ limit: 1, type: actionType });
        const entry = logs.entries.first();
        if (!entry) return 'غير معروف';
        return `<@${entry.executor.id}>`;
    } catch {
        return 'غير معروف';
    }
}

async function createRandomWelcomeBackground(filePath) {
    const themes = [
        { bg: '#07131a', panel: '#0c2029', accent: '#32e6b1', text: '#f5fffc', sub: '#a8d8cb' },
        { bg: '#090b1e', panel: '#12183d', accent: '#6d7cff', text: '#f7f8ff', sub: '#b9c0ff' },
        { bg: '#190b16', panel: '#321329', accent: '#ff5e9c', text: '#fff7fb', sub: '#f0b8ce' },
        { bg: '#161108', panel: '#2a1f0c', accent: '#f4c24c', text: '#fffaf0', sub: '#d9c898' },
        { bg: '#0b1017', panel: '#172235', accent: '#53b7ff', text: '#f4fbff', sub: '#afd3e8' }
    ];
    const theme = themes[Math.floor(Math.random() * themes.length)];
    const canvas = createCanvas(1200, 600);
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1200, 600);
    gradient.addColorStop(0, theme.bg);
    gradient.addColorStop(1, theme.panel);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 600);

    for (let i = 0; i < 36; i++) {
        ctx.fillStyle = `${theme.accent}${Math.floor(20 + Math.random() * 45).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(Math.random() * 1200, Math.random() * 600, 1 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = `${theme.accent}55`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 70 + i * 72);
        ctx.lineTo(760 + i * 18, 20 + i * 72);
        ctx.stroke();
    }

    ctx.fillStyle = theme.accent;
    ctx.fillRect(62, 70, 7, 230);
    ctx.fillStyle = theme.text;
    ctx.font = '900 72px Arial';
    ctx.fillText('WELCOME', 105, 150);
    ctx.font = '700 30px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText('TO THE SERVER', 110, 205);
    ctx.font = '500 22px Arial';
    ctx.fillStyle = theme.sub;
    ctx.fillText('GLAD TO HAVE YOU HERE', 110, 250);
    ctx.font = '600 18px Arial';
    ctx.fillStyle = theme.text;
    ctx.fillText('BE RESPECTFUL  •  STAY ACTIVE  •  HAVE FUN', 110, 315);

    const x = 830, y = 65, w = 300, h = 470;
    ctx.fillStyle = `${theme.accent}18`;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 28);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = `${theme.accent}66`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 20, y + 20, w - 40, h - 40);
    ctx.font = '700 16px Arial';
    ctx.fillStyle = theme.sub;
    ctx.textAlign = 'center';
    ctx.fillText('MEMBER AVATAR', x + w / 2, y + h - 30);
    ctx.textAlign = 'left';
    ctx.font = '700 18px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText('NEW MEMBER', 110, 385);
    ctx.fillStyle = theme.sub;
    ctx.font = '500 17px Arial';
    ctx.fillText('YOUR ADVENTURE STARTS HERE', 110, 420);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(110, 465, 260 + Math.floor(Math.random() * 180), 4);
    await fs.promises.writeFile(filePath, canvas.toBuffer('image/png'));
    return { width: 1200, height: 600, theme: theme.accent };
}

function getEmojiDisplay(guild, emojiId) {
    if (!emojiId) return '❓';
    const em = guild.emojis.cache.get(emojiId);
    return em ? em.toString() : `<:v:${emojiId}>`;
}

// ==========================================
// 6. Upload Setup
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 80, parts: 90 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
        if (!allowed.has(ext) || !/^image\/(png|jpeg|webp|gif)$/i.test(file.mimetype || '')) {
            return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
        }
        cb(null, true);
    }
});

function isPublicImageAddress(address) {
    const family = net.isIP(address);
    if (family === 4) {
        const octets = address.split('.').map(Number);
        const [a, b, c] = octets;
        if (
            a === 0 || a === 10 || a === 127 || a >= 224 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
            (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
            (a === 203 && b === 0 && c === 113)
        ) return false;
        return octets.length === 4 && octets.every(value => Number.isInteger(value) && value >= 0 && value <= 255);
    }
    if (family === 6) {
        const normalized = address.toLowerCase().split('%')[0];
        if (normalized.startsWith('::ffff:')) {
            const mapped = normalized.slice(7);
            return net.isIP(mapped) === 4 && isPublicImageAddress(mapped);
        }
        const firstBlock = parseInt(normalized.split(':')[0] || '0', 16);
        return firstBlock >= 0x2000 && firstBlock <= 0x3fff && !normalized.startsWith('2001:db8:');
    }
    return false;
}

async function downloadPublicWelcomeImage(imageUrl) {
    const host = imageUrl.hostname.replace(/^\[|\]$/g, '');
    const addresses = await dns.lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(record => !isPublicImageAddress(record.address))) throw new Error('عنوان صورة غير عام.');
    const pinned = addresses[0];
    const agent = new https.Agent({ lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, addresses.map(record => ({ address: record.address, family: record.family })));
        else callback(null, pinned.address, pinned.family);
    } });
    try {
        const response = await axios.get(imageUrl.href, { responseType: 'arraybuffer', timeout: 8000, maxRedirects: 0, maxContentLength: 5 * 1024 * 1024, httpsAgent: agent, validateStatus: status => status === 200 });
        const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const mimeExt = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }[contentType];
        const bytes = Buffer.from(response.data);
        const signatureOK = contentType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
            contentType === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff :
            contentType === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' :
            contentType === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)) : false;
        if (!mimeExt || !signatureOK || bytes.length < 12 || bytes.length > 5 * 1024 * 1024) throw new Error('الرابط لا يعيد ملف صورة صالحًا ضمن 5MB.');
        const filename = `welcome-remote-${Date.now()}-${crypto.randomBytes(12).toString('hex')}${mimeExt}`;
        const absolutePath = path.join(uploadDir, filename);
        await fs.promises.writeFile(absolutePath, bytes, { flag: 'wx', mode: 0o600 });
        return { publicPath: `/uploads/${filename}`, absolutePath };
    } finally { agent.destroy(); }
}

async function verifyUploadedImages(req, res, next) {
    const files = [...(req.file ? [req.file] : []), ...Object.values(req.files || {}).flat()];
    if (files.length) res.once('finish', () => {
        if (req.keepUploadedFiles) return;
        for (const file of files) fs.promises.unlink(file.path).catch(() => {});
    });
    const isRealImage = (ext, bytes) => {
        if (ext === '.png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        if (ext === '.jpg' || ext === '.jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        if (ext === '.webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
        if (ext === '.gif') return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6));
        return false;
    };
    try {
        for (const file of files) {
            const handle = await fs.promises.open(file.path, 'r');
            const head = Buffer.alloc(12);
            try { await handle.read(head, 0, 12, 0); } finally { await handle.close(); }
            if (!isRealImage(path.extname(file.originalname || '').toLowerCase(), head)) {
                await Promise.all(files.map(item => fs.promises.unlink(item.path).catch(() => {})));
                return res.status(415).send('نوع الصورة غير صالح؛ استخدم صورة PNG أو JPEG أو WebP حقيقية.');
            }
        }
        return next();
    } catch (error) {
        console.error('[Upload Verification Error]', error.message);
        return res.status(400).send('تعذر التحقق من الملف المرفوع.');
    }
}

// ==========================================
// 7. Auth Setup
// ==========================================
passport.serializeUser((user, done) => done(null, { id: user.id, username: user.username, globalName: user.globalName, avatar: user.avatar, guilds: user.guilds }));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    proxy: true,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET مطلوب في بيئة الإنتاج؛ أوقفنا التشغيل بدل تدوير الأسرار وإبطال الجلسات بصمت.');
const WebSession = mongoose.model('WebSession', new mongoose.Schema({
    sid: { type: String, required: true, unique: true },
    session: { type: mongoose.Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
}, { versionKey: false }));
class MongoSessionStore extends session.Store {
    get(sid, callback) {
        WebSession.findOne({ sid, expiresAt: { $gt: new Date() } }).lean()
            .then(doc => callback(null, doc?.session || null), callback);
    }
    set(sid, sessionData, callback) {
        const expiresAt = sessionData.cookie?.expires ? new Date(sessionData.cookie.expires) : new Date(Date.now() + (sessionData.cookie?.maxAge || 8 * 60 * 60 * 1000));
        WebSession.updateOne({ sid }, { $set: { session: sessionData, expiresAt } }, { upsert: true })
            .then(() => callback?.(null), error => callback?.(error));
    }
    touch(sid, sessionData, callback) {
        const expiresAt = sessionData.cookie?.expires ? new Date(sessionData.cookie.expires) : new Date(Date.now() + (sessionData.cookie?.maxAge || 8 * 60 * 60 * 1000));
        WebSession.updateOne({ sid }, { $set: { expiresAt } }).then(() => callback?.(null), error => callback?.(error));
    }
    destroy(sid, callback) { WebSession.deleteOne({ sid }).then(() => callback?.(null), error => callback?.(error)); }
}
app.use(session({
    name: 'drayz.sid',
    secret: sessionSecret,
    store: new MongoSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    if (req.session && !req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    const send = res.send.bind(res);
    res.send = body => {
        if (typeof body === 'string' && body.includes('<html')) {
            const token = escapeHtml(req.session?.csrfToken || '');
            body = body.replace('</head>', `<meta name="csrf-token" content="${token}"></head>`);
            body = body.replace(/<form\b([^>]*\bmethod\s*=\s*["']?post["']?[^>]*)>/gi, match => `${match}<input type="hidden" name="_csrf" value="${token}">`);
            body = body.replace('</body>', `<script>(()=>{const f=window.fetch.bind(window);window.fetch=(input,init={})=>{const method=String(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();const url=new URL(input instanceof Request?input.url:input,location.href);if(url.origin===location.origin&&method!=='GET'&&method!=='HEAD'){const h=new Headers(init.headers||(input instanceof Request?input.headers:undefined));h.set('X-CSRF-Token',document.querySelector('meta[name="csrf-token"]')?.content||'');init={...init,headers:h}}return f(input,init)}})();</script></body>`);
        }
        return send(body);
    };
    next();
});

const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
};

const checkBotGuildAccess = (req, res, next) => {
    if (!client.guilds.cache.has(req.params.guildId)) return res.status(404).send('البوت غير موجود في هذا السيرفر.');
    next();
};

const checkGuildAccess = async (req, res, next) => {
    try {
        const guild = client.guilds.cache.get(req.params.guildId);
        const userId = req.user?.id;
        if (!guild || !userId) return res.status(403).send('ليس لديك صلاحية إدارة هذا السيرفر.');
        if (guild.ownerId === userId) return next();
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member || (!member.permissions.has(PermissionFlagsBits.ManageGuild) && !member.permissions.has(PermissionFlagsBits.Administrator))) return res.status(403).send('تحتاج إلى صلاحية إدارة السيرفر أو Administrator حاليًا.');
        next();
    } catch (error) { console.error('[Guild Access Check Error]', error.message); res.status(503).send('تعذر التحقق من صلاحياتك الحالية؛ حاول مجددًا.'); }
};

function moderationTargetError(interaction, targetMember) {
    if (!targetMember) return 'العضو غير موجود في السيرفر.';
    if (targetMember.id === interaction.user.id) return 'لا يمكنك تنفيذ هذا الإجراء على نفسك.';
    if (targetMember.id === interaction.guild.ownerId && interaction.user.id !== interaction.guild.ownerId) return 'لا يمكن استهداف مالك السيرفر.';
    const actor = interaction.member;
    const isGuildOwner = interaction.user.id === interaction.guild.ownerId;
    const isAdministrator = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    if (!isGuildOwner && !isAdministrator && actor?.roles?.highest?.comparePositionTo(targetMember.roles.highest) <= 0) return 'رتبة العضو المستهدف يجب أن تكون أدنى من رتبتك.';
    const botMember = interaction.guild.members.me;
    if (!botMember || targetMember.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) return 'رتبة العضو المستهدف أعلى من رتبة البوت أو مساوية لها.';
    return null;
}

// Do not trust a logged-in Discord identity alone: every guild operation requires Manage Guild or Administrator.
const sameOriginAdminWrite = (req, res, next) => {
    const reject = message => {
        const files = [...(req.file ? [req.file] : []), ...Object.values(req.files || {}).flat()];
        Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {}))).finally(() => {
            if (!res.headersSent) res.status(403).send(message);
        });
    };
    const origin = req.get('origin') || req.get('referer');
    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite === 'cross-site') return reject('تم رفض الطلب لأسباب أمنية.');
    if (origin) {
        try {
            const source = new URL(origin);
            if (source.host !== req.get('host') || !['http:', 'https:'].includes(source.protocol)) return reject('تم رفض الطلب لأسباب أمنية.');
        } catch { return reject('مصدر الطلب غير صالح.'); }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        const supplied = req.get('x-csrf-token') || req.body?._csrf || '';
        const expected = req.session?.csrfToken || '';
        const a = Buffer.from(String(supplied));
        const b = Buffer.from(String(expected));
        if (!a.length || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return reject('انتهت صلاحية نموذج الأمان؛ حدّث الصفحة وحاول مجددًا.');
    }
    next();
};
app.use('/manage/:guildId', checkAuth, checkBotGuildAccess, checkGuildAccess);
app.use('/save/:guildId', checkAuth, checkBotGuildAccess, checkGuildAccess);
app.use('/delete-kick/:guildId', checkAuth, checkBotGuildAccess, checkGuildAccess, sameOriginAdminWrite);

app.get('/auth/discord', (req, res, next) => {
    req.session.oauthState = crypto.randomBytes(32).toString('hex');
    const state = req.session.oauthState;
    req.session.save(error => {
        if (error) return next(error);
        passport.authenticate('discord', { state })(req, res, next);
    });
});
app.get('/callback', (req, res, next) => {
    const expected = req.session?.oauthState;
    const received = String(req.query.state || '');
    delete req.session.oauthState;
    if (!expected || !received || expected !== received) return res.status(403).send('تعذر التحقق من جلسة تسجيل الدخول؛ ابدأ تسجيل الدخول من جديد.');
    passport.authenticate('discord', { failureRedirect: '/login' })(req, res, next);
}, (req, res, next) => {
    const authenticatedUser = req.user;
    req.session.regenerate(error => {
        if (error) return next(error);
        req.login(authenticatedUser, loginError => {
            if (loginError) return next(loginError);
            req.session.save(saveError => saveError ? next(saveError) : res.redirect('/dashboard'));
        });
    });
});

app.post('/logout', sameOriginAdminWrite, (req, res) => {
    req.logout(() => req.session.destroy(() => {
        res.clearCookie('drayz.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
        res.redirect('/login');
    }));
});

app.get('/login', (req, res) => {
    res.send(`<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#090c18">
<title>DRAYZ — بوابة الدخول</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark;--bg:#090c18;--panel:#11172a;--line:rgba(164,183,255,.15);--text:#f3f5ff;--muted:#8d96b4;--cyan:#62e8dc;--blue:#6e8cff;--violet:#b78aff;--pink:#ec8ed8}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:'Cairo',sans-serif;color:var(--text);background:var(--bg)}body{min-height:100vh;overflow-x:hidden}.ambient{position:fixed;inset:0;overflow:hidden;pointer-events:none;background:radial-gradient(ellipse at 14% 15%,rgba(83,112,255,.17),transparent 38%),radial-gradient(ellipse at 84% 83%,rgba(74,228,208,.11),transparent 34%),linear-gradient(140deg,#090c18,#0b1020 55%,#090d19)}.ambient:before,.ambient:after{content:'';position:absolute;width:70vw;height:70vw;max-width:900px;max-height:900px;border:1px solid rgba(131,158,255,.08);border-radius:50%;left:-20vw;top:-36vw;box-shadow:0 0 0 55px rgba(131,158,255,.018),0 0 0 115px rgba(131,158,255,.014),0 0 0 190px rgba(131,158,255,.01);animation:orbit 44s linear infinite}.ambient:after{width:46vw;height:46vw;left:auto;right:-15vw;top:auto;bottom:-23vw;border-color:rgba(98,232,220,.08);animation-duration:57s;animation-direction:reverse}.grain{position:fixed;inset:0;pointer-events:none;opacity:.12;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E")}.page{position:relative;z-index:1;min-height:100vh;max-width:1500px;margin:auto;padding:34px clamp(20px,5vw,74px);display:grid;grid-template-columns:minmax(0,1.12fr) minmax(370px,.88fr);gap:clamp(30px,7vw,108px);align-items:center}.story{position:relative;min-height:660px;display:flex;flex-direction:column;justify-content:space-between;padding:28px 2px}.brand{display:flex;gap:13px;align-items:center}.brand-mark{width:52px;height:52px;display:grid;place-items:center;border-radius:17px;color:#081219;background:linear-gradient(145deg,#aafaf0,#57d5e8 52%,#8297ff);box-shadow:0 12px 42px rgba(77,200,226,.23);font-size:20px;font-weight:900}.brand-name{font-weight:900;letter-spacing:2px;font-size:19px}.brand-name small{display:block;font:500 9px 'IBM Plex Mono',monospace;color:var(--muted);letter-spacing:2.2px;margin-top:3px}.story-copy{position:relative;z-index:2;padding:10px 0 36px}.eyebrow{display:inline-flex;align-items:center;gap:9px;color:#a4b5ff;font:600 10px 'IBM Plex Mono',monospace;letter-spacing:1.8px}.eyebrow i{width:7px;height:7px;border-radius:50%;background:var(--cyan);box-shadow:0 0 16px var(--cyan);animation:pulse 2.2s infinite}.story h1{max-width:690px;margin:20px 0 17px;font-size:clamp(48px,7vw,91px);line-height:1.13;letter-spacing:-3px;font-weight:900}.story h1 span{display:block;background:linear-gradient(100deg,#fff 3%,#9beee8 37%,#91a8ff 72%,#d6a0fa);background-clip:text;-webkit-background-clip:text;color:transparent}.story-copy>p{max-width:545px;color:#a4acc5;font-size:15px;line-height:2.1;margin:0}.feature-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:31px}.feature{display:flex;align-items:center;gap:9px;padding:10px 13px;border:1px solid var(--line);border-radius:13px;background:rgba(18,25,47,.58);backdrop-filter:blur(12px);color:#c8d0e9;font-size:10px}.feature svg{width:17px;height:17px;fill:none;stroke:var(--cyan);stroke-width:1.8}.visual{position:absolute;left:4%;bottom:1%;width:min(46vw,560px);height:300px;opacity:.93;perspective:900px;pointer-events:none}.orb{position:absolute;left:22%;top:10%;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#d9fff6 0,#72e5df 5%,#446bda 30%,#252353 59%,transparent 72%);filter:drop-shadow(0 0 45px rgba(92,165,255,.28));animation:float 7s ease-in-out infinite}.orbit-ring{position:absolute;left:7%;top:13%;width:390px;height:205px;border:1px solid rgba(112,231,222,.3);border-radius:50%;transform:rotate(-24deg);animation:spin 18s linear infinite}.orbit-ring.two{left:14%;top:0;width:340px;height:235px;border-color:rgba(148,147,255,.26);transform:rotate(35deg);animation-duration:26s;animation-direction:reverse}.node{position:absolute;width:9px;height:9px;border-radius:50%;background:#b6fff0;box-shadow:0 0 18px #67e9dc}.node.n1{left:14%;top:43%}.node.n2{left:74%;top:21%;background:#bca1ff;box-shadow:0 0 18px #a587ff}.node.n3{left:66%;top:77%;width:6px;height:6px}.visual-card{position:absolute;left:1%;bottom:12%;width:200px;padding:14px;border:1px solid rgba(154,183,255,.2);border-radius:17px;background:linear-gradient(145deg,rgba(21,31,58,.88),rgba(15,20,38,.7));backdrop-filter:blur(15px);transform:rotateY(13deg) rotateX(5deg);box-shadow:0 22px 70px rgba(0,0,0,.3);animation:float-card 6s ease-in-out infinite}.visual-card small{color:#8795b9;font:500 8px 'IBM Plex Mono',monospace;letter-spacing:1px}.visual-card strong{display:block;font-size:17px;margin:7px 0}.mini-bars{display:flex;align-items:end;gap:5px;height:39px}.mini-bars i{flex:1;border-radius:5px 5px 2px 2px;background:linear-gradient(0deg,#596dff,#71e6dc);animation:bars 1.4s ease-in-out infinite alternate}.mini-bars i:nth-child(1){height:45%}.mini-bars i:nth-child(2){height:75%;animation-delay:.1s}.mini-bars i:nth-child(3){height:55%;animation-delay:.2s}.mini-bars i:nth-child(4){height:94%;animation-delay:.3s}.mini-bars i:nth-child(5){height:66%;animation-delay:.4s}.story-foot{position:relative;z-index:2;color:#606b89;font:500 9px 'IBM Plex Mono',monospace;letter-spacing:1.6px}.auth-wrap{position:relative}.auth-card{position:relative;overflow:hidden;padding:clamp(28px,4vw,48px);border:1px solid rgba(171,190,255,.2);border-radius:29px;background:linear-gradient(145deg,rgba(22,29,53,.92),rgba(14,19,36,.9));box-shadow:0 35px 100px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.055);backdrop-filter:blur(24px);animation:card-in .8s cubic-bezier(.16,1,.3,1) both}.auth-card:before{content:'';position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,transparent,var(--cyan),#8292ff,var(--pink),transparent);background-size:220% 100%;animation:gradient 5s linear infinite}.auth-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:48px}.secure-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid rgba(98,232,220,.18);border-radius:999px;background:rgba(98,232,220,.055);color:#a6eae3;font:600 8px 'IBM Plex Mono',monospace;letter-spacing:1px}.secure-badge svg{width:14px;height:14px;stroke:currentColor;fill:none}.auth-kicker{color:#8d9aba;font:600 9px 'IBM Plex Mono',monospace;letter-spacing:1.7px}.auth-card h2{font-size:clamp(26px,3vw,36px);margin:0;letter-spacing:-.7px}.auth-card .intro{color:#919bb8;font-size:12px;line-height:2;margin:11px 0 30px}.discord-button{position:relative;isolation:isolate;overflow:hidden;min-height:62px;display:flex;justify-content:center;align-items:center;gap:13px;width:100%;border-radius:15px;text-decoration:none;color:#0c1422;background:linear-gradient(105deg,#9bf4e8,#66cde9 50%,#9da9ff);font-size:14px;font-weight:900;box-shadow:0 12px 38px rgba(85,203,224,.17);transition:transform .25s,box-shadow .25s,filter .25s}.discord-button:hover{transform:translateY(-3px);box-shadow:0 18px 45px rgba(85,203,224,.28);filter:saturate(1.12)}.discord-button:active{transform:scale(.99)}.discord-button:focus-visible{outline:3px solid #fff;outline-offset:4px}.discord-button svg{width:23px;height:23px;fill:currentColor}.button-arrow{position:absolute;left:17px;font-size:18px;transition:transform .2s}.discord-button:hover .button-arrow{transform:translateX(-4px)}.auth-divider{display:flex;align-items:center;gap:12px;color:#66718f;font:500 8px 'IBM Plex Mono',monospace;letter-spacing:1px;margin:24px 0}.auth-divider:before,.auth-divider:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(157,176,237,.17))}.auth-divider:after{transform:rotate(180deg)}.security-note{display:flex;align-items:flex-start;gap:11px;padding:14px;border-radius:13px;border:1px solid rgba(98,232,220,.1);background:rgba(98,232,220,.035);color:#8e9bb8;font-size:10px;line-height:1.9}.security-note svg{width:18px;height:18px;flex:none;stroke:#77e3d7;fill:none}.auth-footer{display:flex;justify-content:space-between;gap:12px;margin-top:28px;color:#606b88;font:500 8px 'IBM Plex Mono',monospace;letter-spacing:.7px}.auth-footer span:last-child{color:#8994b1}.spark{position:absolute;width:4px;height:4px;border-radius:50%;background:#b8fff4;box-shadow:0 0 15px #65e3dc;animation:sparkle 4s ease-in-out infinite}.spark.s1{left:8%;top:31%}.spark.s2{left:43%;top:14%;animation-delay:1.3s}.spark.s3{right:9%;bottom:22%;animation-delay:2.2s}@keyframes orbit{to{transform:rotate(360deg)}}@keyframes spin{to{transform:rotate(336deg)}}@keyframes float{50%{transform:translateY(-13px) scale(1.025)}}@keyframes float-card{50%{transform:translateY(-9px) rotateY(13deg) rotateX(5deg)}}@keyframes bars{to{filter:hue-rotate(30deg);opacity:.65}}@keyframes pulse{50%{opacity:.45;box-shadow:0 0 5px var(--cyan)}}@keyframes card-in{from{opacity:0;transform:translateY(20px) scale(.98);filter:blur(8px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}@keyframes gradient{to{background-position:220% 0}}@keyframes sparkle{50%{opacity:.2;transform:scale(.5)}}
@media(max-width:900px){.page{grid-template-columns:1fr;gap:8px;max-width:620px;padding-top:22px}.story{min-height:auto;padding:12px 0 0}.story-copy{padding:45px 0 20px}.story h1{font-size:clamp(43px,10vw,67px)}.story-copy>p{font-size:13px}.visual{display:none}.story-foot{display:none}.auth-wrap{padding-bottom:24px}.auth-top{margin-bottom:30px}}
@media(max-width:520px){.page{padding:16px 15px 26px}.brand-mark{width:43px;height:43px;border-radius:14px}.brand-name{font-size:16px}.story-copy{padding:36px 0 16px}.story h1{font-size:44px;letter-spacing:-1.8px}.story-copy>p{font-size:12px}.feature-row{gap:7px;margin-top:20px}.feature{padding:8px 9px;font-size:9px}.auth-card{padding:25px 21px;border-radius:22px}.auth-top{margin-bottom:30px}.auth-card h2{font-size:28px}.auth-card .intro{font-size:11px}.discord-button{min-height:57px;font-size:12px}.auth-footer{font-size:7px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
</style>
</head>
<body><div class="ambient"></div><div class="grain"></div><i class="spark s1"></i><i class="spark s2"></i><i class="spark s3"></i>
<main class="page"><section class="story"><div class="brand"><div class="brand-mark">D</div><div class="brand-name">DRAYZ SYSTEM<small>ADVANCED COMMUNITY CONTROL</small></div></div><div class="story-copy"><div class="eyebrow"><i></i> CONTROL CENTER · PRO BUILD</div><h1>إدارة أذكى.<span>مجتمع أقوى.</span></h1><p>كل أدوات سيرفرك في مساحة واحدة. تجربة مصممة لتكون سريعة وواضحة، من أول تسجيل دخول لحد آخر تفصيلة في مجتمعك.</p><div class="feature-row"><div class="feature"><svg viewBox="0 0 24 24"><path d="M12 3 20 7v5c0 4.5-3.2 7.5-8 9-4.8-1.5-8-4.5-8-9V7z"/><path d="m9 12 2 2 4-4"/></svg>إدارة وصلاحيات</div><div class="feature"><svg viewBox="0 0 24 24"><path d="M4 19V5m0 14h17"/><path d="m7 15 4-5 3 3 6-8"/></svg>إحصائيات مباشرة</div><div class="feature"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6"/></svg>أنظمة متكاملة</div></div><div class="visual"><div class="orbit-ring"></div><div class="orbit-ring two"></div><div class="orb"></div><i class="node n1"></i><i class="node n2"></i><i class="node n3"></i><div class="visual-card"><small>SERVER ACTIVITY</small><strong>نظامك تحت السيطرة</strong><div class="mini-bars"><i></i><i></i><i></i><i></i><i></i></div></div></div></div><div class="story-foot">SECURE BY DISCORD · DESIGNED FOR COMMUNITIES</div></section>
<section class="auth-wrap"><div class="auth-card"><div class="auth-top"><div class="brand"><div class="brand-mark" style="width:38px;height:38px;border-radius:12px;font-size:15px">D</div><div class="brand-name" style="font-size:14px">DRAYZ<small>PRO ACCESS</small></div></div><span class="secure-badge"><svg viewBox="0 0 24 24"><path d="M12 3 20 7v5c0 4.5-3.2 7.5-8 9-4.8-1.5-8-4.5-8-9V7z"/><path d="m9 12 2 2 4-4"/></svg>SECURE GATEWAY</span></div><div class="auth-kicker">IDENTITY VERIFICATION / 01</div><h2>أهلًا بعودتك</h2><p class="intro">سجّل دخولك باستخدام Discord لعرض السيرفرات التي تملك صلاحية إدارتها والوصول إلى أدوات التحكم.</p><a href="/auth/discord" class="discord-button"><svg viewBox="0 0 24 24"><path d="M19.54 5.04A16.9 16.9 0 0 0 15.4 3.75l-.52 1.06a15.2 15.2 0 0 0-5.76 0L8.6 3.75a16.9 16.9 0 0 0-4.14 1.29C1.84 8.94 1.13 12.86 1.49 16.73a16.8 16.8 0 0 0 5.06 2.57l1.23-1.67c-.68-.26-1.33-.58-1.94-.96l.47-.36c3.74 1.75 7.8 1.75 11.49 0l.48.36c-.62.38-1.27.7-1.95.96l1.23 1.67a16.8 16.8 0 0 0 5.06-2.57c.42-4.49-.72-8.37-3.08-11.69ZM8.24 15.23c-1.12 0-2.04-1.03-2.04-2.3s.9-2.3 2.04-2.3c1.14 0 2.05 1.03 2.04 2.3 0 1.27-.9 2.3-2.04 2.3Zm7.52 0c-1.12 0-2.04-1.03-2.04-2.3s.9-2.3 2.04-2.3c1.14 0 2.05 1.03 2.04 2.3 0 1.27-.9 2.3-2.04 2.3Z"/></svg><span>المتابعة عبر Discord</span><b class="button-arrow">←</b></a><div class="auth-divider">FAST · VERIFIED · PRIVATE</div><div class="security-note"><svg viewBox="0 0 24 24"><path d="M12 3 20 7v5c0 4.5-3.2 7.5-8 9-4.8-1.5-8-4.5-8-9V7z"/><path d="m9 12 2 2 4-4"/></svg><span>المصادقة تتم عبر Discord الرسمي. لا نطلب كلمة مرورك أو رمز التحقق داخل هذه اللوحة.</span></div><footer class="auth-footer"><span>DRAYZ SYSTEM / 2026</span><span>AUTH STATUS: ENCRYPTED</span></footer></div></section></main></body></html>`);
});

app.get('/ping', (req, res) => res.send('I am alive!'));
app.get('/', (req, res) => res.redirect('/dashboard'));

// ==========================================
// 8. UI Helper Function
// ==========================================
function ui(guild, active, content) {
    const guildId = guild?.id || '';
    const guildName = guild?.name || 'مساحة الإدارة';
    const safe = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
    const nav = guildId ? [
        ['home', 'نظرة عامة', `/manage/${guildId}/home`, '<path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>'],
        ['security', 'الحماية', `/manage/${guildId}/security`, '<path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/>'],
        ['admincmd', 'اختصارات الإدارة', `/manage/${guildId}/admincmd`, '<path d="M12 3v3M12 18v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="4"/>'],
        ['kick', 'تنبيهات Kick', `/manage/${guildId}/kick`, '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'],
        ['suggestions', 'الاقتراحات', `/manage/${guildId}/suggestions`, '<path d="M20 11a7 7 0 0 1-7 7H8l-4 3v-6a7 7 0 1 1 16-4z"/>'],
        ['logs', 'السجلات', `/manage/${guildId}/logs`, '<path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6M9 7h3"/>'],
        ['tickets', 'التذاكر', `/manage/${guildId}/tickets`, '<path d="M4 7h16v10H4z"/><path d="M8 7v10M16 7v10"/>'],
        ['autoreply', 'الردود الآلية', `/manage/${guildId}/autoreply`, '<path d="M4 5h16v11H8l-4 3z"/><path d="M8 9h8M8 12h5"/>'],
        ['levels', 'نظام المستويات', `/manage/${guildId}/levels`, '<path d="M5 19V9M12 19V5M19 19v-8"/>'],
        ['welcome', 'الترحيب', `/manage/${guildId}/welcome`, '<path d="M12 21s-8-4.5-8-10V5l8-3 8 3v6c0 5.5-8 10-8 10z"/><path d="m9 12 2 2 4-4"/>'],
        ['giveaway', 'الهدايا', `/manage/${guildId}/giveaway`, '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7H8a2 2 0 1 1 2-2c2 0 2 2 2 2z"/>'],
        ['notificationroles', 'رتب الإشعارات', `/manage/${guildId}/notificationroles`, '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/><circle cx="18" cy="5" r="3"/>'],
        
    ] : [];
    const navHtml = nav.map(([key, label, href, path]) => `<a class="rail-link ${active === key ? 'is-active' : ''}" href="${href}" aria-current="${active === key ? 'page' : 'false'}"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg><span>${label}</span><i></i></a>`).join('');
    return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safe(guildName)} · Drayz System</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#0c0b09;--panel:#15120e;--panel-2:#1b1711;--panel-3:#231d15;--line:rgba(244,194,76,.15);--line-strong:rgba(244,194,76,.34);--gold:#f4c24c;--gold-2:#b57b19;--red:#e14d43;--red-soft:rgba(225,77,67,.14);--muted:#918a7c;--text:#f5f0e6;--shadow:0 22px 70px rgba(0,0,0,.28);--rail:272px}
*{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:var(--gold-2) #0f0d0a}*::-webkit-scrollbar{width:9px;height:9px}*::-webkit-scrollbar-track{background:#0f0d0a;border-radius:12px}*::-webkit-scrollbar-thumb{background:linear-gradient(180deg,var(--gold),var(--gold-2));border:2px solid #0f0d0a;border-radius:12px}*::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#ffe08a,var(--gold))}*::-webkit-scrollbar-button{display:none;width:0;height:0}html{background:var(--ink);overflow-x:hidden}body{margin:0;background:radial-gradient(circle at 15% 8%,rgba(244,194,76,.06),transparent 28%),radial-gradient(circle at 90% 80%,rgba(225,77,67,.05),transparent 24%),var(--ink);color:var(--text);font-family:'Cairo',sans-serif;min-height:100vh}body:before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.22;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom,#000,transparent 88%)}a{color:inherit}.app{min-height:100vh}.rail{position:fixed;z-index:20;inset:0 0 0 auto;width:var(--rail);padding:24px 16px 18px;background:linear-gradient(180deg,rgba(24,19,13,.98),rgba(12,11,9,.98));border-left:1px solid var(--line);display:flex;flex-direction:column;box-shadow:-16px 0 50px rgba(0,0,0,.16)}.brand{display:flex;align-items:center;gap:11px;padding:4px 9px 23px;border-bottom:1px solid var(--line)}.brand-mark{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(145deg,var(--gold),var(--gold-2));color:#161007;font-size:18px;font-weight:900;box-shadow:0 10px 25px rgba(244,194,76,.18)}.brand strong{display:block;font-size:19px;letter-spacing:2px;line-height:1}.brand small{display:block;color:var(--muted);font-size:9px;letter-spacing:2px;margin-top:5px;font-family:'IBM Plex Mono',monospace}.rail-section{color:#756d61;font:600 10px 'IBM Plex Mono',monospace;letter-spacing:1px;margin:25px 10px 9px;text-transform:uppercase}.rail-nav{display:flex;flex-direction:column;gap:4px;overflow:auto;padding:2px 3px 10px 2px;scrollbar-width:thin;scrollbar-color:var(--gold-2) transparent}.rail-nav::-webkit-scrollbar{width:6px}.rail-nav::-webkit-scrollbar-track{background:transparent}.rail-nav::-webkit-scrollbar-thumb{border:0;background:linear-gradient(180deg,var(--gold),var(--gold-2))}.rail-nav::-webkit-scrollbar-button{display:none}.rail-link{min-height:43px;display:flex;align-items:center;gap:12px;padding:9px 11px;border:1px solid transparent;border-radius:12px;text-decoration:none;color:#a59c8d;font-size:12px;font-weight:600;transition:.2s ease}.rail-link svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}.rail-link i{width:5px;height:5px;border-radius:50%;margin-right:auto;background:transparent}.rail-link:hover{background:rgba(244,194,76,.07);color:var(--text);transform:translateX(-3px)}.rail-link.is-active{background:linear-gradient(90deg,rgba(244,194,76,.16),rgba(244,194,76,.045));border-color:var(--line);color:var(--gold);box-shadow:inset -3px 0 var(--gold)}.rail-link.is-active i{background:var(--gold);box-shadow:0 0 12px var(--gold)}.rail-footer{margin-top:auto;padding:15px 10px 0;border-top:1px solid var(--line);color:var(--muted);font-size:10px}.rail-footer a{color:var(--red);text-decoration:none;float:left}.workspace{margin-right:var(--rail);min-width:0}.topbar{height:78px;padding:0 42px;display:flex;align-items:center;gap:18px;border-bottom:1px solid var(--line);background:rgba(12,11,9,.72);backdrop-filter:blur(18px);position:sticky;top:0;z-index:10}.menu-btn{display:none;border:1px solid var(--line);background:var(--panel);color:var(--gold);border-radius:11px;width:42px;height:42px;font-size:20px}.crumb{color:var(--muted);font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.5px}.crumb b{display:block;color:var(--text);font:700 18px 'Cairo',sans-serif;margin-top:2px}.top-status{margin-right:auto;display:flex;align-items:center;gap:8px;color:#b4ad9f;font-size:11px}.status-dot{width:7px;height:7px;border-radius:50%;background:#48c774;box-shadow:0 0 12px #48c774}.top-actions{display:flex;gap:8px}.top-actions a{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--line);border-radius:10px;color:var(--muted);text-decoration:none;background:rgba(255,255,255,.015)}.top-actions a:hover{color:var(--gold);border-color:var(--line-strong)}.content{padding:38px 42px 60px;max-width:1500px;margin:auto}.welcome-strip{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:30px;padding:31px 34px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(110deg,rgba(244,194,76,.11),rgba(23,18,12,.88) 45%),var(--panel);box-shadow:var(--shadow);position:relative;overflow:hidden}.welcome-strip:after{content:'D';position:absolute;left:27px;top:-42px;color:rgba(244,194,76,.055);font:900 180px 'IBM Plex Mono',monospace}.eyebrow{color:var(--gold);font:600 10px 'IBM Plex Mono',monospace;letter-spacing:1.5px;text-transform:uppercase}.welcome-strip h1{margin:8px 0 3px;font-size:29px;letter-spacing:-.5px}.welcome-strip p{margin:0;color:var(--muted);font-size:12px}.welcome-meta{position:relative;z-index:1;text-align:left;color:var(--muted);font:500 10px 'IBM Plex Mono',monospace}.view{min-width:0}.card{background:linear-gradient(145deg,rgba(35,29,21,.88),rgba(18,15,11,.92));border:1px solid var(--line);border-radius:18px;padding:25px;margin-bottom:20px;box-shadow:0 12px 40px rgba(0,0,0,.14)}.card:hover{border-color:var(--line-strong)}.card h3{display:flex;align-items:center;gap:10px;margin:0 0 20px;font-size:16px;color:var(--text)}.card h3 svg{width:19px;color:var(--gold)}label{display:block;color:#b6ad9d;font-size:12px;margin:15px 0 7px}input,select,textarea{width:100%;padding:12px 14px;color:var(--text);background:#0f0d0a;border:1px solid rgba(255,255,255,.09);border-radius:10px;outline:0;font:500 13px 'Cairo',sans-serif;transition:.2s}input:focus,select:focus,textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(244,194,76,.1)}textarea{min-height:105px;resize:vertical}.btn-save{border:0;border-radius:10px;padding:12px 21px;background:linear-gradient(135deg,var(--gold),var(--gold-2));color:#171006;font:800 12px 'Cairo',sans-serif;cursor:pointer;box-shadow:0 8px 20px rgba(244,194,76,.12);transition:.2s}.btn-save:hover{transform:translateY(-2px);filter:brightness(1.08)}.btn-danger{background:var(--red)!important;color:#fff!important}.tag{display:inline-flex;align-items:center;border-radius:20px;padding:4px 9px;font-size:10px}.tag-blue{background:rgba(244,194,76,.12);color:var(--gold);border:1px solid var(--line)}.tag-red{background:var(--red-soft);color:#f0837b;border:1px solid rgba(225,77,67,.2)}.data-table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid var(--line);border-radius:13px;font-size:12px}.data-table th{background:rgba(244,194,76,.07);color:var(--gold);font-size:10px;text-align:right;padding:13px}.data-table td{padding:13px;border-top:1px solid rgba(255,255,255,.055);color:#c8c0b2}.data-table-wrap{overflow:auto}.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.stat-box{padding:20px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.018)}.stat-num{color:var(--gold);font:800 28px 'IBM Plex Mono',monospace}.stat-label{color:var(--muted);font-size:11px;margin-top:5px}.guild-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}.guild-card{padding:21px;border:1px solid var(--line);border-radius:17px;background:var(--panel);transition:.2s}.guild-card:hover{transform:translateY(-4px);border-color:var(--gold)}.guild-icon{width:48px;height:48px;border-radius:14px;object-fit:cover;margin-bottom:14px}.guild-card h3{margin:0 0 12px;font-size:15px}.toggle-row{display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.06)}.toggle-row input[type=checkbox]{width:19px;height:19px;accent-color:var(--gold)}.drawer-backdrop{display:none}.welcome-strip,.card,.stat-box,.guild-card{animation:rise-in .55s cubic-bezier(.2,.75,.25,1) both}.card:nth-of-type(2){animation-delay:.06s}.card:nth-of-type(3){animation-delay:.12s}.welcome-strip{isolation:isolate}.welcome-strip:before{content:'';position:absolute;inset:-1px;z-index:-1;border-radius:inherit;background:linear-gradient(110deg,transparent 25%,rgba(244,194,76,.12),transparent 70%);transform:translateX(-110%);animation:glint 1.3s .3s ease-out both}.rail-link,.btn-save,.top-actions a,.stat-box,.guild-card{will-change:transform}.stat-box{transition:transform .22s,border-color .22s,background .22s}.stat-box:hover{transform:translateY(-4px);border-color:var(--line-strong);background:rgba(244,194,76,.045)}.icon-badge{width:42px;height:42px;display:grid;place-items:center;border:1px solid var(--line-strong);border-radius:13px;background:rgba(244,194,76,.08);color:var(--gold);flex:none}.icon-badge svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.pro-pill{display:inline-flex;align-items:center;gap:6px;margin-top:7px;padding:4px 8px;border:1px solid rgba(244,194,76,.38);border-radius:999px;color:#ffdc7b;background:linear-gradient(100deg,rgba(244,194,76,.12),rgba(244,194,76,.035));font:700 8px 'IBM Plex Mono',monospace;letter-spacing:1.4px;box-shadow:0 0 18px rgba(244,194,76,.09);animation:pro-glow 3s ease-in-out infinite}.pro-pill i{width:5px;height:5px;border-radius:50%;background:#77e6a1;box-shadow:0 0 10px #77e6a1}.pro-ribbon{position:relative;z-index:1;display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:6px 10px;border:1px solid rgba(244,194,76,.27);border-radius:8px;color:#efd594;background:rgba(244,194,76,.055);font:600 9px 'IBM Plex Mono',monospace;letter-spacing:1px}.pro-ribbon svg{width:13px;height:13px;stroke:currentColor;fill:none}.top-status{padding:7px 11px;border:1px solid rgba(244,194,76,.12);border-radius:999px;background:rgba(244,194,76,.035)}@keyframes pro-glow{50%{box-shadow:0 0 24px rgba(244,194,76,.2);border-color:rgba(244,194,76,.6)}}@keyframes rise-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes glint{to{transform:translateX(110%)}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
@media(max-width:950px){:root{--rail:245px}.content{padding:28px 24px}.topbar{padding:0 24px}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.rail{transform:translateX(110%);transition:transform .25s ease;width:min(300px,88vw);box-shadow:-25px 0 80px rgba(0,0,0,.5)}.rail.is-open{transform:translateX(0)}.workspace{margin-right:0}.menu-btn{display:block}.topbar{height:67px;padding:0 15px}.top-status,.top-actions a:first-child{display:none}.crumb b{font-size:15px}.content{padding:18px 13px 35px}.welcome-strip{display:block;padding:22px 20px}.welcome-strip h1{font-size:23px}.welcome-meta{text-align:right;margin-top:16px}.stats-grid{grid-template-columns:1fr 1fr;gap:9px}.stat-box{padding:15px}.stat-num{font-size:21px}.card{padding:18px 14px;border-radius:14px}.drawer-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:15}.drawer-backdrop.is-open{display:block}}

:root{color-scheme:dark;scroll-behavior:smooth}body{isolation:isolate;position:relative}body:after{content:"";position:fixed;z-index:-1;inset:-25%;pointer-events:none;background:radial-gradient(ellipse at 22% 28%,rgba(244,194,76,.065),transparent 28%),radial-gradient(ellipse at 80% 65%,rgba(80,104,255,.045),transparent 27%),radial-gradient(ellipse at 56% 100%,rgba(225,77,67,.035),transparent 30%);filter:blur(10px);animation:ambient-flow 26s ease-in-out infinite alternate}.workspace{animation:workspace-in .65s cubic-bezier(.2,.75,.25,1) both}.view{animation:view-in .48s .08s ease-out both}.brand-mark{position:relative;isolation:isolate;overflow:hidden}.brand-mark:after{content:"";position:absolute;inset:-80%;background:linear-gradient(110deg,transparent 40%,rgba(255,255,255,.55),transparent 60%);transform:translateX(-70%) rotate(25deg);animation:brand-sweep 5s ease-in-out infinite}.rail-link svg{transition:transform .25s cubic-bezier(.2,.8,.2,1),filter .25s}.rail-link:hover svg{transform:scale(1.12) rotate(-5deg);filter:drop-shadow(0 0 6px rgba(244,194,76,.45))}.rail-link.is-active svg{filter:drop-shadow(0 0 6px rgba(244,194,76,.35))}.topbar{transition:background .25s,border-color .25s}.top-status{position:relative;overflow:hidden}.top-status:after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 15%,rgba(244,194,76,.09),transparent 80%);transform:translateX(-110%);animation:glint 2s 1.2s ease-out both}.card{transition:transform .24s ease,border-color .24s,box-shadow .24s}.card:hover{transform:translateY(-2px);box-shadow:0 18px 52px rgba(0,0,0,.22),0 0 24px rgba(244,194,76,.035)}.data-table tbody tr{transition:background .18s}.data-table tbody tr:hover{background:rgba(244,194,76,.035)}.btn-save:focus-visible,.rail-link:focus-visible,.top-actions button:focus-visible,.top-actions a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--gold);outline-offset:3px}.btn-save:not(:disabled):active{transform:translateY(1px) scale(.985)}button:disabled{opacity:.72;cursor:wait}.guild-card{position:relative;overflow:hidden}.guild-card:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 25%,rgba(244,194,76,.08),transparent 70%);transform:translateX(-130%);transition:transform .6s}.guild-card:hover:after{transform:translateX(130%)}.pro-ribbon{backdrop-filter:blur(9px)}@keyframes ambient-flow{to{transform:translate3d(2%, -2%,0) scale(1.04)}}@keyframes workspace-in{from{opacity:.35;filter:blur(4px)}to{opacity:1;filter:blur(0)}}@keyframes view-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes brand-sweep{0%,68%,100%{transform:translateX(-70%) rotate(25deg)}82%{transform:translateX(70%) rotate(25deg)}}@media(max-width:700px){.card:hover{transform:none}.workspace{animation-duration:.4s}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}body:after,.workspace,.view,.brand-mark:after,.top-status:after{animation:none!important}.card,.rail-link svg{transition:none!important}}
.admin-shortcut-row{display:grid;grid-template-columns:1.1fr .65fr .9fr 1.15fr;align-items:center;gap:12px;padding:13px 14px;margin:9px 0;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.018)}.admin-shortcut-row strong,.admin-shortcut-row small{display:block}.admin-shortcut-row strong{font-size:12px}.admin-shortcut-row small{color:var(--muted);font-size:10px}.admin-shortcut-row label,.admin-role-option{display:flex;align-items:center;gap:7px;margin:0;font-size:11px;color:#b6ad9d}.admin-shortcut-row input[type=checkbox],.admin-role-option input{width:16px;height:16px;accent-color:var(--gold)}.admin-role-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.admin-role-option{padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.015)}@media(max-width:850px){.admin-shortcut-row{grid-template-columns:1fr 1fr}.admin-shortcut-row>div{grid-column:1/-1}}@media(max-width:520px){.admin-shortcut-row{grid-template-columns:1fr}.admin-shortcut-row>div{grid-column:auto}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}

/* DRAYZ NEXUS — visual system v4 */
:root{color-scheme:dark;--ink:#090c18;--panel:#11172a;--panel-2:#151d34;--panel-3:#1c2742;--line:rgba(153,177,255,.14);--line-strong:rgba(113,227,222,.42);--gold:#6fe1d5;--gold-2:#718bff;--red:#ff668a;--red-soft:rgba(255,102,138,.12);--muted:#8e99b8;--text:#f3f5ff;--shadow:0 24px 75px rgba(0,0,0,.3);--rail:286px}
html{background:#090c18}body{background:radial-gradient(ellipse at 18% 4%,rgba(92,112,255,.1),transparent 31%),radial-gradient(ellipse at 85% 85%,rgba(69,213,202,.075),transparent 30%),#090c18;color:var(--text)}body:before{opacity:.18;background-image:linear-gradient(rgba(155,178,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(155,178,255,.035) 1px,transparent 1px);background-size:52px 52px;mask-image:linear-gradient(to bottom,#000,transparent 92%)}body:after{background:radial-gradient(ellipse at 22% 28%,rgba(93,126,255,.105),transparent 31%),radial-gradient(ellipse at 80% 65%,rgba(71,225,214,.08),transparent 29%),radial-gradient(ellipse at 56% 100%,rgba(185,126,255,.06),transparent 30%);filter:blur(18px);animation:ambient-flow 30s ease-in-out infinite alternate}
.rail{padding:25px 17px 19px;background:linear-gradient(180deg,rgba(17,23,42,.985),rgba(9,12,24,.99));border-left:1px solid rgba(153,177,255,.12);box-shadow:-20px 0 65px rgba(0,0,0,.22);backdrop-filter:blur(25px)}.brand{padding:4px 10px 25px;border-bottom-color:rgba(153,177,255,.12)}.brand-mark{width:43px;height:43px;border-radius:15px;color:#0b1320;background:linear-gradient(145deg,#b1fff4,#64d7e5 52%,#788aff);box-shadow:0 12px 27px rgba(89,209,218,.2)}.brand strong{letter-spacing:1.3px}.brand small{color:#7885a7;letter-spacing:1.5px}.rail-section{color:#687595}.rail-nav{scrollbar-color:#687eff transparent}.rail-link{min-height:45px;border-radius:13px;color:#9ba7c7}.rail-link:hover{background:rgba(116,140,255,.09);color:#f2f5ff;transform:translateX(-4px)}.rail-link.is-active{background:linear-gradient(105deg,rgba(111,225,213,.13),rgba(113,139,255,.12));border-color:rgba(111,225,213,.2);color:#8dece0;box-shadow:inset -3px 0 #6fe1d5,0 8px 24px rgba(38,92,112,.12)}.rail-link.is-active i{background:#6fe1d5;box-shadow:0 0 13px #6fe1d5}.rail-footer{border-top-color:rgba(153,177,255,.12)}.rail-footer a{color:#ff819d}
.workspace{margin-right:var(--rail)}.topbar{height:80px;padding:0 clamp(20px,3.3vw,52px);border-bottom-color:rgba(153,177,255,.11);background:rgba(9,12,24,.76);box-shadow:0 10px 35px rgba(0,0,0,.08);backdrop-filter:blur(24px)}.crumb{color:#7d89a9}.crumb b{font-size:17px}.top-status{border:1px solid rgba(111,225,213,.16);background:rgba(111,225,213,.045);color:#aeb9d4}.status-dot{background:#6fe1d5;box-shadow:0 0 13px #6fe1d5}.top-actions a{border-color:rgba(153,177,255,.15);border-radius:12px;background:rgba(255,255,255,.025);color:#a1aed0}.top-actions a:hover{color:#8dece0;border-color:rgba(111,225,213,.4);background:rgba(111,225,213,.06)}
.content{padding:clamp(22px,3.2vw,46px) clamp(15px,3.2vw,48px) 70px;max-width:1600px}.welcome-strip{min-height:155px;padding:30px 34px;border-color:rgba(153,177,255,.16);border-radius:24px;background:linear-gradient(112deg,rgba(103,126,255,.16),rgba(18,26,48,.9) 49%,rgba(40,173,164,.08)),var(--panel);box-shadow:0 24px 68px rgba(0,0,0,.22)}.welcome-strip:after{content:'✦';left:34px;top:-32px;color:rgba(126,154,255,.09);font:900 185px 'Cairo',sans-serif}.welcome-strip h1{font-size:clamp(24px,3vw,34px)}.eyebrow{color:#8ee7df}.welcome-strip p{color:#929dbb}.welcome-meta{color:#98a5c5}.pro-ribbon{border-color:rgba(111,225,213,.2);color:#b4f3e9;background:rgba(111,225,213,.055);border-radius:999px}.pro-ribbon svg{color:#6fe1d5}.card{position:relative;background:linear-gradient(145deg,rgba(22,30,53,.94),rgba(14,19,36,.97));border-color:rgba(153,177,255,.14);border-radius:20px;box-shadow:0 15px 48px rgba(0,0,0,.18)}.card:hover{border-color:rgba(111,225,213,.27)}.card h3{color:#eef1ff}.card h3 svg{color:#80e8df}.label,label{color:#a9b3d0}input,select,textarea{color:#f0f3ff;background:rgba(7,11,24,.76);border-color:rgba(153,177,255,.16);border-radius:12px}input:focus,select:focus,textarea:focus{border-color:#6fe1d5;box-shadow:0 0 0 3px rgba(111,225,213,.1)}input::placeholder,textarea::placeholder{color:#687595}.btn-save{background:linear-gradient(110deg,#9af4e5,#61d3dc 48%,#8997ff);color:#0a1322;border-radius:12px;box-shadow:0 10px 28px rgba(74,190,202,.15)}.btn-save:hover{box-shadow:0 15px 35px rgba(74,190,202,.24)}.btn-danger{background:linear-gradient(115deg,#ff839e,#ed547b)!important;color:#210814!important}.tag-blue{background:rgba(111,225,213,.08);color:#9aefe4;border-color:rgba(111,225,213,.18)}.tag-red{background:rgba(255,102,138,.09);color:#ff9db3;border-color:rgba(255,102,138,.2)}.data-table{border-color:rgba(153,177,255,.13);border-radius:15px}.data-table th{background:rgba(116,140,255,.09);color:#aebaff}.data-table td{border-top-color:rgba(153,177,255,.08);color:#c3cbe0}.data-table tbody tr:hover{background:rgba(111,225,213,.035)}.stats-grid{gap:15px}.stat-box{position:relative;overflow:hidden;border-color:rgba(153,177,255,.13);border-radius:17px;background:linear-gradient(135deg,rgba(28,38,68,.72),rgba(17,23,42,.52))}.stat-box:after{content:'';position:absolute;width:80px;height:80px;left:-27px;bottom:-43px;border:1px solid rgba(111,225,213,.16);border-radius:50%;box-shadow:0 0 0 14px rgba(111,225,213,.018),0 0 0 29px rgba(111,225,213,.012)}.stat-num{color:#82e8dd}.stat-label{color:#929dbb}.stat-box:hover{border-color:rgba(111,225,213,.34);background:rgba(111,225,213,.04)}.icon-badge{border-color:rgba(111,225,213,.26);border-radius:14px;background:linear-gradient(145deg,rgba(111,225,213,.12),rgba(113,139,255,.1));color:#8dece0}.pro-pill{border-color:rgba(111,225,213,.24);color:#b5f3ea;background:linear-gradient(100deg,rgba(111,225,213,.1),rgba(113,139,255,.06));box-shadow:0 0 20px rgba(111,225,213,.06)}.pro-pill i{background:#6fe1d5;box-shadow:0 0 11px #6fe1d5}.top-status:after{background:linear-gradient(100deg,transparent 15%,rgba(111,225,213,.12),transparent 80%)}
.server-selection .rail{display:none}.server-selection .workspace{margin-right:0}.server-selection .topbar{padding-inline:clamp(20px,5vw,74px)}.server-selection .content{max-width:1440px}
/* Full-width server discovery */
.server-picker{position:relative;overflow:hidden;margin:0 0 24px;padding:clamp(24px,4vw,46px);border:1px solid rgba(153,177,255,.16);border-radius:27px;background:radial-gradient(ellipse at 8% 0%,rgba(113,139,255,.18),transparent 40%),radial-gradient(ellipse at 100% 100%,rgba(111,225,213,.095),transparent 35%),linear-gradient(135deg,rgba(19,27,49,.96),rgba(13,18,34,.96));box-shadow:0 25px 80px rgba(0,0,0,.24)}.server-picker:after{content:'NEXUS';position:absolute;left:2%;bottom:-48px;color:rgba(171,189,255,.025);font:900 clamp(80px,15vw,190px) 'IBM Plex Mono',monospace;letter-spacing:-12px;pointer-events:none}.server-picker-top{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.server-picker h1{font-size:clamp(28px,4vw,43px);line-height:1.25;margin:9px 0 8px;letter-spacing:-1px}.server-picker p{margin:0;color:#94a0bf;font-size:12px;line-height:1.9}.server-count{flex:none;min-width:116px;padding:14px 17px;border:1px solid rgba(111,225,213,.19);border-radius:17px;background:rgba(111,225,213,.055);text-align:center}.server-count b{display:block;color:#9af1e5;font:700 25px 'IBM Plex Mono',monospace}.server-count small{color:#8694b6;font-size:9px}.server-tools{position:relative;z-index:1;display:flex;align-items:center;gap:12px;margin-top:26px}.server-search-wrap{position:relative;flex:1}.server-search-wrap svg{position:absolute;right:17px;top:50%;width:18px;height:18px;transform:translateY(-50%);stroke:#7d8aac;fill:none;stroke-width:1.8}.server-search-wrap input{height:51px;padding-right:47px;border-radius:15px;background:rgba(7,11,24,.66)}.server-sort{width:165px;height:51px;margin:0}.server-grid{position:relative;display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:17px}.server-card{position:relative;isolation:isolate;overflow:hidden;min-height:186px;padding:20px;border:1px solid rgba(153,177,255,.14);border-radius:20px;background:linear-gradient(150deg,rgba(24,33,59,.92),rgba(14,20,38,.97));text-decoration:none;box-shadow:0 14px 38px rgba(0,0,0,.13);transition:transform .28s cubic-bezier(.2,.8,.2,1),border-color .28s,box-shadow .28s}.server-card:before{content:'';position:absolute;z-index:-1;inset:0;background:radial-gradient(circle at 5% 3%,rgba(113,139,255,.17),transparent 43%);opacity:.75;transition:opacity .25s}.server-card:after{content:'';position:absolute;z-index:-1;left:-60%;top:-70%;width:90%;height:240%;transform:rotate(25deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.055),transparent);transition:left .6s}.server-card:hover{transform:translateY(-7px);border-color:rgba(111,225,213,.42);box-shadow:0 25px 60px rgba(0,0,0,.28),0 0 26px rgba(87,216,205,.055)}.server-card:hover:after{left:120%}.server-card-head{display:flex;align-items:center;gap:14px}.server-icon-wrap{position:relative;width:59px;height:59px;flex:none}.server-icon{width:59px;height:59px;border-radius:19px;object-fit:cover;border:1px solid rgba(171,190,255,.2);box-shadow:0 9px 25px rgba(0,0,0,.24)}.server-icon-fallback{display:grid;place-items:center;background:linear-gradient(145deg,#273a67,#193d4f);color:#a5f4eb;font-size:22px;font-weight:900}.server-online{position:absolute;right:-3px;bottom:-3px;width:13px;height:13px;border:3px solid #12192d;border-radius:50%;background:#6fe1d5;box-shadow:0 0 10px rgba(111,225,213,.5)}.server-title{min-width:0;flex:1}.server-title h2{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0;color:#f1f3ff;font-size:15px;font-weight:800}.server-title small{display:block;margin-top:4px;color:#8491b1;font:500 8px 'IBM Plex Mono',monospace;letter-spacing:1px}.server-member-count{display:flex;align-items:center;gap:7px;margin:20px 0 17px;color:#96a1bd;font-size:10px}.server-member-count svg{width:16px;height:16px;stroke:#83e5dc;fill:none;stroke-width:1.7}.server-open{display:flex;justify-content:space-between;align-items:center;padding-top:13px;border-top:1px solid rgba(153,177,255,.1);color:#b8c4e2;font-size:10px;font-weight:700}.server-open i{font-style:normal;color:#83ebe0;font-size:16px;transition:transform .2s}.server-card:hover .server-open i{transform:translateX(-5px)}.server-empty{grid-column:1/-1;text-align:center;padding:45px 20px;border:1px dashed rgba(153,177,255,.2);border-radius:20px;background:rgba(17,23,42,.55)}.server-empty svg{width:42px;height:42px;stroke:#8295c1;fill:none}.server-empty h2{font-size:17px}.server-empty p{color:#8c98b6;font-size:11px}.server-empty[hidden]{display:none!important}.server-no-results{display:none;text-align:center;padding:36px;color:#95a0bd}
.admin-shortcut-row{background:linear-gradient(120deg,rgba(28,38,68,.5),rgba(17,23,42,.35))!important;border-color:rgba(153,177,255,.12)!important;border-radius:16px!important;padding:16px!important}.admin-shortcut-row>div strong{color:#f0f3ff}.admin-shortcut-row>div small{display:block;color:#8492b4}.admin-role-option{border:1px solid rgba(153,177,255,.12);border-radius:11px;padding:9px 12px;background:rgba(255,255,255,.018)}
@keyframes ambient-flow{to{transform:translate3d(1.2%,-1%,0) scale(1.035)}}@keyframes brand-sweep{0%,65%{transform:translateX(-80%) rotate(25deg)}100%{transform:translateX(80%) rotate(25deg)}}
@media(max-width:950px){:root{--rail:248px}.content{padding:26px 22px}.server-grid{grid-template-columns:repeat(auto-fill,minmax(235px,1fr))}}
@media(max-width:700px){.rail{transform:translateX(110%);width:min(310px,88vw)}.workspace{margin-right:0}.topbar{padding:0 15px}.content{padding:17px 13px 35px}.welcome-strip{padding:22px 19px;border-radius:18px}.server-picker{padding:23px 17px;border-radius:21px}.server-picker-top{display:block}.server-count{display:inline-block;margin-top:17px;min-width:95px}.server-tools{align-items:stretch;flex-direction:column}.server-sort{width:100%}.server-grid{grid-template-columns:1fr}.server-card{min-height:165px}.server-picker:after{font-size:84px;letter-spacing:-6px;bottom:-20px}.card{padding:19px 15px;border-radius:16px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
</style>
</head>
<body>
<div class="app ${guildId ? 'guild-workspace' : 'server-selection'}">
<aside class="rail" id="rail"><div class="brand"><div class="brand-mark">D</div><div><strong>Drayz System</strong><small>CONTROL CENTER</small><span class="pro-pill"><i></i> PRO EDITION</span></div></div>${guildId ? '<div class="rail-section">Workspace</div><nav class="rail-nav">'+navHtml+'</nav>' : ''}<div class="rail-footer">${guildId ? safe(guildName) : 'إدارة السيرفرات'}<form action="/logout" method="POST" style="display:inline"><button type="submit" style="background:none;border:0;color:var(--red);font:inherit;cursor:pointer;padding:0">خروج</button></form></div></aside>
<div class="drawer-backdrop" id="backdrop"></div>
<section class="workspace"><header class="topbar"><button class="menu-btn" id="menuBtn" aria-label="فتح القائمة">☰</button><div class="crumb"><span>Drayz System / PRO CONTROL CENTER</span><b>${safe(guildName)}</b></div><div class="top-status"><span class="status-dot"></span> PRO SYSTEM · ONLINE</div><div class="top-actions"><a href="/dashboard" title="السيرفرات" aria-label="السيرفرات"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11h13V9M9 20v-6h6v6"/></svg></a><form action="/logout" method="POST" style="display:inline"><button type="submit" title="تسجيل الخروج" aria-label="تسجيل الخروج" style="width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--line);border-radius:12px;color:var(--muted);background:rgba(255,255,255,.025);cursor:pointer"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg></button></form></div></header><main class="content"><section class="welcome-strip" ${guildId ? '' : 'hidden'}><div><div class="eyebrow">ADMINISTRATIVE WORKSPACE · PRO EDITION</div><h1>${safe(guildName)}</h1><p>تحكم بكل أنظمة السيرفر من مساحة واحدة واضحة وسريعة.</p><span class="pro-ribbon"><svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg> DRAYZ PRO · PREMIUM SERVER MANAGEMENT</span></div><div class="welcome-meta">LIVE / ${new Date().toLocaleDateString('en-GB')}</div></section><div class="view">${content}</div></main></section>
</div>
<script>
(() => { const rail=document.getElementById('rail'), backdrop=document.getElementById('backdrop'), btn=document.getElementById('menuBtn'); if(!rail||!backdrop||!btn)return; const close=()=>{rail.classList.remove('is-open');backdrop.classList.remove('is-open')}; btn.addEventListener('click',()=>{rail.classList.toggle('is-open');backdrop.classList.toggle('is-open')}); backdrop.addEventListener('click',close); window.addEventListener('keydown',e=>{if(e.key==='Escape')close()}); })();
 document.querySelectorAll('form[method=\"POST\"]').forEach(form=>form.addEventListener('submit',()=>{const button=form.querySelector('button[type=submit],button:not([type])');if(!button||button.dataset.busy)return;button.dataset.busy='1';button.dataset.original=button.innerHTML;button.innerHTML='<span aria-live=\"polite\">جارٍ تنفيذ العملية…</span>';button.disabled=true;}));
</script>
</body></html>`;
}

// --- [ Dashboard - Admin Commands ] ---

// --- [ Dashboard - Server List ] ---
app.get('/dashboard', checkAuth, (req, res) => {
    const manageableGuildIds = new Set((req.user?.guilds || []).filter(g => {
        try { const bits = BigInt(g.permissions || 0); return (bits & 8n) === 8n || (bits & 32n) === 32n; }
        catch { return false; }
    }).map(g => g.id));
    const botGuilds = [...client.guilds.cache.values()].filter(g => manageableGuildIds.has(g.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
    const cards = botGuilds.map((g, index) => {
        const iconURL = g.iconURL({ extension: 'png', size: 256 });
        const icon = iconURL
            ? `<img src="${safe(iconURL)}" class="server-icon" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://cdn.discordapp.com/embed/avatars/0.png'">`
            : `<span class="server-icon server-icon-fallback">${safe(g.name.slice(0,1).toUpperCase())}</span>`;
        return `<a class="server-card" href="/manage/${g.id}/home" data-name="${safe(g.name.toLocaleLowerCase('ar'))}" data-members="${Number(g.memberCount)||0}" style="animation-delay:${Math.min(index*45,450)}ms"><div class="server-card-head"><div class="server-icon-wrap">${icon}<i class="server-online" aria-label="البوت موجود"></i></div><div class="server-title"><h2>${safe(g.name)}</h2><small>SERVER CONTROL · PRO</small></div></div><div class="server-member-count"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>${(Number(g.memberCount)||0).toLocaleString('ar')} عضو</span></div><div class="server-open"><span>فتح مركز التحكم</span><i aria-hidden="true">←</i></div></a>`;
    }).join('');
    const empty = botGuilds.length ? '' : `<div class="server-empty"><svg viewBox="0 0 24 24"><path d="M12 3 20 7v5c0 4.5-3.2 7.5-8 9-4.8-1.5-8-4.5-8-9V7z"/><path d="M9 12h6"/></svg><h2>ما لقينا سيرفرات متاحة</h2><p>تأكد أن البوت موجود في السيرفر وأن عندك صلاحية إدارة السيرفر أو Administrator في Discord.</p></div>`;
    const content = `<section class="server-picker"><div class="server-picker-top"><div><div class="eyebrow">DRAYZ NEXUS · WORKSPACE SELECTOR</div><h1>كل سيرفراتك، بمكان واحد.</h1><p>اختار مساحة العمل وادخل مباشرة على مركز التحكم الخاص فيها.</p></div><div class="server-count"><b>${botGuilds.length.toLocaleString('ar')}</b><small>سيرفر متاح</small></div></div><div class="server-tools"><div class="server-search-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 4.5 4.5"/></svg><input type="search" id="guildSearch" placeholder="ابحث باسم السيرفر..." autocomplete="off" aria-label="ابحث عن سيرفر"></div><select id="guildSort" class="server-sort" aria-label="ترتيب السيرفرات"><option value="name">الترتيب: الاسم</option><option value="members">الأكبر أعضاء</option><option value="members-asc">الأقل أعضاء</option></select></div></section><div class="server-grid" id="guildGrid">${cards}${empty}</div><div class="server-no-results" id="noGuildResults">ما في نتائج مطابقة لبحثك.</div><script>(()=>{const search=document.getElementById('guildSearch'),sort=document.getElementById('guildSort'),grid=document.getElementById('guildGrid'),none=document.getElementById('noGuildResults');if(!grid)return;const run=()=>{const q=(search.value||'').trim().toLocaleLowerCase('ar');const cards=[...grid.querySelectorAll('.server-card')];cards.forEach(c=>c.hidden=!c.dataset.name.includes(q));const visible=cards.filter(c=>!c.hidden);none.style.display=cards.length&&!visible.length?'block':'none';const mode=sort.value;visible.sort((a,b)=>mode==='members'?Number(b.dataset.members)-Number(a.dataset.members):mode==='members-asc'?Number(a.dataset.members)-Number(b.dataset.members):a.dataset.name.localeCompare(b.dataset.name,'ar')).forEach(c=>grid.appendChild(c))};search.addEventListener('input',run);sort.addEventListener('change',run)})();</script>`;
    res.send(ui({ id: null, name: 'اختيار السيرفر' }, 'home', content));
});

// --- [ Home / Stats ] ---
const inviteCache = new Map();

async function fetchGuildInvites(guild) {
    try {
        const invites = await guild.invites.fetch();
        const snapshot = new Map();
        for (const invite of invites.values()) snapshot.set(invite.code, {
            uses: invite.uses || 0,
            inviterId: invite.inviter?.id || null,
            inviterTag: invite.inviter?.tag || invite.inviter?.username || null
        });
        inviteCache.set(guild.id, snapshot);
        return snapshot;
    } catch (error) {
        console.error(`[Invite Fetch Error] ${guild.id}:`, error.message);
        return inviteCache.get(guild.id) || new Map();
    }
}

async function attributeMemberInvite(member) {
    const guild = member.guild;
    const previous = inviteCache.get(guild.id) || new Map();
    const current = await fetchGuildInvites(guild);
    let usedInvite = null;
    for (const [code, invite] of current) {
        const before = previous.get(code);
        if (invite.uses > (before?.uses || 0)) {
            usedInvite = { code, ...invite };
            break;
        }
    }
    if (!usedInvite?.inviterId || usedInvite.inviterId === member.id) return null;
    await InviteRecord.findOneAndUpdate(
        { guildId: guild.id, invitedUserId: member.id },
        { $set: { inviterId: usedInvite.inviterId, inviteCode: usedInvite.code, joinedAt: new Date(), leftAt: null, currentlyInGuild: true } },
        { upsert: true, setDefaultsOnInsert: true }
    );
    return usedInvite;
}

async function markInviteMemberPresent(guildId, userId, present) {
    await InviteRecord.updateOne(
        { guildId, invitedUserId: userId },
        { $set: { currentlyInGuild: present, ...(present ? { leftAt: null } : { leftAt: new Date() }) } }
    ).catch(() => {});
}


app.get('/manage/:guildId/home', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    const statsData = await Stats.findOne({ guildId: g.id }) || {
        messages: { total: 0, daily: 0, weekly: 0, monthly: 0 },
        activeChannels: new Map(),
        membersLog: { joined: [], left: [] }
    };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newMembersCount = (statsData.membersLog?.joined || []).filter(d => d > sevenDaysAgo).length;
    const leftMembersCount = (statsData.membersLog?.left || []).filter(d => d > sevenDaysAgo).length;
    const content = `
    <div class="card">
        <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/></svg>
            إحصائيات السيرفر
        </h3>
        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-num">${statsData.messages?.total || 0}</div>
                <div class="stat-label">اجمالي الرسائل</div>
            </div>
            <div class="stat-box" style="--red:#e63946;">
                <div class="stat-num" style="color:var(--gold);">${g.memberCount}</div>
                <div class="stat-label">عدد الاعضاء</div>
            </div>
            <div class="stat-box" style="--green:#00c853;">
                <div class="stat-num" style="color:#00c853;">+${newMembersCount}</div>
                <div class="stat-label">اعضاء جدد (7 ايام)</div>
            </div>
            <div class="stat-box" style="--red-light:#ff6b6b;">
                <div class="stat-num" style="color:#ff6b6b;">-${leftMembersCount}</div>
                <div class="stat-label">اعضاء غادروا (7 ايام)</div>
            </div>
            <div class="stat-box">
                <div class="stat-num">${statsData.messages?.daily || 0}</div>
                <div class="stat-label">رسائل اليوم</div>
            </div>
            <div class="stat-box">
                <div class="stat-num">${statsData.messages?.weekly || 0}</div>
                <div class="stat-label">رسائل الاسبوع</div>
            </div>
        </div>
    </div>`;

    res.send(ui(g, 'home', content));
});

// --- [ Kick Notifications ] ---
app.get('/manage/:guildId/kick', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    let s = await KickConfig.findOne({ guildId: g.id }) || { streamers: [] };

    const streamerRows = s.streamers.map((st, i) => `
    <tr>
        <td><span class="tag tag-blue">${escapeHtml(st.kickUsername)}</span></td>
        <td style="color:var(--text-muted);">#${escapeHtml(g.channels.cache.get(st.channelId)?.name || 'قناة محذوفة')}</td>
        <td>${st.roleId ? `<span class="tag tag-red">@${escapeHtml(g.roles.cache.get(st.roleId)?.name || 'رتبة محذوفة')}</span>` : '<span class="tag" style="background:rgba(255,255,255,0.05);color:var(--text-muted);">بدون منشن</span>'}</td>
        <td>
            <form method="POST" action="/delete-kick/${g.id}/${i}" onsubmit="return confirm('حذف الستريمر؟')" style="display:inline"><button class="btn-save btn-danger btn-sm" type="submit">حذف</button></form>
        </td>
    </tr>`).join('');

    const content = `
    <div class="card">
        <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="var(--dark)"/></svg>
            نظام تنبيهات Kick
        </h3>

        <div style="background:rgba(0,0,0,0.3); border:1px solid var(--gold-border); border-radius:14px; padding:24px; margin-bottom:24px;">
            <h4 style="color:var(--gold); margin-bottom:18px; font-size:15px;">اضافة ستريمر جديد</h4>
            <form method="POST" action="/save/${g.id}/kick">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div>
                        <label>اسم المستخدم في Kick</label>
                        <input type="text" name="kickUser" placeholder="مثلاً: username" required>
                    </div>
                    <div>
                        <label>قناة التنبيه</label>
                        <select name="channelId">
                            ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${escapeHtml(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label>الرتبة للمنشن (اختياري)</label>
                        <select name="roleId">
                            <option value="">-- بدون منشن --</option>
                            ${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label>رسالة مخصصة (استخدم %name% للاسم)</label>
                        <input type="text" name="msg" placeholder="%name% بدأ البث الآن!">
                    </div>
                </div>
                <button class="btn-save btn-green" style="margin-top:16px; width:auto; padding:12px 30px;">اضافة الستريمر</button>
            </form>
        </div>

        ${s.streamers.length > 0 ? `
        <table class="data-table">
            <thead>
                <tr>
                    <th>الستريمر</th>
                    <th>القناة</th>
                    <th>المنشن</th>
                    <th>الإجراء</th>
                </tr>
            </thead>
            <tbody>${streamerRows}</tbody>
        </table>` : `<p style="color:var(--text-muted); text-align:center; padding:30px 0;">لا يوجد ستريمرات مضافة بعد.</p>`}
    </div>`;

    res.send(ui(g, 'kick', content));
});

app.post('/save/:guildId/kick', checkAuth, sameOriginAdminWrite, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { kickUser, channelId, roleId, msg } = req.body;
        const username = kickUser.replace('https://kick.com', '').replace('/', '').trim();
        await KickConfig.findOneAndUpdate(
            { guildId },
            { $push: { streamers: { kickUsername: username, channelId, roleId, customMessage: msg, isLive: false } } },
            { upsert: true }
        );
        res.redirect(`/manage/${guildId}/kick`);
    } catch (err) {
        res.status(500).send('خطأ في إضافة الستريمر');
    }
});

app.post('/delete-kick/:guildId/:index', checkAuth, sameOriginAdminWrite, async (req, res) => {
    const { guildId, index } = req.params;
    const indexNumber = Number(index);
    const config = await KickConfig.findOne({ guildId });
    if (!config || !Number.isInteger(indexNumber) || indexNumber < 0 || indexNumber >= config.streamers.length) return res.status(404).send('الإعداد المطلوب غير موجود.');
    config.streamers.splice(indexNumber, 1);
    await config.save();
    res.redirect(`/manage/${guildId}/kick`);
});

// --- [ Suggestions ] ---
app.get('/manage/:guildId/suggestions', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await SuggestionConfig.findOne({ guildId: g.id }) || {};
    const suggestionImagePreview = s.imageUrl || (s.imagePath && fs.existsSync(s.imagePath) ? `/uploads/${path.basename(s.imagePath)}` : '');

    const content = `
    <form method="POST" action="/save/${g.id}/suggestions" enctype="multipart/form-data">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>
                نظام الاقتراحات
            </h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
                حدد روم الاقتراحات ورابط صورة مباشر ودائم عبر HTTPS يظهر داخل كل اقتراح، وحدد إيموجيين للتصويت.
            </p>
            <label>روم الاقتراحات</label>
            <select name="channelId" required>
                <option value="">-- اختر الروم --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.channelId === c.id ? 'selected' : ''}># ${escapeHtml(c.name)}</option>`).join('')}
            </select>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>ID الإيموجي الأول</label>
                    <input type="text" name="emoji1" value="${escapeHtml(s.emoji1 || '')}" placeholder="مثلاً: 123456789012345678">
                </div>
                <div>
                    <label>ID الإيموجي الثاني</label>
                    <input type="text" name="emoji2" value="${escapeHtml(s.emoji2 || '')}" placeholder="مثلاً: 123456789012345678">
                </div>
            </div>
            <label>رابط صورة الاقتراح الدائم (HTTPS)</label>
            <input type="url" name="imageUrl" value="${escapeHtml(s.imageUrl || '')}" placeholder="https://example.com/suggestion-banner.png" maxlength="2048" style="direction:ltr;text-align:left">
            <small style="color:var(--muted)">استخدم رابطًا مباشرًا لصورة مستضافة بشكل دائم. الرابط يبقى محفوظًا بعد إعادة تشغيل البوت أو تحديثه.</small>
            <label style="margin-top:14px">أو ارفع صورة كخيار احتياطي</label>
            <input type="file" name="suggestImage" accept="image/png,image/jpeg,image/gif,image/webp">
            ${suggestionImagePreview ? `<div style="margin-top:12px;"><img src="${escapeHtml(suggestionImagePreview)}" style="max-width:220px; border-radius:12px; border:1px solid var(--gold-border);"></div>` : ''}
            <button class="btn-save" style="margin-top:20px;">حفظ إعدادات الاقتراحات</button>
        </div>
    </form>`;

    res.send(ui(g, 'suggestions', content));
});

app.post('/save/:guildId/suggestions', checkAuth, upload.single('suggestImage'), sameOriginAdminWrite, verifyUploadedImages, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(String(req.body.channelId || ''));
    if (!guild || !channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return res.status(400).send('اختر قناة اقتراحات نصية صالحة من نفس السيرفر.');
    const emoji1 = String(req.body.emoji1 || '').trim().slice(0, 100);
    const emoji2 = String(req.body.emoji2 || '').trim().slice(0, 100);
    const rawUrl = String(req.body.imageUrl || '').trim();
    let imageUrl = '';
    if (rawUrl) {
        try {
            const parsed = new URL(rawUrl);
            if (parsed.protocol !== 'https:' || parsed.href.length > 2048) return res.status(400).send('رابط الصورة يجب أن يكون HTTPS وصالحًا.');
            imageUrl = parsed.href;
        } catch { return res.status(400).send('رابط صورة الاقتراح غير صالح.'); }
    }
    const update = { channelId: channel.id, emoji1, emoji2 };
    if (imageUrl) update.imageUrl = imageUrl;
    else if (req.file) { update.imagePath = req.file.path; update.imageUrl = ''; }
    await SuggestionConfig.findOneAndUpdate({ guildId }, { $set: update }, { upsert: true, runValidators: true });
    if (req.file && !imageUrl) req.keepUploadedFiles = true;
    res.redirect(`/manage/${guildId}/suggestions`);
});
// --- [ Logs ] ---
app.get('/manage/:guildId/logs', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { logs: {} };
    const types = ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'];
    const typeLabels = {
        messages: 'الرسائل',
        moderation: 'الإشراف',
        members: 'الأعضاء',
        channels: 'القنوات',
        roles: 'الرتب',
        voice: 'الصوت'
    };

    const content = `
    <form method="POST" action="/save/${g.id}/logs">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                نظام اللوق
            </h3>
            ${types.map(t => `
            <div class="toggle-row">
                <div style="display:flex; align-items:center; gap:12px;">
                    <input type="checkbox" name="${t}_st" id="chk_${t}" ${s.logs?.[t]?.enabled ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer; accent-color:var(--gold);">
                    <label for="chk_${t}" style="margin:0; color:white; cursor:pointer;">${typeLabels[t]}</label>
                </div>
                <select name="${t}_ch" style="width:250px; margin:0;">
                    <option value="">-- اختر القناة --</option>
                    ${g.channels.cache.filter(c => c.type === 0).map(c =>
                        `<option value="${c.id}" ${s.logs?.[t]?.channel === c.id ? 'selected' : ''}># ${escapeHtml(c.name)}</option>`
                    ).join('')}
                </select>
            </div>`).join('')}
            <button class="btn-save" style="margin-top:20px;">حفظ اللوق</button>
        </div>
    </form>`;

    res.send(ui(g, 'logs', content));
});

app.post('/save/:guildId/logs', checkAuth, sameOriginAdminWrite, async (req, res) => {
    const b = req.body;
    const types = ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'];
    let logData = {};
    types.forEach(t => {
        logData[`logs.${t}`] = { enabled: b[`${t}_st`] === 'on', channel: b[`${t}_ch`] };
    });
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: logData }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/logs`);
});


// --- [ Welcome ] ---
app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { welcome: {} };
    const welcome = s.welcome || {};
    const bounded = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback));
    const avatarWidth = bounded(welcome.avatarWidth, 150, 70, 320);
    const avatarHeight = bounded(welcome.avatarHeight, avatarWidth, 70, 320);
    const avatarX = bounded(welcome.avatarX, 50, 0, 100);
    const avatarY = bounded(welcome.avatarY, 50, 0, 100);
    const img = escapeHtml(welcome.imagePath || 'https://placehold.co/800x400?text=No+Background');

    const content = `
    <form method="POST" action="/save/${g.id}/welcome" class="welcome-editor">
        <div class="editor-grid">
            <div class="card designer-card">
                <div class="editor-heading"><div><div class="eyebrow">WELCOME BUILDER</div><h2>صمّم بطاقة الترحيب</h2><p>حرّك الصورة أو استخدم أدوات التحكم الدقيقة. التغيير يظهر مباشرة داخل المعاينة.</p></div><span class="editor-badge">LIVE PREVIEW</span></div>
                <div class="welcome-preview" id="previewContainer">
                    <img src="${img}" id="bgPreview" alt="خلفية المعاينة">
                    <div class="preview-shade"></div><div class="preview-copy"><span>WELCOME</span><strong>{member}</strong><small>إلى ${escapeHtml(g.name)}</small></div>
                    <div id="previewAvatar" class="preview-avatar" style="width:${avatarWidth}px;height:${avatarHeight}px;left:calc(${avatarX}% - ${avatarWidth/2}px);top:calc(${avatarY}% - ${avatarHeight/2}px);background-image:url('${client.user?.displayAvatarURL() || ''}')"><button type="button" id="avatarHandle" aria-label="تحريك الصورة">✥</button></div>
                </div>
                <div class="range-controls">
                    <label>حجم الصورة <output id="sizeOutput">${avatarWidth}px</output><input id="sizeSlider" type="range" min="70" max="320" value="${avatarWidth}"></label>
                    <label>الموضع الأفقي <output id="xOutput">${avatarX}%</output><input id="xSlider" type="range" min="0" max="100" value="${avatarX}"></label>
                    <label>الموضع العمودي <output id="yOutput">${avatarY}%</output><input id="ySlider" type="range" min="0" max="100" value="${avatarY}"></label>
                </div>
            </div>
            <div class="card settings-card">
                <div class="card-title"><span class="title-icon">✦</span><h3>إعدادات المحتوى</h3></div>
                <div class="toggle-row"><label style="margin:0;color:var(--text)">تفعيل الترحيب</label><input type="checkbox" name="enabled" ${s.welcome?.enabled ? 'checked' : ''}></div>
                <label>قناة الترحيب</label><select name="channel"><option value="">-- اختر القناة --</option>${g.channels.cache.filter(c=>c.type===0).map(c=>`<option value="${c.id}" ${s.welcome?.channel===c.id?'selected':''}># ${escapeHtml(c.name)}</option>`).join('')}</select>
                <label>رسالة الترحيب</label><textarea name="embedMessage" placeholder="استخدم {member} و {guild} و {count}">${escapeHtml(s.welcome?.embedMessage || 'مرحباً بك {member} في سيرفر {guild}!')}</textarea>
                <label>رابط خلفية البطاقة</label><input type="url" name="imageUrl" value="${escapeHtml(s.welcome?.imagePath || '')}" placeholder="https://example.com/image.png" style="direction:ltr;text-align:left">
                <div class="upload-note">ضع رابط صورة مباشر ثم اضغط حفظ.</div>
                <div class="upload-note">يجب أن يكون الرابط عامًا ومباشرًا ويبدأ بـ https://</div>
                <input type="hidden" name="avatarX" id="avatarX" value="${avatarX}"><input type="hidden" name="avatarY" id="avatarY" value="${avatarY}"><input type="hidden" name="avatarWidth" id="avatarWidth" value="${avatarWidth}"><input type="hidden" name="avatarHeight" id="avatarHeight" value="${avatarHeight}">
                <button class="btn-save" type="submit" style="width:100%;margin-top:20px">حفظ بطاقة الترحيب</button>
            </div>
        </div>
    </form>
    <style>
      .editor-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(290px,.8fr);gap:20px}.designer-card{padding:25px}.editor-heading{display:flex;justify-content:space-between;gap:15px;margin-bottom:20px}.editor-heading h2{margin:6px 0 4px;font-size:21px}.editor-heading p{color:var(--muted);font-size:11px;margin:0}.editor-badge{height:max-content;padding:5px 9px;border-radius:20px;border:1px solid var(--line);color:var(--gold);font:600 9px 'IBM Plex Mono',monospace}.welcome-preview{position:relative;isolation:isolate;width:100%;aspect-ratio:2/1;overflow:hidden;border-radius:15px;background:#090806;border:1px solid var(--line);touch-action:none}.welcome-preview #bgPreview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.preview-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.68),rgba(0,0,0,.08))}.preview-copy{position:absolute;right:7%;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;color:#fff}.preview-copy span{font:600 10px 'IBM Plex Mono',monospace;letter-spacing:3px;color:var(--gold)}.preview-copy strong{font-size:32px;line-height:1.25}.preview-copy small{font-size:11px;color:#d2cabb}.preview-avatar{position:absolute;border:3px solid var(--gold);border-radius:50%;background-size:cover;background-position:center;cursor:grab;box-shadow:0 0 0 5px rgba(244,194,76,.14),0 10px 28px rgba(0,0,0,.4);touch-action:none;z-index:2}.preview-avatar:active{cursor:grabbing}.preview-avatar button{position:absolute;right:-9px;bottom:-9px;width:25px;height:25px;border:2px solid var(--gold);border-radius:50%;background:#171006;color:var(--gold);cursor:grab}.range-controls{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.range-controls label{margin:0;color:#b6ad9d;font-size:11px}.range-controls output{float:left;color:var(--gold);font:600 10px 'IBM Plex Mono',monospace}.range-controls input{padding:0;height:20px;margin-top:9px;background:transparent;border:0;box-shadow:none;accent-color:var(--gold)}.settings-card .card-title{display:flex;align-items:center;gap:9px}.settings-card .card-title h3{margin:0}.title-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:rgba(244,194,76,.12);color:var(--gold)}.upload-note{color:var(--muted);font-size:10px;margin-top:7px}@media(max-width:850px){.editor-grid{grid-template-columns:1fr}.range-controls{grid-template-columns:1fr 1fr}.preview-copy strong{font-size:26px}}@media(max-width:500px){.range-controls{grid-template-columns:1fr}.editor-heading{display:block}.editor-badge{display:inline-block;margin-top:12px}}
    </style>
    <script>
    (() => {
      const box=document.getElementById('previewContainer'), avatar=document.getElementById('previewAvatar'), handle=document.getElementById('avatarHandle');
      const x=document.getElementById('xSlider'), y=document.getElementById('ySlider'), size=document.getElementById('sizeSlider'); const hx=document.getElementById('avatarX'), hy=document.getElementById('avatarY'), hw=document.getElementById('avatarWidth'), hh=document.getElementById('avatarHeight');
      const xo=document.getElementById('xOutput'), yo=document.getElementById('yOutput'), so=document.getElementById('sizeOutput');
      const paint=()=>{const w=Number(size.value); avatar.style.width=w+'px';avatar.style.height=w+'px';avatar.style.left='calc('+x.value+'% - '+(w/2)+'px)';avatar.style.top='calc('+y.value+'% - '+(w/2)+'px)';hx.value=x.value;hy.value=y.value;hw.value=w;hh.value=w;xo.value=x.value+'%';yo.value=y.value+'%';so.value=w+'px'};
      [x,y,size].forEach(el=>el.addEventListener('input',paint));
      let drag=null;
      const point=e=>e.touches?e.touches[0]:e;
      const down=e=>{if(e.target===handle)e.preventDefault(); const p=point(e), r=box.getBoundingClientRect(); drag={ox:p.clientX-r.left,oy:p.clientY-r.top,x:Number(x.value),y:Number(y.value)}; avatar.setPointerCapture?.(e.pointerId);};
      const move=e=>{if(!drag)return; const p=point(e), r=box.getBoundingClientRect(); x.value=Math.max(0,Math.min(100,drag.x+(p.clientX-(r.left+drag.ox))/r.width*100)); y.value=Math.max(0,Math.min(100,drag.y+(p.clientY-(r.top+drag.oy))/r.height*100)); paint()};
      const up=()=>drag=null; avatar.addEventListener('pointerdown',down); avatar.addEventListener('pointermove',move); avatar.addEventListener('pointerup',up); avatar.addEventListener('pointercancel',up); paint();
    })();
    </script>`;
    res.send(ui(g, 'welcome', content));
});

app.post('/generate/:guildId/welcome-random', checkAuth, checkBotGuildAccess, checkGuildAccess, sameOriginAdminWrite, async (req, res) => {
    try {
        const filename = `welcome-generated-${req.params.guildId}-${Date.now()}-${Math.floor(Math.random() * 100000)}.png`;
        const absolutePath = path.join(__dirname, 'uploads', filename);
        await createRandomWelcomeBackground(absolutePath);
        const imagePath = `/uploads/${filename}`;
        await GuildConfig.findOneAndUpdate(
            { guildId: req.params.guildId },
            { $set: { 'welcome.imagePath': imagePath } },
            { upsert: true }
        );
        return res.json({ ok: true, url: imagePath });
    } catch (err) {
        console.error('[Random Welcome Error]', err);
        return res.status(500).json({ ok: false, error: 'تعذر إنشاء تصميم الترحيب.' });
    }
});

app.post('/save/:guildId/welcome', checkAuth, sameOriginAdminWrite, async (req, res) => {
    const b = req.body;
    const bounded = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback));
    const channel = b.channel ? client.guilds.cache.get(req.params.guildId)?.channels.cache.get(String(b.channel)) : null;
    if (b.channel && (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type))) return res.status(400).send('اختر قناة نصية صالحة من نفس السيرفر.');
    const embedMessage = String(b.embedMessage || 'مرحباً بك {member} في سيرفر {guild}!').slice(0, 1800);
    let updateData = {
        'welcome.enabled': b.enabled === 'on',
        'welcome.channel': channel?.id || '',
        'welcome.embedMessage': embedMessage,
        'welcome.avatarX': bounded(b.avatarX, 50, 0, 100),
        'welcome.avatarY': bounded(b.avatarY, 50, 0, 100),
        'welcome.avatarWidth': bounded(b.avatarWidth, 150, 70, 320),
        'welcome.avatarHeight': bounded(b.avatarHeight, 150, 70, 320)
    };
    const imageInput = String(b.imageUrl || '').trim();
    let downloadedImage = null;
    if (!imageInput) updateData['welcome.imagePath'] = '';
    else if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(imageInput)) {
        const localImage = path.join(uploadDir, path.basename(imageInput));
        if (!fs.existsSync(localImage)) return res.status(400).send('ملف الخلفية المحلي غير موجود.');
        updateData['welcome.imagePath'] = imageInput;
    } else {
        let imageUrl;
        try { imageUrl = new URL(imageInput); }
        catch { return res.status(400).send('رابط الخلفية غير صالح.'); }
        if (imageUrl.protocol !== 'https:' || imageUrl.username || imageUrl.password || imageUrl.href.length > 2048) return res.status(400).send('رابط الخلفية يجب أن يكون HTTPS عامًا وبطول صالح.');
        try {
            downloadedImage = await downloadPublicWelcomeImage(imageUrl);
            updateData['welcome.imagePath'] = downloadedImage.publicPath;
        } catch (error) {
            console.error('[Welcome Image Download Error]', error.message);
            return res.status(400).send('تعذر تنزيل الصورة بأمان؛ استخدم رابط HTTPS مباشرًا لصورة PNG/JPEG/WebP/GIF عامة (حد أقصى 5MB).');
        }
    }
    try { await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: updateData }, { upsert: true }); }
    catch (error) {
        if (downloadedImage) await fs.promises.unlink(downloadedImage.absolutePath).catch(() => {});
        console.error('[Welcome Save Error]', error.message);
        return res.status(500).send('تعذر حفظ إعدادات الترحيب.');
    }
    res.redirect(`/manage/${req.params.guildId}/welcome`);
});

// --- [ Security ] ---
app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { security: {} };

    const content = `
    <form method="POST" action="/save/${g.id}/security">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                إعدادات الحماية
            </h3>
            <div class="toggle-row">
                <label style="color:white; margin:0;">حظر الروابط</label>
                <input type="checkbox" name="antiLinks" ${s.security?.antiLinks ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--gold); cursor:pointer;">
            </div>
            <label>الإجراء عند المخالفة</label>
            <select name="punishment">
                <option value="delete" ${['delete','none'].includes(s.security?.punishment) ? 'selected' : ''}>حذف الرسالة + تنبيه</option>
                <option value="timeout" ${s.security?.punishment === 'timeout' ? 'selected' : ''}>حذف الرسالة + مهلة 10 دقائق</option>
                <option value="kick" ${s.security?.punishment === 'kick' ? 'selected' : ''}>حذف الرسالة + طرد العضو</option>
            </select>
            <label>الكلمات المحظورة (افصل بفاصلة)</label>
            <input type="text" name="badWords" value="${escapeHtml(s.security?.badWords || '')}" placeholder="كلمة1, كلمة2, ...">
            <label>الإيموجيات المحظورة (افصل بفاصلة)</label>
            <input type="text" name="badEmojis" value="${escapeHtml(s.security?.badEmojis || '')}" placeholder="إيموجي1, إيموجي2, ...">
            <label>رتب الاستثناء (لن تطبق عليهم الحماية)</label>
            ${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `
            <div style="display:flex; align-items:center; gap:10px; margin:6px 0;">
                <input type="checkbox" name="bypassRoles" value="${r.id}" id="bypass_${r.id}" ${s.security?.bypassRoles?.includes(r.id) ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--gold);">
                <label for="bypass_${r.id}" style="margin:0; color:var(--text); cursor:pointer;">${escapeHtml(r.name)}</label>
            </div>`).join('')}
            <button class="btn-save" style="margin-top:20px;">حفظ الإعدادات</button>
        </div>
    </form>`;

    res.send(ui(g, 'security', content));
});

app.post('/save/:guildId/security', checkAuth, sameOriginAdminWrite, async (req, res) => {
    const b = req.body;
    const bypassRoles = Array.isArray(b.bypassRoles) ? b.bypassRoles : (b.bypassRoles ? [b.bypassRoles] : []);
    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: { security: { antiLinks: b.antiLinks === 'on', badWords: String(b.badWords || '').slice(0, 2000), badEmojis: String(b.badEmojis || '').slice(0, 2000), punishment: ['delete','timeout','kick'].includes(b.punishment) ? b.punishment : 'delete', bypassRoles: [...new Set(bypassRoles.filter(id => client.guilds.cache.get(req.params.guildId)?.roles.cache.has(id)))] } } },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/security`);
});

app.get('/manage/:guildId/admincmd', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect('/dashboard');
    const saved = await AdminCmdConfig.findOne({ guildId: guild.id }).lean();
    const defaults = { lock: '-ق', unlock: '-ف', timeout: '-ت', untimeout: '-فت', ban: '-ب', unban: '-فب', kick: '-ك' };
    const labels = { lock: 'قفل القناة', unlock: 'فتح القناة', timeout: 'تايم أوت', untimeout: 'فك التايم أوت', ban: 'حظر', unban: 'فك الحظر', kick: 'طرد' };
    const rows = Object.entries(defaults).map(([key, fallback]) => {
        const setting = saved?.settings?.[key] || {};
        const example = ['lock', 'unlock'].includes(key) ? fallback : `${fallback} @عضو`;
        const helper = ['lock', 'unlock'].includes(key) ? 'على القناة الحالية — بدون منشن أو إضافات' : 'يتطلب تحديد العضو المستهدف';
        return `<div class="admin-shortcut-row"><div><strong>${labels[key]}</strong><small>مثال: <code>${escapeHtml(example)}</code> · ${helper}</small></div><input name="shortcut_${key}" maxlength="16" value="${escapeHtml(setting.shortcut || fallback)}" required><label><input type="checkbox" name="delUser_${key}" ${setting.delUser ? 'checked' : ''}> حذف أمر العضو</label><label><input type="checkbox" name="delBot_${key}" ${setting.delBot ? 'checked' : ''}> حذف رد البوت بعد 5 ثوانٍ</label></div>`;
    }).join('');
    const content = `<section class="card"><h3>اختصارات الإشراف · تحكم مباشر</h3><p style="color:var(--muted)">القفل والفتح يطبّقان على القناة الحالية بمجرد كتابة الاختصار فقط. التايم أوت وفكّه والباند والطرد تتطلب تحديد عضو. التنفيذ محمي بالصلاحيات وتسلسل الرتب.</p><form method="POST" action="/save/${guild.id}/admincmd"><div class="admin-role-grid">${guild.roles.cache.filter(role => role.id !== guild.id && !role.managed).map(role => `<label class="admin-role-option"><input type="checkbox" name="adminRoles" value="${role.id}" ${saved?.adminRoles?.includes(role.id) ? 'checked' : ''}> ${escapeHtml(role.name)}</label>`).join('')}</div><div style="margin-top:20px">${rows}</div><button class="btn-save" style="margin-top:20px">حفظ اختصارات الإدارة</button></form></section>`;
    res.send(ui(guild, 'admincmd', content));
});

app.post('/save/:guildId/admincmd', checkAuth, sameOriginAdminWrite, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).send('السيرفر غير موجود.');
    const defaults = { lock: '-ق', unlock: '-ف', timeout: '-ت', untimeout: '-فت', ban: '-ب', unban: '-فب', kick: '-ك' };
    const settings = {};
    const used = new Set();
    for (const [key, fallback] of Object.entries(defaults)) {
        const shortcut = String(req.body[`shortcut_${key}`] || '').trim();
        if (!/^-[\p{L}\p{N}_-]{1,15}$/u.test(shortcut)) return res.status(400).send(`صيغة اختصار ${key} غير صالحة؛ استخدم شرطة ثم 1–15 حرفًا أو رقمًا.`);
        if (used.has(shortcut)) return res.status(400).send('لا يمكن استخدام الاختصار نفسه لأكثر من أمر.');
        used.add(shortcut);
        settings[key] = { shortcut: shortcut || fallback, delUser: req.body[`delUser_${key}`] === 'on', delBot: req.body[`delBot_${key}`] === 'on' };
    }
    const selectedRoles = Array.isArray(req.body.adminRoles) ? req.body.adminRoles : req.body.adminRoles ? [req.body.adminRoles] : [];
    const adminRoles = [...new Set(selectedRoles.filter(id => guild.roles.cache.has(id) && id !== guild.id && !guild.roles.cache.get(id).managed))].slice(0, 20);
    await AdminCmdConfig.findOneAndUpdate({ guildId: guild.id }, { $set: { adminRoles, settings } }, { upsert: true, new: true, runValidators: true });
    return res.redirect(`/manage/${guild.id}/admincmd`);
});

// --- [ Auto Reply ] ---
app.get('/manage/:guildId/autoreply', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { autoReply: [] };

    const rows = Array.from({ length: 15 }, (_, i) => `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; padding:14px; background:rgba(0,0,0,0.2); border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
        <input name="trigger_${i}" value="${escapeHtml(s.autoReply?.[i]?.trigger || '')}" placeholder="الكلمة المحفزة ${i + 1}">
        <input name="reply_${i}" value="${escapeHtml(s.autoReply?.[i]?.reply || '')}" placeholder="الرد التلقائي ${i + 1}">
    </div>`).join('');

    const content = `
    <form method="POST" action="/save/${g.id}/autoreply">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                الرد الآلي (حتى 15 رد)
            </h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 12px; margin-bottom:8px; padding:0 14px;">
                <span style="color:var(--text-muted); font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">الكلمة المحفزة</span>
                <span style="color:var(--text-muted); font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">الرد</span>
            </div>
            ${rows}
            <button class="btn-save" style="margin-top:8px;">حفظ الردود</button>
        </div>
    </form>`;

    res.send(ui(g, 'autoreply', content));
});

app.post('/save/:guildId/autoreply', checkAuth, sameOriginAdminWrite, async (req, res) => {
    try {
        const { guildId } = req.params;
        const finalData = [];
        for (let i = 0; i < 15; i++) {
            const t = String(req.body[`trigger_${i}`] || '').trim().slice(0, 100);
            const r = String(req.body[`reply_${i}`] || '').trim().slice(0, 1800);
            if (t && r) finalData.push({ trigger: t, reply: r });
        }
        await GuildConfig.findOneAndUpdate({ guildId }, { $set: { autoReply: finalData } }, { upsert: true, new: true });
        res.redirect(`/manage/${guildId}/autoreply`);
    } catch (err) {
        console.error('[AutoReply Save Error]', err);
        res.status(500).send('خطأ في حفظ الردود');
    }
});

// --- [ Giveaway ] ---
app.get('/manage/:guildId/giveaway', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const activeGiveaways = await Giveaway.find({ guildId: g.id, ended: false });

    const content = `
    <div class="card">
        <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/></svg>
            إنشاء قيف اواي جديد
        </h3>
        <form method="POST" action="/save/${g.id}/giveaway" enctype="multipart/form-data">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>الجائزة</label>
                    <input name="prize" placeholder="اسم الجائزة" required>
                </div>
                <div>
                    <label>المدة (مثال: 1d أو 1h أو 30m)</label>
                    <input name="duration" placeholder="1h" required>
                </div>
                <div>
                    <label>عدد الفائزين</label>
                    <input type="number" name="winners" value="1" min="1" required>
                </div>
                <div>
                    <label>قناة الإرسال</label>
                    <select name="channel" required>
                        ${g.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => `<option value="${c.id}"># ${escapeHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <label>الوصف (اختياري)</label>
            <textarea name="description" placeholder="وصف الجائزة..."></textarea>
            <label>صورة القيف اواي (اختياري)</label>
            <input type="file" name="giveawayImage" accept="image/*">
            <button class="btn-save btn-green" style="margin-top:16px;">تشغيل القيف اواي</button>
        </form>
    </div>
    ${activeGiveaways.length > 0 ? `
    <div class="card">
        <h3>القيف اوايات النشطة</h3>
        ${activeGiveaways.map(gw => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:14px; background:rgba(0,0,0,0.2); border-radius:10px; margin-bottom:10px; border:1px solid var(--gold-border);">
            <div>
                <span style="color:white; font-weight:700;">${escapeHtml(gw.prize)}</span>
                <span class="tag tag-blue" style="margin-right:10px;">${gw.participants?.length || 0} مشارك / ${gw.winnersCount} فائز</span>
            </div>
            <div style="display:flex;align-items:center;gap:14px"><span style="color:var(--text-muted); font-size:13px;">ينتهي <t:${Math.floor(new Date(gw.endAt).getTime() / 1000)}:R></span>
            <form method="POST" action="/manage/${g.id}/giveaway/${gw._id}/end"><button class="btn-save btn-danger" type="submit" style="padding:8px 12px">إنهاء وسحب الآن</button></form></div>
        </div>`).join('')}
    </div>` : ''}`;

    res.send(ui(g, 'giveaway', content));
});

app.post('/save/:guildId/giveaway', checkAuth, upload.single('giveawayImage'), sameOriginAdminWrite, verifyUploadedImages, async (req, res) => {
    try {
        const g = client.guilds.cache.get(req.params.guildId);
        if (!g) return res.status(404).send('السيرفر غير موجود');
        const prize = String(req.body.prize || '').trim().slice(0, 180);
        const description = String(req.body.description || '').trim().slice(0, 1800);
        const timeMs = ms(String(req.body.duration || '').trim());
        const winnersCount = Number(req.body.winners);
        if (!prize) return res.status(400).send('اكتب اسم الجائزة.');
        if (!Number.isFinite(timeMs) || timeMs < 60_000 || timeMs > 30 * 86400000) return res.status(400).send('المدة يجب أن تكون بين دقيقة و30 يومًا.');
        if (!Number.isSafeInteger(winnersCount) || winnersCount < 1 || winnersCount > 20) return res.status(400).send('عدد الفائزين يجب أن يكون عددًا صحيحًا من 1 إلى 20.');
        const targetCh = g.channels.cache.get(String(req.body.channel || ''));
        if (!targetCh || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(targetCh.type)) return res.status(400).send('اختر قناة نصية أو قناة إعلانات صالحة.');
        const botPerms = targetCh.permissionsFor(g.members.me);
        const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        if (req.file) needed.push(PermissionFlagsBits.AttachFiles);
        if (!botPerms?.has(needed)) return res.status(403).send('البوت يحتاج صلاحيات عرض القناة وإرسال الرسائل والروابط المضمنة' + (req.file ? ' ورفع الملفات.' : '.'));

        const endAt = new Date(Date.now() + timeMs);
        const imagePath = req.file?.path || '';
        const imageName = imagePath ? path.basename(imagePath) : '';
        const giveaway = await Giveaway.create({ guildId: g.id, messageId: '', channelId: targetCh.id, endAt, winnersCount, prize, description, imagePath, participants: [] });
        const embed = new EmbedBuilder()
            .setTitle(`قيف اواي: ${prize}`)
            .setDescription(`${description || 'لا يوجد وصف'}\n\nالمدة: <t:${Math.floor(endAt.getTime() / 1000)}:R>\nعدد الفائزين: ${winnersCount}\nعدد المشاركين: 0`)
            .setColor(0xd4af37)
            .setFooter({ text: 'اضغط الزر بالأسفل للدخول' });
        const stableGiveawayUrl = imagePath ? publicUploadUrl(imagePath) : null;
        if (stableGiveawayUrl) embed.setImage(stableGiveawayUrl);
        else if (imageName) embed.setImage(`attachment://${imageName}`);
        const files = imagePath && !stableGiveawayUrl ? [new AttachmentBuilder(imagePath, { name: imageName })] : [];
        let giveawayMsg = null;
        try {
            giveawayMsg = await targetCh.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`giveaway_join:${giveaway._id}`).setLabel('دخول القيف اواي').setStyle(ButtonStyle.Primary))], files, allowedMentions: { parse: [] } });
            giveaway.messageId = giveawayMsg.id;
            await giveaway.save();
            if (imagePath) req.keepUploadedFiles = true;
        } catch (error) {
            if (giveawayMsg) await giveawayMsg.delete().catch(() => {});
            await Giveaway.deleteOne({ _id: giveaway._id }).catch(() => {});
            console.error('[Giveaway Create Error]', error.message);
            return res.status(500).send('تعذر نشر القيف أواي؛ تم تنظيف السجل/الرسالة الجزئية. تحقق من اتصال Mongo وصلاحيات القناة.');
        }
        return res.redirect(`/manage/${g.id}/giveaway`);
    } catch (error) {
        console.error('[Giveaway Route Error]', error.message);
        return res.status(500).send('تعذر إنشاء القيف أواي؛ راجع إعدادات قاعدة البيانات والقناة.');
    }
});

app.post('/manage/:guildId/giveaway/:giveawayId/end', checkAuth, sameOriginAdminWrite, async (req, res) => {
    try {
        const { guildId, giveawayId } = req.params;
        if (!/^[a-f\d]{24}$/i.test(giveawayId)) return res.status(400).send('معرّف القيف أواي غير صالح.');
        const giveaway = await Giveaway.findOne({ _id: giveawayId, guildId, ended: false });
        if (!giveaway) return res.status(404).send('القيف أواي غير موجود أو انتهى مسبقًا.');
        await finishGiveaway(giveaway, true);
        return res.redirect(`/manage/${guildId}/giveaway`);
    } catch (error) {
        console.error('[Giveaway Manual End Error]', error.message);
        return res.status(500).send('تعذر إنهاء القيف أواي؛ حاول مجددًا بعد التحقق من الاتصال.');
    }
});
function publicUploadUrl(filePath) {
    const base = (process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/uploads/${encodeURIComponent(path.basename(filePath))}` : null;
}

function keepMessageAttachments(message) {
    return [...(message.attachments?.values?.() || [])].map(file => ({ id: file.id, filename: file.name }));
}

async function refreshGiveawayMessage(giveaway, message) {
    const participantMentions = giveaway.participants.length
        ? giveaway.participants.slice(-30).map(id => `<@${id}>`).join('، ')
        : 'لا يوجد مشاركون حتى الآن';
    const embed = EmbedBuilder.from(message.embeds[0])
        .setDescription(`${giveaway.description || 'لا يوجد وصف'}\n\nالمدة المتبقية: <t:${Math.floor(new Date(giveaway.endAt).getTime() / 1000)}:R>\nعدد الفائزين: ${giveaway.winnersCount}\nعدد المشاركين: ${giveaway.participants.length}`)
        .setFields({ name: 'المشاركون', value: participantMentions.slice(0, 1024) });
    await message.edit({ embeds: [embed], attachments: keepMessageAttachments(message) }).catch(() => {});
}

async function finishGiveaway(giveaway, force = false) {
    const filter = { _id: giveaway._id, ended: false, ...(force ? {} : { endAt: { $lte: new Date() } }) };
    const locked = await Giveaway.findOneAndUpdate(
        filter,
        { $set: { ended: true } },
        { new: true }
    );
    if (!locked) return;

    const guild = client.guilds.cache.get(locked.guildId);
    const channel = guild?.channels.cache.get(locked.channelId);
    if (!channel) return;
    const message = await channel.messages.fetch(locked.messageId).catch(() => null);
    if (!message) return;

    const pool = [...new Set(locked.participants || [])];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const winnerIds = pool.slice(0, Math.min(locked.winnersCount, pool.length));
    const winnersText = winnerIds.length ? winnerIds.map(id => `<@${id}>`).join('، ') : 'لا يوجد فائزون لعدم وجود مشاركين';
    const participantsText = pool.length ? pool.slice(0, 30).map(id => `<@${id}>`).join('، ').slice(0, 1024) : 'لا يوجد مشاركون';
    const finishedEmbed = EmbedBuilder.from(message.embeds[0])
        .setColor(0x00c853)
        .setDescription(`${locked.description || 'لا يوجد وصف'}\n\nانتهى القيف اواي في <t:${Math.floor(new Date(locked.endAt).getTime() / 1000)}:F>\nعدد الفائزين المطلوب: ${locked.winnersCount}\nعدد المشاركين: ${pool.length}`)
        .setFields(
            { name: 'المشاركون', value: participantsText },
            { name: 'الفائزون', value: winnersText }
        )
        .setFooter({ text: 'انتهى القيف اواي' });
    await message.edit({ embeds: [finishedEmbed], components: [], attachments: keepMessageAttachments(message) }).catch(() => {});
    await channel.send({ content: winnerIds.length ? `مبروك للفائزين في قيف اواي **${locked.prize}**: ${winnersText}` : `انتهى قيف اواي **${locked.prize}** بدون فائزين.`, allowedMentions: { parse: [], users: winnerIds } }).catch(() => {});
}

async function checkGiveaways() {
    const expired = await Giveaway.find({ ended: false, endAt: { $lte: new Date() } }).limit(25);
    for (const giveaway of expired) await finishGiveaway(giveaway).catch(err => console.error('[Giveaway Finish Error]', err));
}

let giveawaySweepRunning = false;
const giveawaySweepTimer = setInterval(async () => {
    if (giveawaySweepRunning || mongoose.connection.readyState !== 1) return;
    giveawaySweepRunning = true;
    try { await checkGiveaways(); }
    catch (error) { console.error('[Giveaway Sweep Error]', error); }
    finally { giveawaySweepRunning = false; }
}, 30_000);
giveawaySweepTimer.unref?.();

// --- [ Tickets ] ---
app.get('/manage/:guildId/tickets', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await TicketConfig.findOne({ guildId: g.id }) || { buttons: [], menuOptions: [] };
    const ratingSummary = await TicketRating.aggregate([
        { $match: { guildId: g.id } },
        { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 }, ...Object.fromEntries([1,2,3,4,5].map(score => [`r${score}`, { $sum: { $cond: [{ $eq: ['$rating', score] }, 1, 0] } }])) } }
    ]).catch(() => []);
    const ratingStats = ratingSummary[0] || { average: 0, count: 0, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 };
    const ratingBars = [5,4,3,2,1].map(score => { const count = ratingStats[`r${score}`] || 0; const pct = ratingStats.count ? Math.round(count / ratingStats.count * 100) : 0; return `<div class="rating-row"><span class="rating-score">${score} <span aria-hidden="true">★</span></span><div class="rating-track"><i style="width:${pct}%"></i></div><small>${count}</small></div>`; }).join('');
    let topImg = s.topImagePath ? `/uploads/${path.basename(s.topImagePath)}` : 'https://placehold.co/110x110?text=Top';
    let bottomImg = s.bottomImagePath ? `/uploads/${path.basename(s.bottomImagePath)}` : 'https://placehold.co/110x110?text=Bottom';

    const content = `
    <style>.ticket-rating-overview{display:grid;grid-template-columns:minmax(180px,.7fr) 1.3fr;gap:24px;align-items:center}.rating-score-big{font:800 44px 'IBM Plex Mono',monospace;color:var(--gold)}.rating-stars{color:var(--gold);font-size:23px;letter-spacing:4px}.rating-caption{color:var(--muted);font-size:11px}.rating-bars{display:grid;gap:7px}.rating-row{display:grid;grid-template-columns:42px 1fr 28px;gap:10px;align-items:center;font-size:11px;color:#c8c0b2}.rating-score{color:var(--gold)}.rating-track{height:7px;background:#0d0b08;border-radius:8px;overflow:hidden}.rating-track i{display:block;height:100%;border-radius:8px;background:linear-gradient(90deg,var(--gold-2),var(--gold));transition:width .8s ease}.ticket-intro{display:flex;align-items:center;gap:13px;margin-bottom:18px}.ticket-intro p{color:var(--muted);margin:3px 0;font-size:12px}@media(max-width:650px){.ticket-rating-overview{grid-template-columns:1fr}}</style>
    <section class="card"><div class="ticket-intro"><div class="icon-badge"><svg viewBox="0 0 24 24"><path d="M12 3.5 14.6 9l6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1-6-4.3-4.2 6-.8z"/></svg></div><div><h3 style="margin:0">جودة خدمة التذاكر</h3><p>تقييمات حقيقية يرسلها أصحاب التذاكر بعد إغلاقها.</p></div></div><div class="ticket-rating-overview"><div><div class="rating-score-big">${Number(ratingStats.average).toFixed(1)}<span style="font-size:17px;color:var(--muted)"> / 5</span></div><div class="rating-stars" aria-label="متوسط ${Number(ratingStats.average).toFixed(1)} من 5">${'★'.repeat(Math.round(ratingStats.average))}${'☆'.repeat(5-Math.round(ratingStats.average))}</div><div class="rating-caption">${ratingStats.count} تقييم مكتمل</div></div><div class="rating-bars">${ratingBars}</div></div></section>
    <form action="/save/${g.id}/tickets" method="POST" enctype="multipart/form-data">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>
                إعداد نظام التذاكر
            </h3>

            <div style="display:flex; gap:30px; justify-content:center; margin-bottom:24px;">
                <div style="text-align:center;">
                    <div style="color:var(--text-muted); font-size:12px; margin-bottom:8px;">الصورة العلوية</div>
                    <img src="${topImg}" style="width:100px; height:100px; object-fit:cover; border-radius:12px; border:1px solid var(--gold-border);">
                    <label style="display:block; margin-top:8px; background:var(--gold-glow); border:1px solid var(--gold-border); color:var(--gold); padding:6px 14px; border-radius:8px; cursor:pointer; font-size:12px;">
                        تغيير <input type="file" name="topImage" style="display:none;" accept="image/*">
                    </label>
                </div>
                <div style="text-align:center;">
                    <div style="color:var(--text-muted); font-size:12px; margin-bottom:8px;">الصورة السفلية</div>
                    <img src="${bottomImg}" style="width:100px; height:100px; object-fit:cover; border-radius:12px; border:1px solid var(--gold-border);">
                    <label style="display:block; margin-top:8px; background:var(--gold-glow); border:1px solid var(--gold-border); color:var(--gold); padding:6px 14px; border-radius:8px; cursor:pointer; font-size:12px;">
                        تغيير <input type="file" name="bottomImage" style="display:none;" accept="image/*">
                    </label>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>عنوان التذكرة</label>
                    <input name="title" value="${escapeHtml(s.title || '')}" placeholder="عنوان نظام التذاكر">
                </div>
                <div>
                    <label>لون اللوحة (HEX)</label>
                    <input name="color" value="${escapeHtml(/^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : '#d4af37')}" placeholder="#d4af37" maxlength="7">
                    <small style="color:var(--muted)">يتم تحديد رتبة الإدارة والكاتيجوري بشكل مستقل لكل قسم بالأسفل.</small>
                </div>
            </div>
            <label>الوصف</label>
            <textarea name="description">${escapeHtml(s.description || '')}</textarea>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:16px;">
                <div>
                    <div style="color:var(--gold); font-size:13px; font-weight:700; margin-bottom:10px;">الازرار (حتى 4)</div>
                    ${[0,1,2,3].map(i => `
                    <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px; margin-bottom:8px;">
                        <input name="btn_label_${i}" value="${escapeHtml(s.buttons?.[i]?.label || '')}" placeholder="نص الزر ${i+1}">
                        <input name="btn_emoji_${i}" value="${escapeHtml(s.buttons?.[i]?.emoji || '')}" placeholder="ID الإيموجي">
                        <select name="btn_role_${i}" style="grid-column:1/-1;"><option value="">-- رتبة هذا القسم --</option>${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `<option value="${r.id}" ${s.buttons?.[i]?.adminRole === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}</select>
                        <select name="btn_category_${i}" style="grid-column:1/-1;"><option value="">-- كاتيجوري هذا القسم --</option>${g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => `<option value="${c.id}" ${s.buttons?.[i]?.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
                    </div>`).join('')}
                </div>
                <div>
                    <div style="color:var(--gold); font-size:13px; font-weight:700; margin-bottom:10px;">خيارات المنيو (حتى 4)</div>
                    ${[0,1,2,3].map(i => `
                    <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px; margin-bottom:8px;">
                        <input name="menu_label_${i}" value="${escapeHtml(s.menuOptions?.[i]?.label || '')}" placeholder="خيار ${i+1}">
                        <input name="menu_emoji_${i}" value="${escapeHtml(s.menuOptions?.[i]?.emoji || '')}" placeholder="ID الإيموجي">
                        <input name="menu_description_${i}" value="${escapeHtml(s.menuOptions?.[i]?.description || '')}" placeholder="شرح الخيار الذي سيظهر داخل القائمة" maxlength="100" style="grid-column:1/-1">
                        <select name="menu_role_${i}" style="grid-column:1/-1;"><option value="">-- رتبة هذا القسم --</option>${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `<option value="${r.id}" ${s.menuOptions?.[i]?.adminRole === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}</select>
                        <select name="menu_category_${i}" style="grid-column:1/-1;"><option value="">-- كاتيجوري هذا القسم --</option>${g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => `<option value="${c.id}" ${s.menuOptions?.[i]?.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
                    </div>`).join('')}
                </div>
            </div>

            <label style="margin-top:16px;">قناة الإرسال (اختياري)</label>
            <select name="targetChannel">
                <option value="">-- لا ترسل الآن --</option>
                ${g.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).map(c => `<option value="${c.id}" ${s.channelId === c.id ? 'selected' : ''}># ${escapeHtml(c.name)}</option>`).join('')}
            </select>
            <button class="btn-save" style="margin-top:20px;">حفظ وإرسال</button>
        </div>
    </form>`;

    res.send(ui(g, 'tickets', content));
});

app.post('/save/:guildId/tickets', checkAuth, upload.fields([{ name: 'topImage' }, { name: 'bottomImage' }]), sameOriginAdminWrite, verifyUploadedImages, async (req, res) => {
    try {
        const b = req.body;
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).send('السيرفر غير متاح.');
        const color = /^#[0-9a-f]{6}$/i.test(String(b.color || '')) ? String(b.color) : '#d4af37';
        const title = String(b.title || 'نظام التذاكر').trim().slice(0, 256);
        const description = String(b.description || 'اضغط لفتح تذكرة دعم.').trim().slice(0, 4000);
        const buttons = [], menuOptions = [];
        for (let i = 0; i < 4; i++) {
            const btnLabel = String(b[`btn_label_${i}`] || '').trim().slice(0, 80);
            const btnEmoji = String(b[`btn_emoji_${i}`] || '').trim().slice(0, 100);
            const btnRole = String(b[`btn_role_${i}`] || '');
            const btnCategory = String(b[`btn_category_${i}`] || '');
            const menuLabel = String(b[`menu_label_${i}`] || '').trim().slice(0, 100);
            const menuEmoji = String(b[`menu_emoji_${i}`] || '').trim().slice(0, 100);
            const menuDescription = String(b[`menu_description_${i}`] || '').trim().slice(0, 100);
            const menuRole = String(b[`menu_role_${i}`] || '');
            const menuCategory = String(b[`menu_category_${i}`] || '');
            for (const roleId of [btnRole, menuRole].filter(Boolean)) {
                const role = guild.roles.cache.get(roleId);
                if (!role || role.id === guild.id || role.managed) return res.status(400).send('إحدى رتب الأقسام غير صالحة لهذا السيرفر.');
            }
            for (const categoryId of [btnCategory, menuCategory].filter(Boolean)) {
                const category = guild.channels.cache.get(categoryId);
                if (!category || category.type !== ChannelType.GuildCategory) return res.status(400).send('إحدى فئات التذاكر غير صالحة.');
            }
            if (btnLabel) buttons.push({ label: btnLabel, emoji: btnEmoji, adminRole: btnRole, categoryId: btnCategory });
            if (menuLabel) menuOptions.push({ label: menuLabel, emoji: menuEmoji, description: menuDescription, adminRole: menuRole, categoryId: menuCategory });
        }
        const prior = await TicketConfig.findOne({ guildId: guild.id });
        const updateData = { title, description, color, buttons, menuOptions };
        if (req.files?.topImage?.[0]) updateData.topImagePath = req.files.topImage[0].path;
        if (req.files?.bottomImage?.[0]) updateData.bottomImagePath = req.files.bottomImage[0].path;
        const targetId = String(b.targetChannel || '');
        let channel = null;
        if (targetId) {
            channel = guild.channels.cache.get(targetId);
            if (!channel?.isTextBased?.()) return res.status(400).send('اختر قناة نصية صالحة لإرسال اللوحة.');
            const botMember = guild.members.me;
            const perms = channel.permissionsFor(botMember);
            if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) return res.status(403).send('البوت يحتاج صلاحيات عرض القناة وإرسال الرسائل والروابط المضمنة.');
            updateData.channelId = channel.id;
        }
        const config = await TicketConfig.findOneAndUpdate({ guildId: guild.id }, { $set: updateData }, { upsert: true, new: true, runValidators: true });
        if (req.files?.topImage?.length || req.files?.bottomImage?.length) req.keepUploadedFiles = true;
        if (channel) {
            const files = [];
            const embed = new EmbedBuilder().setTitle(config.title).setDescription(config.description).setColor(parseInt(config.color.slice(1), 16));
            if (config.topImagePath && fs.existsSync(config.topImagePath)) {
                const filename = path.basename(config.topImagePath);
                files.push(new AttachmentBuilder(config.topImagePath, { name: filename }));
                embed.setThumbnail(`attachment://${filename}`);
            }
            if (config.bottomImagePath && fs.existsSync(config.bottomImagePath)) {
                const filename = path.basename(config.bottomImagePath);
                files.push(new AttachmentBuilder(config.bottomImagePath, { name: filename }));
                embed.setImage(`attachment://${filename}`);
            }
            const components = [];
            if (config.buttons?.length) {
                const row = new ActionRowBuilder();
                config.buttons.forEach((btn, i) => {
                    const button = new ButtonBuilder().setCustomId(`ticket_btn_${i}`).setLabel(String(btn.label || '').slice(0, 80)).setStyle(ButtonStyle.Primary);
                    if (btn.emoji) { try { button.setEmoji(/^\d+$/.test(btn.emoji) ? { id: btn.emoji } : btn.emoji); } catch {} }
                    row.addComponents(button);
                });
                components.push(row);
            }
            if (config.menuOptions?.length) {
                const menu = new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('اختر نوع التذكرة...');
                config.menuOptions.forEach((option, i) => {
                    const entry = { label: String(option.label || '').slice(0, 100), value: `ticket_opt_${i}` };
                    if (option.description) entry.description = option.description.slice(0, 100);
                    if (option.emoji) { try { entry.emoji = /^\d+$/.test(option.emoji) ? { id: option.emoji } : option.emoji; } catch {} }
                    menu.addOptions(entry);
                });
                components.push(new ActionRowBuilder().addComponents(menu));
            }
            if (!components.length) components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setStyle(ButtonStyle.Primary)));
            const payload = { embeds: [embed], components, files, allowedMentions: { parse: [] } };
            let oldMessage = null;
            if (prior?.channelId === channel.id && prior.panelMessageId) oldMessage = await channel.messages.fetch(prior.panelMessageId).catch(() => null);
            let panelMessage;
            try {
                panelMessage = oldMessage ? await oldMessage.edit(payload) : await channel.send(payload);
            } catch (sendError) {
                console.error('[Ticket Panel Publish Error]', sendError);
                return res.status(502).send('تم حفظ الإعدادات، لكن تعذر إرسال/تحديث لوحة التذاكر. تحقق من صلاحيات البوت ثم احفظ مجددًا.');
            }
            await TicketConfig.updateOne({ _id: config._id }, { $set: { channelId: channel.id, panelMessageId: panelMessage.id } });
            if (prior?.panelMessageId && prior.channelId && prior.channelId !== channel.id) {
                const oldChannel = guild.channels.cache.get(prior.channelId);
                if (oldChannel?.isTextBased?.()) await oldChannel.messages.delete(prior.panelMessageId).catch(() => {});
            }
        }
        res.redirect(`/manage/${guild.id}/tickets`);
    } catch (error) {
        console.error('[Ticket Save Error]', error);
        res.status(500).send('تعذر حفظ إعدادات التذاكر.');
    }
});

// --- [ Levels ] ---
app.get('/manage/:guildId/levels', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { levels: {} };

    const content = `
    <form method="POST" action="/save/${g.id}/levels">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/></svg>
                إعدادات المستويات
            </h3>
            <div class="toggle-row">
                <label style="color:white; margin:0;">تفعيل نظام المستويات</label>
                <input type="checkbox" name="enabled" ${s.levels?.enabled ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--gold); cursor:pointer;">
            </div>
            <label>XP لكل رسالة</label>
            <input type="number" name="xpPerMessage" value="${s.levels?.xpPerMessage || 10}" min="1" max="500">
            <label>الفاصل بين مكافآت XP (ثوانٍ)</label>
            <input type="number" name="xpCooldownSeconds" value="${s.levels?.xpCooldownSeconds || 60}" min="10" max="300">
            <small style="color:var(--muted)">تُحتسب الرسالة ضمن إجمالي الرسائل دائمًا، وتُمنح XP مرة واحدة فقط خلال الفاصل لتقليل الاستغلال.</small>
            <label>قناة رسائل الترقية</label>
            <select name="levelUpChannel">
                <option value="">-- نفس القناة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.levels?.levelUpChannel === c.id ? 'selected' : ''}># ${escapeHtml(c.name)}</option>`
                ).join('')}
            </select>
            <label>أمر قائمة المتصدرين</label>
            <input name="leaderboardCommand" value="${escapeHtml(s.levels?.leaderboardCommand || '!levels')}" placeholder="!levels">
            <button class="btn-save" style="margin-top:20px;">حفظ الإعدادات</button>
        </div>
    </form>`;

    res.send(ui(g, 'levels', content));
});

app.post('/save/:guildId/levels', checkAuth, sameOriginAdminWrite, async (req, res) => {
    const b = req.body;
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).send('السيرفر غير متاح.');
    const xpPerMessage = Number(b.xpPerMessage);
    if (!Number.isSafeInteger(xpPerMessage) || xpPerMessage < 1 || xpPerMessage > 500) return res.status(400).send('XP لكل رسالة يجب أن يكون عددًا صحيحًا بين 1 و500.');
    const xpCooldownSeconds = Number(b.xpCooldownSeconds);
    if (!Number.isSafeInteger(xpCooldownSeconds) || xpCooldownSeconds < 10 || xpCooldownSeconds > 300) return res.status(400).send('فاصل XP يجب أن يكون بين 10 و300 ثانية.');
    const command = String(b.leaderboardCommand || '!levels').trim();
    if (!command || command.length > 32) return res.status(400).send('أمر المتصدرين مطلوب وبحد أقصى 32 حرفًا.');
    const selectedChannel = b.levelUpChannel ? guild.channels.cache.get(String(b.levelUpChannel)) : null;
    if (b.levelUpChannel && (!selectedChannel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(selectedChannel.type))) return res.status(400).send('قناة الترقية يجب أن تكون قناة نصية في هذا السيرفر.');
    await GuildConfig.findOneAndUpdate(
        { guildId: guild.id },
        { $set: { levels: { enabled: b.enabled === 'on', xpPerMessage, xpCooldownSeconds, levelUpChannel: selectedChannel?.id || '', leaderboardCommand: command } } },
        { upsert: true, runValidators: true }
    );
    res.redirect(`/manage/${guild.id}/levels`);
});

// --- [ Notification Roles ] ---
app.get('/manage/:guildId/notificationroles', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect('/dashboard');
    const config = await GuildConfig.findOne({ guildId: guild.id }).lean() || {};
    const settings = config.notificationRoles || {};
    const textChannels = guild.channels.cache.filter(channel =>
        channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement
    );
    const roleOptions = guild.roles.cache.filter(role => role.name !== '@everyone');
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
    const content = `
    <div class="card">
        <h3><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>رتب الإشعارات</h3>
        <p style="color:var(--muted);line-height:1.9">ارفع صورة اللوحة، اختر قناة أو أكثر، ثم حدّد الرتب وأسماء العرض والإيموجيات. عند الحفظ تُرسل اللوحة للقنوات المختارة.</p>
        <form method="POST" action="/save/${guild.id}/notificationroles" enctype="multipart/form-data">
            <label>صورة اللوحة</label>
            <input type="file" name="notificationImage" accept="image/*">
            ${settings.imagePath ? '<p style="color:var(--muted);font-size:11px">توجد صورة محفوظة؛ رفع صورة جديدة يستبدلها.</p>' : ''}
            <label>القنوات (يمكن اختيار أكثر من قناة)</label>
            <select name="notificationChannels" multiple size="6" style="min-height:130px">
                ${textChannels.map(channel => `<option value="${channel.id}" ${(settings.channelIds || []).includes(channel.id) ? 'selected' : ''}># ${escapeHtml(channel.name)}</option>`).join('')}
            </select>
            <div style="margin-top:20px;color:var(--gold);font-weight:700;font-size:13px">الرتب (حتى ٨)</div>
            ${Array.from({ length: 8 }, (_, index) => {
                const item = settings.roles?.[index] || {};
                return `<div style="display:grid;grid-template-columns:1.4fr 1.2fr .9fr;gap:10px;margin-top:10px">
                    <select name="notificationRole_${index}"><option value="">-- اختر رتبة --</option>${roleOptions.map(role => `<option value="${role.id}" ${item.roleId === role.id ? 'selected' : ''}>${escapeHtml(role.name)}</option>`).join('')}</select>
                    <input name="notificationLabel_${index}" value="${escapeHtml(item.label || '')}" placeholder="اسم العرض ${index + 1}" maxlength="100">
                    <input name="notificationEmoji_${index}" value="${escapeHtml(item.emoji || '')}" placeholder="إيموجي أو ID">
                </div>`;
            }).join('')}
            <button class="btn-save" style="margin-top:18px">حفظ وإرسال اللوحة</button>
        </form>
    </div>`;
    res.send(ui(guild, 'notificationroles', content));
});

app.post('/save/:guildId/notificationroles', checkAuth, upload.single('notificationImage'), sameOriginAdminWrite, verifyUploadedImages, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect('/dashboard');
    const previous = await GuildConfig.findOne({ guildId }).lean();
    const previousSettings = previous?.notificationRoles || {};
    const previousPanels = previousSettings.panels || [];
    const postedChannels = Array.isArray(req.body.notificationChannels)
        ? req.body.notificationChannels
        : req.body.notificationChannels ? [req.body.notificationChannels] : [];
    const channelIds = [...new Set(postedChannels.filter(channelId => {
        const channel = guild.channels.cache.get(channelId);
        return channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement);
    }))];
    const roles = [];
    for (let index = 0; index < 8; index++) {
        const roleId = String(req.body[`notificationRole_${index}`] || '');
        const label = String(req.body[`notificationLabel_${index}`] || '').trim();
        const emoji = String(req.body[`notificationEmoji_${index}`] || '').trim();
        if (roleId && label && guild.roles.cache.has(roleId) && !roles.some(item => item.roleId === roleId)) {
            roles.push({ roleId, label: label.slice(0, 100), emoji: emoji.slice(0, 100) });
        }
    }
    const imagePath = req.file?.path || previousSettings.imagePath || '';
    await GuildConfig.findOneAndUpdate(
        { guildId },
        { $set: { notificationRoles: { imagePath, channelIds, roles, panels: previousPanels } } },
        { upsert: true, new: true }
    );
    if (req.file) req.keepUploadedFiles = true;
    if (roles.length) {
        const options = roles.map(item => {
            const option = { label: item.label, value: item.roleId };
            if (item.emoji) {
                const emojiId = item.emoji.match(/\d{15,}/)?.[0];
                if (emojiId) {
                    const customEmoji = guild.emojis.cache.get(emojiId);
                    if (customEmoji) option.emoji = { id: customEmoji.id, name: customEmoji.name, animated: customEmoji.animated };
                } else if (/\p{Extended_Pictographic}/u.test(item.emoji) && [...item.emoji].length <= 8) {
                    option.emoji = { name: item.emoji };
                }
            }
            return option;
        });
        options.push({ label: 'ريست منيو', value: '__notification_roles_reset__', description: 'إعادة ضبط القائمة فقط' });
        const menu = new StringSelectMenuBuilder()
            .setCustomId('notification_roles_menu')
            .setPlaceholder('اختر رتبتك أو ريست منيو')
            .addOptions(options);
        const embed = new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle('رتب الإشعارات')
            .setDescription('اختر الرتبة التي تريد الحصول عليها من القائمة أدناه.');
        const guildIcon = guild.iconURL({ size: 128 });
        if (guildIcon) embed.setThumbnail(guildIcon);
        const files = [];
        if (imagePath && fs.existsSync(imagePath)) {
            const filename = path.basename(imagePath);
            embed.setImage(`attachment://${filename}`);
            files.push({ attachment: imagePath, name: filename });
        }
    }
    const panels = [];
    if (roles.length) {
        const components = [new ActionRowBuilder().addComponents(menu)];
        for (const channelId of channelIds) {
            const channel = guild.channels.cache.get(channelId);
            if (!channel?.isTextBased?.()) continue;
            const prior = previousPanels.find(panel => panel.channelId === channelId);
            const existing = prior ? await channel.messages.fetch(prior.messageId).catch(() => null) : null;
            try {
                if (existing) {
                    await existing.edit({ embeds: [embed], components, files, attachments: [], allowedMentions: { parse: [] } });
                    panels.push({ channelId, messageId: existing.id });
                } else {
                    const sent = await channel.send({ embeds: [embed], files, components, allowedMentions: { parse: [] } });
                    panels.push({ channelId, messageId: sent.id });
                }
            } catch (error) { console.error('[Notification Roles Panel Error]', { channelId, error: error.message }); }
        }
    }
    for (const prior of previousPanels) {
        if (channelIds.includes(prior.channelId) && panels.some(panel => panel.channelId === prior.channelId)) continue;
        const channel = guild.channels.cache.get(prior.channelId);
        const existing = channel ? await channel.messages.fetch(prior.messageId).catch(() => null) : null;
        if (existing) await existing.edit({ components: [] }).catch(() => {});
    }
    await GuildConfig.findOneAndUpdate({ guildId }, { $set: { 'notificationRoles.panels': panels } }, { upsert: true });
    res.redirect(`/manage/${guildId}/notificationroles`);
});

// ==========================================
// 10. Discord Event Handlers
// ==========================================

const xpCooldowns = new Map();

client.on('messageCreate', async (msg) => {if (!msg.guild || msg.author.bot) return;
    try {

    // --- [ أوامر الإشراف النصية: تحقق رتب وحدود ونتائج API فعلية ] ---
    const adminCfg = await AdminCmdConfig.findOne({ guildId: msg.guild.id }).lean().catch(() => null);
    const defaultShortcuts = { lock: '-ق', unlock: '-ف', timeout: '-ت', untimeout: '-فت', ban: '-ب', unban: '-فب', kick: '-ك' };
    const args = msg.content.trim().split(/\s+/);
    const entry = Object.entries(defaultShortcuts).find(([key, value]) => (adminCfg?.settings?.[key]?.shortcut || value) === args[0]);
    if (entry) {
        const [actionKey] = entry;
        const configRoles = adminCfg?.adminRoles || [];
        const hasPerm = msg.member.permissions.has(PermissionFlagsBits.Administrator) || msg.member.roles.cache.some(role => configRoles.includes(role.id));
        if (!hasPerm) return;
        let resultText = '';
        let target = null;
        try {
            if (['lock', 'unlock'].includes(actionKey)) {
                const state = await setManagedChannelLock(msg.guild, msg.channel, actionKey === 'lock', msg.author.id);
                resultText = state === 'not-managed-locked' ? 'لا يوجد قفل Drayz سابق لاستعادته؛ لم تتغير الصلاحيات.' : actionKey === 'lock' ? 'تم قفل القناة وحفظ صلاحياتها السابقة.' : 'تم فتح القناة واستعادة صلاحياتها السابقة.';
            } else if (actionKey === 'unban') {
                const id = args[1];
                if (!/^\d{17,20}$/.test(id || '')) resultText = 'استخدم: -فب USER_ID';
                else { await msg.guild.members.unban(id, 'أمر إداري نصي'); resultText = 'تم فك الحظر عن العضو.'; }
            } else {
                target = msg.mentions.members.first() || (args[1] ? await msg.guild.members.fetch(args[1]).catch(() => null) : null);
                if (!target) resultText = `استخدم الأمر مع عضو صالح. مثال: ${args[0]} @عضو`;
                else {
                    const actorIsOwner = msg.author.id === msg.guild.ownerId;
                    const actorIsAdmin = msg.member.permissions.has(PermissionFlagsBits.Administrator);
                    if (target.id === msg.author.id) resultText = 'لا يمكنك تنفيذ هذا الإجراء على نفسك.';
                    else if (target.id === msg.guild.ownerId && !actorIsOwner) resultText = 'لا يمكن تنفيذ الإجراء على مالك السيرفر.';
                    else if (!actorIsOwner && !actorIsAdmin && msg.member.roles.highest.comparePositionTo(target.roles.highest) <= 0) resultText = 'رتبة العضو المستهدف يجب أن تكون أدنى من رتبتك.';
                    else if (!msg.guild.members.me || target.roles.highest.comparePositionTo(msg.guild.members.me.roles.highest) >= 0) resultText = 'رتبة العضو المستهدف أعلى من رتبة البوت أو مساوية لها.';
                    else if (actionKey === 'timeout') {
                        const mins = Number(args[2] || 60);
                        if (!Number.isSafeInteger(mins) || mins < 1 || mins > 40320) resultText = 'مدة التايم أوت يجب أن تكون بين 1 و40320 دقيقة.';
                        else if (!target.moderatable) resultText = 'لا يملك البوت صلاحية كافية لتطبيق التايم أوت.';
                        else { await target.timeout(mins * 60 * 1000, args.slice(3).join(' ').slice(0, 400) || 'أمر إداري'); resultText = `تم إعطاء تايم أوت لـ ${target.user.username} لمدة ${mins} دقيقة.`; }
                    } else if (actionKey === 'untimeout') {
                        if (!target.moderatable) resultText = 'لا يملك البوت صلاحية كافية لفك التايم أوت.';
                        else { await target.timeout(null, 'أمر إداري'); resultText = `تم فك التايم أوت عن ${target.user.username}.`; }
                    } else if (actionKey === 'ban') {
                        if (!target.bannable) resultText = 'لا يملك البوت صلاحية حظر هذا العضو.';
                        else { await target.ban({ reason: args.slice(2).join(' ').slice(0, 400) || 'أمر إداري' }); resultText = `تم حظر ${target.user.username}.`; }
                    } else if (actionKey === 'kick') {
                        if (!target.kickable) resultText = 'لا يملك البوت صلاحية طرد هذا العضو.';
                        else { await target.kick(args.slice(2).join(' ').slice(0, 400) || 'أمر إداري'); resultText = `تم طرد ${target.user.username}.`; }
                    }
                }
            }
        } catch (error) {
            console.error('[Text Moderation Command Error]', { actionKey, guildId: msg.guild.id, error: error.message });
            resultText = 'فشل تنفيذ الأمر؛ تحقق من صلاحيات البوت ومدخلات الأمر.';
        }
        if (adminCfg?.settings?.[actionKey]?.delUser) await msg.delete().catch(() => {});
        const resultMsg = await msg.channel.send({ content: resultText || 'تم تنفيذ العملية.', allowedMentions: { parse: [] } }).catch(() => null);
        if (resultMsg && adminCfg?.settings?.[actionKey]?.delBot) setTimeout(() => resultMsg.delete().catch(() => {}), 5000).unref?.();
        return;
    }

    // --- [ نظام الاقتراحات ] ---
    try {
        const sugCfg = await SuggestionConfig.findOne({ guildId: msg.guild.id, channelId: msg.channel.id });
        if (sugCfg) {
            const content = msg.content?.trim();
            const attachmentImg = msg.attachments.find(a => a.contentType?.startsWith('image/'));
            if (content || attachmentImg) {
                const authorAvatar = msg.author.displayAvatarURL({ dynamic: true });
                await msg.delete().catch(() => {});

                const embed = new EmbedBuilder()
                    .setAuthor({ name: `اقتراح من ${msg.author.username}`, iconURL: authorAvatar })
                    .setDescription(content || '*بدون نص*')
                    .setColor(0xd4af37)
                    .setFooter({ text: 'Drayz System  - Suggestions' })
                    .setTimestamp()
                    .addFields(
                        { name: getEmojiDisplay(msg.guild, sugCfg.emoji1), value: '0', inline: true },
                        { name: getEmojiDisplay(msg.guild, sugCfg.emoji2), value: '0', inline: true }
                    );

                
                const files = [];
                const dashboardUrl = process.env.RENDER_EXTERNAL_URL || '';
                if (attachmentImg) {
                    embed.setImage(attachmentImg.url);
                } else if (sugCfg.imageUrl) {
                    embed.setImage(sugCfg.imageUrl);
                } else if (sugCfg.imagePath && fs.existsSync(sugCfg.imagePath)) {
                    const imgName = path.basename(sugCfg.imagePath);
                    if (dashboardUrl) {
                        embed.setImage(`${dashboardUrl.replace(/\/$/, '')}/uploads/${imgName}`);
                    } else {
                        files.push(new AttachmentBuilder(sugCfg.imagePath, { name: imgName }));
                        embed.setImage(`attachment://${imgName}`);
                    }
                }


                const menu = new StringSelectMenuBuilder()
                    .setCustomId('suggestion_menu')
                    .setPlaceholder('إجراءات الإدارة على الاقتراح')
                    .addOptions(
                        { label: 'الرد على الاقتراح', value: 'reply', emoji: '💬' },
                        { label: 'قبول الاقتراح', value: 'accept', emoji: '✅' },
                        { label: 'حذف الاقتراح', value: 'delete', emoji: '🗑️' }
                    );

                let sentMsg = null;
                try {
                    sentMsg = await msg.channel.send({
                        embeds: [embed],
                        components: [new ActionRowBuilder().addComponents(menu)],
                        files,
                        allowedMentions: { parse: [] }
                    });
                    await Suggestion.create({
                        guildId: msg.guild.id,
                        messageId: sentMsg.id,
                        channelId: msg.channel.id,
                        authorId: msg.author.id,
                        content: content || ''
                    });
                } catch (creationError) {
                    if (sentMsg) await sentMsg.delete().catch(() => {});
                    throw creationError;
                }

                const emojiObj1 = msg.guild.emojis.cache.get(sugCfg.emoji1);
                const emojiObj2 = msg.guild.emojis.cache.get(sugCfg.emoji2);
                if (sugCfg.emoji1) await sentMsg.react(emojiObj1 || sugCfg.emoji1).catch(() => {});
                if (sugCfg.emoji2) await sentMsg.react(emojiObj2 || sugCfg.emoji2).catch(() => {});
            }
            return;
        }
    } catch (err) {
        console.error('[Suggestion Error]', err);
    }

    const s = await GuildConfig.findOne({ guildId: msg.guild.id });
    if (!s) return;

    // --- [ أمر قائمة المتصدرين ] ---
    if (s.levels?.enabled && s.levels.leaderboardCommand) {
        if (msg.content.trim() === s.levels.leaderboardCommand.trim()) {
            const topLevels = await UserLevel.find({ guildId: msg.guild.id }).sort({ level: -1, xp: -1 }).limit(15);
            if (topLevels.length === 0) return msg.reply('لا توجد بيانات مستويات.');

            const embed = new EmbedBuilder()
                .setTitle(`اعلى 15 ليفل في السيرفر`)
                .setColor(0xd4af37)
                .setThumbnail(msg.guild.iconURL({ dynamic: true }))
                .setTimestamp();

            let desc = topLevels.map((u, i) => {
                const medal = i === 0 ? '(1)' : i === 1 ? '(2)' : i === 2 ? '(3)' : `#${i + 1}`;
                return `${medal} | <@${u.userId}> — ليفل: \`${u.level}\` (رسائل: \`${u.msgCount || 0}\`)`;
            }).join('\n');
            embed.setDescription(desc);
            return msg.reply({ embeds: [embed] });
        }
    }

    // --- [ أمر -خط ] ---
    if (msg.content === '-خط') {
        const sConfig = await GuildConfig.findOne({ guildId: msg.guild.id });
        const savedBanner = sConfig?.welcome?.bannerURL;
        if (!savedBanner) return msg.reply('لم يتم ضبط بنر لهذا السيرفر بعد. استخدم /setbanner أولاً.');
        await msg.delete().catch(() => {});
        return msg.channel.send({ files: [savedBanner] });
    }


    // --- [ إحصائيات الرسائل ] ---
    await updateMessageStats(msg.guild.id, msg.channel.id).catch(error => console.error('[Message Stats Error]', error.message));

    // --- [ نظام الحماية ] ---
    const hasBypass = msg.member.roles.cache.some(role => s.security?.bypassRoles?.includes(role.id));
    if (!hasBypass) {
        if (s.security?.badWords && s.security.badWords.trim().length > 0) {
            const forbiddenWords = s.security.badWords.split(',').map(w => w.trim()).filter(Boolean);
            const hasBadWord = forbiddenWords.some(word => {
                try {
                    const literal = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`(?:^|[^أ-يa-zA-Z0-9])${literal}(?:[^أ-يa-zA-Z0-9]|$)`, 'iu');
                    return regex.test(msg.content);
                } catch { return msg.content.includes(word); }
            });
            if (hasBadWord) {
                await applySecurityViolation(msg, 'كلمة محظورة', s.security?.punishment || 'delete');
                return;
            }
        }

        if (s.security?.badEmojis && s.security.badEmojis.trim().length > 0) {
            const forbiddenEmojis = s.security.badEmojis.split(',').map(e => e.trim()).filter(Boolean);
            const hasBadEmoji = forbiddenEmojis.some(emoji => msg.content.includes(emoji));
            if (hasBadEmoji) {
                await applySecurityViolation(msg, 'إيموجي محظور', s.security?.punishment || 'delete');
                return;
            }
        }

        if (s.security?.antiLinks && /(?:https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i.test(msg.content)) {
            await applySecurityViolation(msg, 'رابط غير مسموح', s.security?.punishment || 'delete');
            return;
        }
    }

    // --- [ الرد الآلي ] ---
    const r = s.autoReply?.find(x => x.trigger && msg.content.toLowerCase() === x.trigger.toLowerCase());
    if (r) return msg.reply({ content: r.reply, allowedMentions: { parse: [] } }).catch(() => {});

    // --- [ نظام المستويات ] ---
    if (s.levels?.enabled) {
        const rawXp = Number(s.levels.xpPerMessage);
        const xpGain = Number.isSafeInteger(rawXp) && rawXp >= 1 && rawXp <= 500 ? rawXp : 10;
        const cooldownSeconds = Number.isSafeInteger(Number(s.levels.xpCooldownSeconds)) ? Math.min(300, Math.max(10, Number(s.levels.xpCooldownSeconds))) : 60;
        const cooldownKey = `${msg.guild.id}:${msg.author.id}`;
        const nowMs = Date.now();
        const lastAward = xpCooldowns.get(cooldownKey) || 0;
        const shouldAwardXp = nowMs - lastAward >= cooldownSeconds * 1000;
        if (shouldAwardXp) xpCooldowns.set(cooldownKey, nowMs);
        if (xpCooldowns.size > 50_000) for (const [key, stamp] of xpCooldowns) if (nowMs - stamp > 10 * 60_000) xpCooldowns.delete(key);
        const memberLevel = await UserLevel.findOneAndUpdate(
            { guildId: msg.guild.id, userId: msg.author.id },
            { $inc: { xp: shouldAwardXp ? xpGain : 0, msgCount: 1 } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        let earnedLevel = Math.max(1, Number(memberLevel.level) || 1);
        while (memberLevel.xp >= earnedLevel * earnedLevel * 100) earnedLevel++;
        if (earnedLevel > memberLevel.level) {
            const levelUpdate = await UserLevel.updateOne(
                { _id: memberLevel._id, level: { $lt: earnedLevel } },
                { $max: { level: earnedLevel } }
            );
            if (levelUpdate.modifiedCount) {
                const configuredChannel = s.levels.levelUpChannel ? msg.guild.channels.cache.get(s.levels.levelUpChannel) : null;
                const lvChannel = configuredChannel?.isTextBased?.() ? configuredChannel : msg.channel;
                await lvChannel.send({ content: `مبروك ${msg.author}! وصلت للمستوى **${earnedLevel}**`, allowedMentions: { users: [msg.author.id] } }).catch(() => {});
            }
        }
    }

    // --- [ أمر !setup لبانل التذاكر ] ---
    if (msg.content === '!setup' && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const tConfig = await TicketConfig.findOne({ guildId: msg.guild.id });
        if (!tConfig) return msg.reply('اضبط الإعدادات من الداشبورد أولاً!');

        const embed = new EmbedBuilder()
            .setTitle(tConfig.title || 'الدعم الفني')
            .setDescription(tConfig.description || 'اضغط أدناه لفتح تذكرة')
            .setColor(parseInt((tConfig.color || '#d4af37').replace('#', ''), 16));

        const files = [];
        if (tConfig.topImagePath && fs.existsSync(tConfig.topImagePath)) {
            const topName = path.basename(tConfig.topImagePath);
            files.push(new AttachmentBuilder(tConfig.topImagePath, { name: topName }));
            embed.setThumbnail(`attachment://${topName}`);
        }
        if (tConfig.bottomImagePath && fs.existsSync(tConfig.bottomImagePath)) {
            const bottomName = path.basename(tConfig.bottomImagePath);
            files.push(new AttachmentBuilder(tConfig.bottomImagePath, { name: bottomName }));
            embed.setImage(`attachment://${bottomName}`);
        }

        const components = [];
        if (Array.isArray(tConfig.buttons) && tConfig.buttons.length > 0) {
            const btnRow = new ActionRowBuilder();
            tConfig.buttons.forEach((btn, i) => {
                if (!btn.label) return;
                const button = new ButtonBuilder().setCustomId(`ticket_btn_${i}`).setLabel(String(btn.label || '').slice(0, 80)).setStyle(ButtonStyle.Primary);
                if (btn.emoji) {
                    const em = btn.emoji.trim();
                    try { button.setEmoji(/^\d+$/.test(em) ? { id: em } : em); } catch (e) {}
                }
                btnRow.addComponents(button);
            });
            if (btnRow.components.length > 0) components.push(btnRow);
        }
        if (Array.isArray(tConfig.menuOptions) && tConfig.menuOptions.length > 0) {
            const select = new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('اختر من القائمة...');
            tConfig.menuOptions.forEach((opt, i) => {
                if (!opt.label) return;
                const option = { label: String(opt.label || '').slice(0, 100), value: `ticket_opt_${i}` };
                if (opt.description) option.description = String(opt.description).slice(0, 100);
                if (opt.emoji) {
                    const em = opt.emoji.trim();
                    try { option.emoji = /^\d+$/.test(em) ? { id: em } : em; } catch (e) {}
                }
                select.addOptions(option);
            });
            if (select.options.length > 0) components.push(new ActionRowBuilder().addComponents(select));
        }
        if (components.length === 0) {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setStyle(ButtonStyle.Primary)
            ));
        }
        return msg.channel.send({ embeds: [embed], components, files });
    }

    // --- [ أمر !profile ] ---
    if (msg.content.startsWith('!profile')) {
        const target = msg.mentions.users.first() || msg.author;
        await msg.channel.sendTyping();

        const uData = await UserLevel.findOne({ guildId: msg.guild.id, userId: target.id }) || { level: 1, xp: 0, msgCount: 0 };

        const canvas = createCanvas(850, 500);
        const ctx = canvas.getContext('2d');

        const bgGradient = ctx.createLinearGradient(0, 0, 850, 500);
        bgGradient.addColorStop(0, '#050510');
        bgGradient.addColorStop(0.5, '#0a0a20');
        bgGradient.addColorStop(1, '#050510');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, 850, 500);

        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, 834, 484);

        ctx.save();
        ctx.beginPath();
        ctx.arc(150, 150, 90, 0, Math.PI * 2);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.clip();
        const avatar = await loadImage(target.displayAvatarURL({ extension: 'png', size: 512 }));
        ctx.drawImage(avatar, 60, 60, 180, 180);
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 45px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(target.username, 270, 130);

        ctx.font = '28px Arial';
        ctx.fillStyle = '#d4af37';
        ctx.fillText(`XP: ${uData.xp || 0}`, 270, 175);

        function drawStatBox(x, y, label, value) {
            ctx.fillStyle = 'rgba(30, 144, 255, 0.08)';
            ctx.beginPath();
            ctx.roundRect(x, y, 240, 160, 16);
            ctx.fill();
            ctx.strokeStyle = 'rgba(30, 144, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#d4af37';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(label, x + 120, y + 48);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 48px Arial';
            ctx.fillText(value, x + 120, y + 118);
        }

        drawStatBox(50, 300, 'LEVEL', uData.level);
        drawStatBox(305, 300, 'XP', uData.xp || 0);
        drawStatBox(560, 300, 'MESSAGES', uData.msgCount || 0);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'drayz-profile.png' });
        await msg.reply({ files: [attachment] });
    }
    } catch (error) {
        console.error('[Message Create Error]', { guildId: msg.guild?.id, userId: msg.author?.id, message: error.message });
    }

});

// --- [ تصويت الاقتراحات ] ---
async function updateSuggestionVotes(reaction, user, isAdd) {
    try {
        if (user.bot) return;
        if (reaction.partial) { try { reaction = await reaction.fetch(); } catch { return; } }
        let message = reaction.message;
        if (message.partial) { try { message = await message.fetch(); } catch { return; } }
        if (!message.guild) return;

        const suggestion = await Suggestion.findOne({ guildId: message.guild.id, messageId: message.id });
        if (!suggestion || suggestion.status !== 'pending') return;

        const sugCfg = await SuggestionConfig.findOne({ guildId: message.guild.id });
        if (!sugCfg) return;

        const emojiId = reaction.emoji.id || reaction.emoji.name;
        let field, otherField;
        if (emojiId === sugCfg.emoji1) { field = 'votes1'; otherField = 'votes2'; }
        else if (emojiId === sugCfg.emoji2) { field = 'votes2'; otherField = 'votes1'; }
        else return;

        const update = isAdd
            ? { $addToSet: { [field]: user.id }, $pull: { [otherField]: user.id } }
            : { $pull: { [field]: user.id } };
        await Suggestion.updateOne({ _id: suggestion._id, status: 'pending' }, update);
        const latest = await Suggestion.findById(suggestion._id).lean();
        if (!latest || latest.status !== 'pending') return;

        const embed = EmbedBuilder.from(message.embeds[0]);
        embed.setFields(
            { name: getEmojiDisplay(message.guild, sugCfg.emoji1), value: `${latest.votes1.length}`, inline: true },
            { name: getEmojiDisplay(message.guild, sugCfg.emoji2), value: `${latest.votes2.length}`, inline: true }
        );
        await message.edit({ embeds: [embed] }).catch(() => {});
    } catch (err) {
        console.error('[Suggestion Vote Error]', err);
    }
}

client.on('messageReactionAdd', (reaction, user) => updateSuggestionVotes(reaction, user, true));
client.on('messageReactionRemove', (reaction, user) => updateSuggestionVotes(reaction, user, false));

// ==========================================
// 11. Audit Log Events (بدون إيموجي في اللوق)
// ==========================================

const LOG_COLORS = {
    success: 0x2ecc71,
    info: 0x3498db,
    warning: 0xf1c40f,
    danger: 0xe74c3c,
    moderation: 0x8e44ad
};

function logValue(value, fallback = 'غير متوفر') {
    const text = String(value ?? '').trim();
    return text ? text.slice(0, 1024) : fallback;
}

function logUser(userOrMember, fallback = 'غير معروف') {
    const user = userOrMember?.user || userOrMember;
    if (!user?.id) return fallback;
    return `${user.tag || user.username || 'عضو'} (<@${user.id}>)`;
}

function logFooter(guild, actor, target) {
    const actorId = actor?.id || actor?.user?.id || 'غير معروف';
    const targetId = target?.id || target?.user?.id || 'غير معروف';
    return `السيرفر: ${guild?.id || 'غير معروف'} | المنفذ: ${actorId} | الهدف: ${targetId}`;
}

function buildLogEmbed({ title, color, guild, actor, target, fields = [], description, thumbnail, image }) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: logFooter(guild, actor, target) });
    if (description) embed.setDescription(logValue(description));
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image) embed.setImage(image);
    if (fields.length) embed.addFields(fields.map(field => ({ ...field, name: logValue(field.name), value: logValue(field.value) })));
    return embed;
}

async function findRecentExecutor(guild, type, targetId, maxAge = 15000) {
    try {
        const audit = await guild.fetchAuditLogs({ type, limit: 10 });
        const entry = audit.entries.find(item => {
            const age = Date.now() - item.createdTimestamp;
            return age >= -2000 && age <= maxAge && (!targetId || item.target?.id === targetId);
        });
        return entry?.executor || null;
    } catch {
        return null;
    }
}

client.on('messageDelete', async (message) => {
    if (!message?.guild || !message?.author || !message?.channel) return;
    const executor = await findRecentExecutor(message.guild, AuditLogEvent.MessageDelete, message.author.id);
    const attachments = [...(message.attachments?.values?.() || [])];
    const attachmentText = attachments.length
        ? attachments.map(file => `${file.name || 'ملف'}: ${file.url}`).join('\n')
        : 'لا توجد صور أو ملفات مرفقة';
    const image = attachments.find(file => file.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name || ''))?.url;
    const messageUrl = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
    const embed = buildLogEmbed({
        title: 'حذف رسالة', color: LOG_COLORS.danger, guild: message.guild, actor: executor, target: message.author,
        description: `تم حذف رسالة في ${message.channel}.\n[فتح رابط الرسالة](${messageUrl})`,
        image,
        fields: [
            { name: 'كاتب الرسالة', value: logUser(message.author), inline: true },
            { name: 'المنفذ', value: executor ? logUser(executor) : 'غير معروف أو حذف ذاتي', inline: true },
            { name: 'القناة', value: `${message.channel.name} (<#${message.channel.id}>)`, inline: true },
            { name: 'المحتوى المحذوف', value: message.content || '(لا يوجد نص)' },
            { name: 'الصور والملفات المحذوفة', value: attachmentText }
        ]
    });
    await sendLog(message.guild, 'messages', embed);
    await recordMemberHistory({ guildId: message.guild.id, userId: message.author.id, type: 'deleted', channelId: message.channel.id, channelName: message.channel.name, messageId: message.id, content: message.content });
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (!oldMsg?.guild || !oldMsg?.author || !oldMsg?.channel || !newMsg?.channel || oldMsg.author.bot) return;
    if (oldMsg.content === newMsg.content && oldMsg.attachments?.size === newMsg.attachments?.size) return;
    const messageUrl = `https://discord.com/channels/${oldMsg.guild.id}/${oldMsg.channel.id}/${oldMsg.id}`;
    const embed = buildLogEmbed({
        title: 'تعديل رسالة', color: LOG_COLORS.success, guild: oldMsg.guild, actor: oldMsg.author, target: oldMsg.author,
        description: `[فتح رابط الرسالة](${messageUrl})`,
        fields: [
            { name: 'العضو', value: logUser(oldMsg.author), inline: true },
            { name: 'القناة', value: `${oldMsg.channel.name} (<#${oldMsg.channel.id}>)`, inline: true },
            { name: 'قبل التعديل', value: oldMsg.content || '(فارغ)' },
            { name: 'بعد التعديل', value: newMsg.content || '(فارغ)' }
        ]
    });
    await sendLog(oldMsg.guild, 'messages', embed);
    await recordMemberHistory({ guildId: oldMsg.guild.id, userId: oldMsg.author.id, type: 'edited', channelId: oldMsg.channel.id, channelName: oldMsg.channel.name, messageId: oldMsg.id, before: oldMsg.content, after: newMsg.content });
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!newMember?.guild) return;
    const added = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removed = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
    const roleExecutor = await findRecentExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
    const operationTime = `<t:${Math.floor(Date.now() / 1000)}:F>\n<t:${Math.floor(Date.now() / 1000)}:R>`;
    const sendRoleLog = async (role, addedRole) => {
        const action = addedRole ? 'منح رتبة' : 'إزالة رتبة';
        const actionColor = addedRole ? LOG_COLORS.success : LOG_COLORS.danger;
        const roleMention = addedRole ? `<@&${role.id}>` : `@${role.name}`;
        const embed = buildLogEmbed({
            title: `سجل الرتب | ${action}`,
            color: actionColor,
            guild: newMember.guild,
            actor: roleExecutor,
            target: newMember,
            thumbnail: newMember.user?.displayAvatarURL?.({ dynamic: true }),
            description: `تم ${addedRole ? 'إعطاء' : 'إزالة'} رتبة ${roleMention} من العضو بنجاح.`,
            fields: [
                { name: 'نوع العملية', value: addedRole ? 'إضافة رتبة إلى العضو' : 'إزالة رتبة من العضو', inline: true },
                { name: 'وقت العملية', value: operationTime, inline: true },
                { name: 'العضو المستهدف', value: logUser(newMember), inline: true },
                { name: 'معرّف العضو', value: newMember.id, inline: true },
                { name: 'الرتبة', value: `${role.name}\n${roleMention}`, inline: true },
                { name: 'معرّف الرتبة', value: role.id, inline: true },
                { name: 'المشرف المنفذ', value: roleExecutor ? logUser(roleExecutor) : 'غير معروف أو تعديل ذاتي', inline: true },
                { name: 'معرّف المنفذ', value: roleExecutor?.id || 'غير معروف', inline: true },
                { name: 'السيرفر', value: `${newMember.guild.name}\n${newMember.guild.id}`, inline: true }
            ]
        });
        await sendLog(newMember.guild, 'roles', embed);
        await recordMemberHistory({ guildId: newMember.guild.id, userId: newMember.id, type: addedRole ? 'role_added' : 'role_removed', roleId: role.id, roleName: role.name, executorId: roleExecutor?.id });
    };
    for (const role of added.values()) await sendRoleLog(role, true);
    for (const role of removed.values()) await sendRoleLog(role, false);

    if (oldMember.nickname !== newMember.nickname) {
        const actor = await findRecentExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
        const embed = buildLogEmbed({ title: 'تغيير الاسم المستعار', color: LOG_COLORS.success, guild: newMember.guild, actor, target: newMember, fields: [
            { name: 'العضو', value: logUser(newMember), inline: true },
            { name: 'الاسم السابق', value: oldMember.nickname || 'بدون اسم مستعار', inline: true },
            { name: 'الاسم الجديد', value: newMember.nickname || 'بدون اسم مستعار', inline: true },
            { name: 'المنفذ', value: actor ? logUser(actor) : 'العضو نفسه أو غير معروف', inline: true }
        ] });
        await sendLog(newMember.guild, 'members', embed);
    }

    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
        const actor = await findRecentExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
        const timedOut = Boolean(newMember.communicationDisabledUntilTimestamp);
        const until = newMember.communicationDisabledUntilTimestamp
            ? `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>` : 'تمت إزالة التايم أوت';
        const embed = buildLogEmbed({ title: timedOut ? 'تفعيل تايم أوت لعضو' : 'إزالة التايم أوت عن عضو', color: timedOut ? LOG_COLORS.danger : LOG_COLORS.success, guild: newMember.guild, actor, target: newMember, fields: [
            { name: 'العضو', value: logUser(newMember), inline: true },
            { name: 'الحالة', value: until, inline: true },
            { name: 'المنفذ', value: actor ? logUser(actor) : 'غير معروف', inline: true }
        ] });
        await sendLog(newMember.guild, 'moderation', embed);
    }
});
client.on('guildMemberAdd', async (member) => {
    try {
        const usedInvite = await attributeMemberInvite(member).catch(() => null);
        await recordMemberEvent(member.guild.id, 'joined').catch(error => console.error('[Member Stats Error]', error.message));

        // لوق الأعضاء
        const accountCreated = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F> (<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>)`;
        const logEmbed = buildLogEmbed({ title: 'دخول عضو جديد', color: LOG_COLORS.success, guild: member.guild, actor: member.user, target: member, thumbnail: member.user.displayAvatarURL(), fields: [
            { name: 'العضو', value: logUser(member), inline: true },
            { name: 'معرّف العضو', value: member.id, inline: true },
            { name: 'إنشاء الحساب', value: accountCreated, inline: true },
{ name: 'عدد أعضاء السيرفر', value: String(member.guild.memberCount), inline: true },
            ...(usedInvite ? [{ name: 'الدعوة المستخدمة', value: `\`${usedInvite.code}\` بواسطة <@${usedInvite.inviterId}>`, inline: true }] : [])
        ] });
        await sendLog(member.guild, 'members', logEmbed);

        // نظام الترحيب
        const config = await GuildConfig.findOne({ guildId: member.guild.id });
        if (!config?.welcome?.enabled || !config.welcome.channel) return;

        const welcomeChannel = await member.guild.channels.fetch(config.welcome.channel).catch(() => null);
        if (!welcomeChannel) return;

        const welcomeMsg = (config.welcome.embedMessage || 'مرحباً بك {member} في سيرفر {guild}!')
            .replace(/{member}/g, `<@${member.id}>`)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{count}/g, member.guild.memberCount.toString());

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('عضو جديد انضم إلينا')
            .setDescription(welcomeMsg)
            .setColor(0xd4af37)
            .setTimestamp()
            .setFooter({ text: `Drayz System  - العضو رقم ${member.guild.memberCount}`, iconURL: member.guild.iconURL() });

        try {
            const canvas = createCanvas(800, 400);
            const ctx = canvas.getContext('2d');

            const bgUrl = String(config.welcome.imagePath || '');
            let background;
            if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(bgUrl)) {
                const localPath = path.join(uploadDir, path.basename(bgUrl));
                background = await loadImage(localPath).catch(() => loadImage('https://placehold.co/800x400/050510/1e90ff?text=Welcome'));
            } else if (/^data:image\//i.test(bgUrl)) {
                background = await loadImage(bgUrl).catch(() => loadImage('https://placehold.co/800x400/050510/1e90ff?text=Welcome'));
            } else {
                background = await loadImage('https://placehold.co/800x400/050510/1e90ff?text=Welcome');
            }

            ctx.drawImage(background, 0, 0, 800, 400);

            const avW = parseFloat(config.welcome.avatarWidth) || 150;
            const avH = parseFloat(config.welcome.avatarHeight) || 150;
            const x = (parseFloat(config.welcome.avatarX) || 50) / 100 * 800;
            const y = (parseFloat(config.welcome.avatarY) || 50) / 100 * 400;

            ctx.save();
            ctx.beginPath();
            ctx.ellipse(x, y, avW / 2, avH / 2, 0, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 512 })).catch(() => null);
            if (avatar) ctx.drawImage(avatar, x - (avW / 2), y - (avH / 2), avW, avH);
            ctx.restore();

            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.ellipse(x, y, avW / 2, avH / 2, 0, 0, Math.PI * 2);
            ctx.stroke();

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
            welcomeEmbed.setImage('attachment://welcome-image.png');
            await welcomeChannel.send({ content: `<@${member.id}>`, allowedMentions: { users: [member.id] }, embeds: [welcomeEmbed], files: [attachment] });
        } catch (canvasErr) {
            console.error('[Canvas Welcome Error]', canvasErr);
            await welcomeChannel.send({ content: `<@${member.id}>`, allowedMentions: { users: [member.id] }, embeds: [welcomeEmbed] });
        }
    } catch (err) {
        console.error('[General Welcome Error]', err);
    }
});

client.on('guildMemberRemove', async (member) => {
    await markInviteMemberPresent(member.guild.id, member.id, false);
    const kick = await findRecentExecutor(member.guild, AuditLogEvent.MemberKick, member.id);
    const embed = buildLogEmbed({ title: kick ? 'طرد عضو' : 'خروج عضو', color: LOG_COLORS.danger, guild: member.guild, actor: kick, target: member, thumbnail: member.user?.displayAvatarURL?.(), fields: [
        { name: 'العضو', value: logUser(member), inline: true },
        { name: 'معرّف العضو', value: member.id, inline: true },
        { name: 'المنفذ', value: kick ? logUser(kick) : 'العضو غادر بنفسه أو غير معروف', inline: true },
        { name: 'القناة', value: 'لا ينطبق على هذا الحدث', inline: true }
    ] });
    await sendLog(member.guild, kick ? 'moderation' : 'members', embed);
    await recordMemberEvent(member.guild.id, 'left').catch(error => console.error('[Member Stats Error]', error.message));
});

client.on('guildBanAdd', async (ban) => {
    const executor = await findRecentExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    const embed = buildLogEmbed({ title: 'حظر عضو', color: LOG_COLORS.danger, guild: ban.guild, actor: executor, target: ban.user, fields: [
        { name: 'العضو', value: logUser(ban.user), inline: true },
        { name: 'معرّف العضو', value: ban.user.id, inline: true },
        { name: 'المنفذ', value: executor ? logUser(executor) : 'غير معروف', inline: true },
        { name: 'السبب', value: 'يتم جلب السبب من سجل التدقيق إذا كان متاحاً' }
    ] });
    await sendLog(ban.guild, 'moderation', embed);
    await Stats.findOneAndUpdate({ guildId: ban.guild.id }, { $inc: { 'modActions.bans': 1 } }, { upsert: true }).catch(() => {});
});

client.on('guildBanRemove', async (ban) => {
    const executor = await findRecentExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    const embed = buildLogEmbed({ title: 'إزالة حظر عن عضو', color: LOG_COLORS.success, guild: ban.guild, actor: executor, target: ban.user, fields: [
        { name: 'العضو', value: logUser(ban.user), inline: true },
        { name: 'معرّف العضو', value: ban.user.id, inline: true },
        { name: 'المنفذ', value: executor ? logUser(executor) : 'غير معروف', inline: true }
    ] });
    await sendLog(ban.guild, 'moderation', embed);
});

client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setTitle('قناة جديدة')
        .setColor(0xd4af37)
        .addFields({ name: 'القناة', value: `${channel.name} (<#${channel.id}>)` })
        .setTimestamp();
    await sendLog(channel.guild, 'channels', embed);
});

client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setTitle('قناة محذوفة')
        .setColor(0xe63946)
        .addFields({ name: 'القناة', value: channel.name })
        .setTimestamp();
    await sendLog(channel.guild, 'channels', embed);
});

client.on('roleCreate', async (role) => {
    const embed = new EmbedBuilder()
        .setTitle('رتبة جديدة')
        .setColor(0x00c853)
        .addFields({ name: 'الرتبة', value: role.name })
        .setTimestamp();
    await sendLog(role.guild, 'roles', embed);
});

client.on('roleDelete', async (role) => {
    const embed = new EmbedBuilder()
        .setTitle('رتبة محذوفة')
        .setColor(0xe63946)
        .addFields({ name: 'الرتبة', value: role.name })
        .setTimestamp();
    await sendLog(role.guild, 'roles', embed);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = oldState.guild || newState.guild;
    if (!guild) return;

    let embed;
    if (!oldState.channel && newState.channel) {
        embed = new EmbedBuilder()
            .setTitle('دخل روم صوتي')
            .setColor(0x00c853)
            .addFields(
                { name: 'العضو', value: `<@${newState.member.id}>`, inline: true },
                { name: 'الروم', value: newState.channel.name, inline: true }
            )
            .setTimestamp();
    } else if (oldState.channel && !newState.channel) {
        embed = new EmbedBuilder()
            .setTitle('غادر روم صوتي')
            .setColor(0xe63946)
            .addFields(
                { name: 'العضو', value: `<@${oldState.member.id}>`, inline: true },
                { name: 'الروم', value: oldState.channel.name, inline: true }
            )
            .setTimestamp();
    }
    if (embed) await sendLog(guild, 'voice', embed);
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.guild) return interaction.reply({ content: 'هذا الأمر أو التفاعل متاح داخل سيرفر Discord فقط.', ephemeral: true }).catch(() => {});
        if (interaction.isStringSelectMenu() && interaction.customId === 'notification_roles_menu') {
            const selectedRoleId = interaction.values[0];
            if (selectedRoleId === '__notification_roles_reset__') {
                return interaction.reply({ content: 'تم ترسيت المنيو', ephemeral: true });
            }
            const config = await GuildConfig.findOne({ guildId: interaction.guild.id }).lean();
            const roleConfig = config?.notificationRoles?.roles?.find(item => item.roleId === selectedRoleId);
            const role = interaction.guild.roles.cache.get(selectedRoleId);
            if (!role || !roleConfig) return interaction.reply({ content: 'هذه الرتبة لم تعد متاحة.', ephemeral: true });
            const botMember = interaction.guild.members.me;
            if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) || role.position >= botMember.roles.highest.position) {
                return interaction.reply({ content: 'لا يملك البوت صلاحية كافية لإعطاء هذه الرتبة.', ephemeral: true });
            }
            if (interaction.member.roles.cache.has(selectedRoleId)) {
                return interaction.reply({ content: `لديك رتبة **${roleConfig.label}** بالفعل.`, ephemeral: true });
            }
            await interaction.member.roles.add(selectedRoleId);
            return interaction.reply({ content: `تم منحك رتبة **${roleConfig.label}**.`, ephemeral: true });
        }


        // --- [ Giveaway Join Button ] ---
        if (interaction.isButton() && interaction.customId.startsWith('giveaway_join:')) {
            const giveawayId = interaction.customId.slice('giveaway_join:'.length);
            if (!/^[a-f\d]{24}$/i.test(giveawayId)) return interaction.reply({ content: 'معرّف القيف اواي غير صالح.', ephemeral: true });
            const now = new Date();
            const giveaway = await Giveaway.findOneAndUpdate(
                { _id: giveawayId, guildId: interaction.guild.id, ended: false, endAt: { $gt: now }, participants: { $ne: interaction.user.id } },
                { $addToSet: { participants: interaction.user.id } },
                { new: true }
            );
            if (!giveaway) {
                const current = await Giveaway.findOne({ _id: giveawayId, guildId: interaction.guild.id });
                if (!current || current.ended || new Date(current.endAt).getTime() <= now.getTime()) return interaction.reply({ content: 'انتهى القيف اواي أو لم يعد موجودًا.', ephemeral: true });
                if (current.participants.includes(interaction.user.id)) return interaction.reply({ content: 'أنت مسجل في القيف اواي مسبقًا.', ephemeral: true });
                return interaction.reply({ content: 'تعذر تسجيل دخولك الآن؛ حاول مرة أخرى.', ephemeral: true });
            }
            await refreshGiveawayMessage(giveaway, interaction.message);
            return interaction.reply({ content: 'تم تسجيل دخولك في القيف اواي بنجاح.', ephemeral: true });
        }

        if (interaction.isButton() && interaction.customId.startsWith('memberhistory:')) {
            const [, type, userId, rawPage] = interaction.customId.split(':');
            const allowed = ['deleted', 'edited', 'role_added', 'role_removed'];
            if (!allowed.includes(type)) return;
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'هذا الأمر مخصص للإدارة فقط.', ephemeral: true }).catch(() => {});
            }
            // تأكيد الزر فوراً قبل البحث في رسائل اللوق حتى لا تنتهي مهلة التفاعل.
            try {
                await interaction.deferUpdate();
            } catch (err) {
                if (err?.code === 10062) return;
                throw err;
            }
            const user = await client.users.fetch(userId).catch(() => null);
            if (!user) return interaction.editReply({ content: 'تعذر العثور على العضو.' }).catch(() => {});
            const result = await buildMemberHistoryEmbed(interaction.guild, user, type, rawPage);
            return interaction.editReply({ embeds: [result.embed], components: [historyButtons(user.id, type, result.page)] }).catch(err => {
                if (err?.code !== 10062) console.error('[Member History Button Error]', err);
            });
        }
        // --- [ Slash Commands ] ---
        if (interaction.isChatInputCommand()) {
            const commandPermissions = {
                setbanner: PermissionFlagsBits.Administrator, rename_panel: PermissionFlagsBits.Administrator,
                ban: PermissionFlagsBits.BanMembers, unban: PermissionFlagsBits.BanMembers, softban: PermissionFlagsBits.BanMembers,
                kick: PermissionFlagsBits.KickMembers, timeout: PermissionFlagsBits.ModerateMembers, untimeout: PermissionFlagsBits.ModerateMembers,
                warn: PermissionFlagsBits.ModerateMembers, warnings: PermissionFlagsBits.ModerateMembers, clearwarns: PermissionFlagsBits.ModerateMembers,
                clear: PermissionFlagsBits.ManageMessages, purge: PermissionFlagsBits.ManageMessages,
                lock: PermissionFlagsBits.ManageChannels, unlock: PermissionFlagsBits.ManageChannels, slowmode: PermissionFlagsBits.ManageChannels,
                nickname: PermissionFlagsBits.ManageNicknames, resetnick: PermissionFlagsBits.ManageNicknames,
                addrole: PermissionFlagsBits.ManageRoles, removerole: PermissionFlagsBits.ManageRoles, massrole: PermissionFlagsBits.Administrator,
                announce: PermissionFlagsBits.Administrator, say: PermissionFlagsBits.Administrator,
                createchannel: PermissionFlagsBits.ManageChannels, deletechannel: PermissionFlagsBits.ManageChannels,
                renamechannel: PermissionFlagsBits.ManageChannels, settopic: PermissionFlagsBits.ManageChannels,
                setnsfw: PermissionFlagsBits.ManageChannels, hidechannel: PermissionFlagsBits.ManageChannels, showchannel: PermissionFlagsBits.ManageChannels,
                voicelimit: PermissionFlagsBits.ManageChannels, move: PermissionFlagsBits.MoveMembers, disconnect: PermissionFlagsBits.MoveMembers,
                lockserver: PermissionFlagsBits.Administrator, unlockserver: PermissionFlagsBits.Administrator,
                resetlevels: PermissionFlagsBits.Administrator, restorelevels: PermissionFlagsBits.Administrator,
                memberhistory: PermissionFlagsBits.ManageGuild, invites: PermissionFlagsBits.ManageGuild,
                membercount: PermissionFlagsBits.ManageGuild, emojiinfo: PermissionFlagsBits.ManageEmojisAndStickers
            };
            const requiredPermission = commandPermissions[interaction.commandName];
            if (requiredPermission && !interaction.memberPermissions?.has(requiredPermission)) {
                return interaction.reply({ content: 'لا تملك الصلاحية المطلوبة لتنفيذ هذا الأمر.', ephemeral: true });
            }
            if (interaction.commandName === 'memberhistory') {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: 'هذا الأمر مخصص للإدارة فقط.', ephemeral: true });
                }
                const user = interaction.options.getUser('user', true);
                await interaction.deferReply({ ephemeral: true });
                const histories = await Promise.all(['deleted', 'edited', 'role_added', 'role_removed'].map(type => getCombinedMemberHistory(interaction.guild, user.id, type)));
                const counts = histories.map(items => items.length);
                const embed = new EmbedBuilder()
                    .setTitle(`سجل العضو: ${user.tag}`)
                    .setDescription(`العضو: <@${user.id}>\nاختر القسم الذي تريد عرضه من الأزرار بالأسفل.`)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setColor(0xd4af37)
                    .addFields(
                        { name: 'الرسائل المحذوفة', value: `\`${counts[0]}\``, inline: true },
                        { name: 'الرسائل المعدلة', value: `\`${counts[1]}\``, inline: true },
                        { name: 'الرتب التي تم تسليمها له', value: `\`${counts[2]}\``, inline: true },
                        { name: 'الرتب التي تم سحبها منه', value: `\`${counts[3]}\``, inline: true }
                    )
                    .setFooter({ text: 'السجل يبدأ من وقت تفعيل وحفظ النظام، ولا يمكن استرجاع أحداث لم يتم تسجيلها سابقاً.' })
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed], components: [historyButtons(user.id, null, 0)] });
            }
        
            if (interaction.commandName === 'resetlevels') {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: 'هذا الأمر مخصص للإدارة العليا فقط.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const existingLevels = await UserLevel.find({ guildId: interaction.guild.id }).lean();
                if (!existingLevels.length) {
                    return interaction.editReply({ content: 'لا توجد بيانات مستويات حتى يتم تصفيرها.' });
                }
                await LevelBackup.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    {
                        $set: {
                            resetBy: interaction.user.id,
                            resetAt: new Date(),
                            levels: existingLevels.map(row => ({
                                userId: row.userId,
                                xp: row.xp || 0,
                                level: row.level || 1,
                                msgCount: row.msgCount || 0
                            }))
                        }
                    },
                    { upsert: true, setDefaultsOnInsert: true }
                );
                await UserLevel.deleteMany({ guildId: interaction.guild.id });
                const embed = new EmbedBuilder()
                    .setTitle('تم تصفير المستويات')
                    .setDescription(`تم تصفير مستويات **${existingLevels.length}** عضو، وحُفظت نسخة احتياطية يمكن استرجاعها بواسطة \`/restorelevels\`.`)
                    .setColor(0xe67e22)
                    .setFooter({ text: `بواسطة ${interaction.user.tag}` })
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            if (interaction.commandName === 'restorelevels') {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: 'هذا الأمر مخصص للإدارة العليا فقط.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const backup = await LevelBackup.findOne({ guildId: interaction.guild.id }).lean();
                if (!backup?.levels?.length) {
                    return interaction.editReply({ content: 'لا توجد نسخة احتياطية محفوظة لهذا السيرفر.' });
                }
                await UserLevel.deleteMany({ guildId: interaction.guild.id });
                await UserLevel.insertMany(backup.levels.map(row => ({
                    guildId: interaction.guild.id,
                    userId: row.userId,
                    xp: row.xp || 0,
                    level: row.level || 1,
                    msgCount: row.msgCount || 0
                })), { ordered: false });
                const embed = new EmbedBuilder()
                    .setTitle('تم استرجاع المستويات')
                    .setDescription(`تم استرجاع مستويات **${backup.levels.length}** عضو كما كانت قبل آخر تصفير.`)
                    .setColor(0x2ecc71)
                    .addFields({ name: 'تاريخ النسخة', value: `<t:${Math.floor(new Date(backup.resetAt).getTime() / 1000)}:F>`, inline: true })
                    .setFooter({ text: 'هذه هي آخر نسخة احتياطية محفوظة.' })
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            if (interaction.commandName === 'invites') {
                const inviter = interaction.options.getUser('user', true);
                await interaction.deferReply();
                const records = await InviteRecord.find({ guildId: interaction.guild.id, inviterId: inviter.id })
                    .sort({ joinedAt: -1 }).lean();
                const memberIds = records.map(record => record.invitedUserId);
                const currentMembers = new Set();
                for (const id of memberIds) {
                    if (interaction.guild.members.cache.has(id)) currentMembers.add(id);
                    else if (await interaction.guild.members.fetch(id).catch(() => null)) currentMembers.add(id);
                }
                const joined = records.length;
                const stillHere = records.filter(record => currentMembers.has(record.invitedUserId)).length;
                const left = joined - stillHere;
                const details = records.length
                    ? records.slice(0, 20).map(record => {
                        const isHere = currentMembers.has(record.invitedUserId);
                        return `${isHere ? '✅' : '❌'} <@${record.invitedUserId}> — ${isHere ? 'موجود حالياً' : 'غادر السيرفر'}\nالدعوة: \`${record.inviteCode}\` | الدخول: <t:${Math.floor(new Date(record.joinedAt).getTime() / 1000)}:d>`;
                    }).join('\n\n')
                    : 'لا توجد دعوات مسجلة لهذا العضو منذ تشغيل نظام التتبع.';
                const embed = new EmbedBuilder()
                    .setTitle(`إحصائيات دعوات ${inviter.tag}`)
                    .setDescription(`العضو: <@${inviter.id}>\n\n**تفاصيل آخر ${Math.min(records.length, 20)} دعوة:**\n${details}`)
                    .setThumbnail(inviter.displayAvatarURL({ dynamic: true }))
                    .setColor(0xd4af37)
                    .addFields(
                        { name: 'إجمالي من دخلوا بدعواته', value: `\`${joined}\``, inline: true },
                        { name: 'ما زالوا في السيرفر', value: `\`${stillHere}\``, inline: true },
                        { name: 'غادروا السيرفر', value: `\`${left}\``, inline: true }
                    )
                    .setFooter({ text: 'يتم تسجيل الدعوات الجديدة تلقائياً عبر قاعدة البيانات.' })
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            if (interaction.commandName === 'setbanner') {
                const image = interaction.options.getAttachment('image');
                await GuildConfig.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { $set: { 'welcome.bannerURL': image.url } },
                    { upsert: true }
                );
                return interaction.reply({ content: 'تم حفظ البنر بنجاح!', ephemeral: true });
            }

            if (interaction.commandName === 'rename_panel') {
                const name = interaction.options.getString('name');
                const image = interaction.options.getAttachment('image');

                const embed = new EmbedBuilder()
                    .setTitle('لوحة تغيير الاسم')
                    .setDescription(`اضغط على الزر لتغيير اسمك إلى: **${name}**`)
                    .setColor(0xd4af37);
                if (image) embed.setImage(image.url);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rename_user:${name}`).setLabel(`تغيير الاسم إلى ${name}`).setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('reset_name').setLabel('إرجاع الاسم الأصلي').setStyle(ButtonStyle.Secondary)
                );
                await interaction.channel.send({ embeds: [embed], components: [row] });
                return interaction.reply({ content: 'تم إرسال اللوحة!', ephemeral: true });
            }

            // ===== أوامر الإشراف =====
            if (interaction.commandName === 'ban') {
                const target = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'بدون سبب';
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (member) { const guard = moderationTargetError(interaction, member); if (guard) return interaction.reply({ content: guard, ephemeral: true }); if (!member.bannable) return interaction.reply({ content: 'لا يمكنني حظر هذا العضو (تحقق من رتبة البوت وصلاحياته).', ephemeral: true }); }
                try { await interaction.guild.members.ban(target.id, { reason }); } catch { return interaction.reply({ content: 'تعذر حظر العضو؛ تحقق من الصلاحيات وترتيب الرتب.', ephemeral: true }); }
                const embed = new EmbedBuilder().setTitle('تم الحظر').setColor(0xe63946)
                    .addFields({ name: 'العضو', value: `${target.tag}`, inline: true }, { name: 'بواسطة', value: `${interaction.user}`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'unban') {
                const id = interaction.options.getString('id');
                const reason = interaction.options.getString('reason') || 'بدون سبب';
                if (!/^\d{17,20}$/.test(id)) return interaction.reply({ content: 'معرّف Discord غير صالح.', ephemeral: true });
                try { await interaction.guild.members.unban(id, reason); }
                catch { return interaction.reply({ content: 'تعذر فك الحظر؛ تأكد أن العضو محظور وأن للبوت صلاحية Ban Members.', ephemeral: true }); }
                const embed = new EmbedBuilder().setTitle('تم فك الحظر').setColor(0x00c853)
                    .addFields({ name: 'العضو', value: `<@${id}>`, inline: true }, { name: 'بواسطة', value: `${interaction.user}`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'kick') {
                const target = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'بدون سبب';
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                { const guard = moderationTargetError(interaction, member); if (guard) return interaction.reply({ content: guard, ephemeral: true }); }
                if (!member.kickable) return interaction.reply({ content: 'لا يمكنني طرد هذا العضو (رتبته أعلى مني).', ephemeral: true });
                try { await member.kick(reason); } catch { return interaction.reply({ content: 'تعذر طرد العضو؛ تحقق من صلاحيات البوت وترتيب الرتب.', ephemeral: true }); }
                const embed = new EmbedBuilder().setTitle('تم الطرد').setColor(0xe63946)
                    .addFields({ name: 'العضو', value: `${target.tag}`, inline: true }, { name: 'بواسطة', value: `${interaction.user}`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'timeout') {
                const target = interaction.options.getUser('user');
                const minutes = interaction.options.getInteger('minutes');
                const reason = interaction.options.getString('reason') || 'بدون سبب';
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                { const guard = moderationTargetError(interaction, member); if (guard) return interaction.reply({ content: guard, ephemeral: true }); }
                if (!member.moderatable) return interaction.reply({ content: 'لا يمكنني كتم هذا العضو (رتبته أعلى مني).', ephemeral: true });
                if (!Number.isInteger(minutes) || minutes < 1 || minutes > 40320) return interaction.reply({ content: 'المدة يجب أن تكون بين دقيقة و28 يومًا.', ephemeral: true });
                try { await member.timeout(minutes * 60 * 1000, reason); } catch { return interaction.reply({ content: 'تعذر تطبيق التايم أوت؛ تحقق من صلاحيات البوت وترتيب الرتب.', ephemeral: true }); }
                const embed = new EmbedBuilder().setTitle('تم الكتم (Timeout)').setColor(0xffac33)
                    .addFields({ name: 'العضو', value: `${target}`, inline: true }, { name: 'المدة', value: `${minutes} دقيقة`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'untimeout') {
                const target = interaction.options.getUser('user');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                { const guard = moderationTargetError(interaction, member); if (guard) return interaction.reply({ content: guard, ephemeral: true }); }
                try { await member.timeout(null); } catch { return interaction.reply({ content: 'تعذر فك التايم أوت؛ تحقق من صلاحيات البوت وترتيب الرتب.', ephemeral: true }); }
                return interaction.reply({ content: `تم فك الكتم عن ${target}.` });
            }

            if (interaction.commandName === 'warn') {
                const target = interaction.options.getUser('user');
                const reason = String(interaction.options.getString('reason') || 'بدون سبب').slice(0, 1000);
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود في السيرفر.', ephemeral: true });
                const guard = moderationTargetError(interaction, member);
                if (guard) return interaction.reply({ content: guard, ephemeral: true });
                await Warn.create({ guildId: interaction.guild.id, userId: target.id, reason, moderatorId: interaction.user.id });
                const embed = new EmbedBuilder().setTitle('تم توجيه تحذير').setColor(0xffac33)
                    .addFields({ name: 'العضو', value: `${target}`, inline: true }, { name: 'بواسطة', value: `${interaction.user}`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
                target.send(`تم توجيه تحذير لك في سيرفر **${interaction.guild.name}**\nالسبب: ${reason}`).catch(() => {});
                return;
            }

            if (interaction.commandName === 'warnings') {
                const target = interaction.options.getUser('user');
                const warns = await Warn.find({ guildId: interaction.guild.id, userId: target.id }).sort({ createdAt: -1 }).limit(15);
                if (warns.length === 0) return interaction.reply({ content: `${target} لا يملك أي تحذيرات.`, ephemeral: true });
                const embed = new EmbedBuilder().setTitle(`تحذيرات ${target.username}`).setColor(0xffac33)
                    .setDescription(warns.map((w, i) => `**${i + 1}.** ${w.reason} — بواسطة <@${w.moderatorId}> <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`).join('\n'))
                    .setTimestamp();
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.commandName === 'clearwarns') {
                const target = interaction.options.getUser('user');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود في السيرفر.', ephemeral: true });
                const guard = moderationTargetError(interaction, member);
                if (guard) return interaction.reply({ content: guard, ephemeral: true });
                const result = await Warn.deleteMany({ guildId: interaction.guild.id, userId: target.id });
                return interaction.reply({ content: `تم مسح **${result.deletedCount || 0}** تحذيرًا عن ${target}.` });
            }

            if (interaction.commandName === 'purge') {
                const amount = interaction.options.getInteger('amount');
                if (amount < 1 || amount > 100) return interaction.reply({ content: 'العدد يجب أن يكون بين 1 و 100.', ephemeral: true });
                const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
                return interaction.reply({ content: `تم حذف ${deleted?.size || 0} رسالة.`, ephemeral: true });
            }

            if (interaction.commandName === 'lock' || interaction.commandName === 'unlock') {
                const channel = interaction.channel;
                if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return interaction.reply({ content: 'هذا الإجراء يعمل في قنوات النص/الإعلانات فقط.', ephemeral: true });
                try {
                    const state = await setManagedChannelLock(interaction.guild, channel, interaction.commandName === 'lock', interaction.user.id);
                    if (state === 'not-managed-locked') return interaction.reply({ content: 'لا يوجد قفل أنشأه Drayz لهذه القناة؛ لم أغير صلاحياتها الأصلية.', ephemeral: true });
                    return interaction.reply({ content: interaction.commandName === 'lock' ? 'تم قفل القناة وحفظ صلاحياتها السابقة.' : 'تم فتح القناة واستعادة صلاحياتها السابقة.' });
                } catch (error) { console.error('[Channel Lock Error]', error.message); return interaction.reply({ content: 'تعذر تحديث صلاحيات القناة؛ تحقق من رتبة البوت.', ephemeral: true }); }
            }

            if (interaction.commandName === 'slowmode') {
                const seconds = interaction.options.getInteger('seconds');
                await interaction.channel.setRateLimitPerUser(seconds).catch(() => {});
                return interaction.reply({ content: seconds > 0 ? `تم ضبط وضع البطء على ${seconds} ثانية.` : 'تم إيقاف وضع البطء.' });
            }

            if (interaction.commandName === 'nickname') {
                const target = interaction.options.getUser('user');
                const newName = interaction.options.getString('name');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                const guard = moderationTargetError(interaction, member);
                if (guard) return interaction.reply({ content: guard, ephemeral: true });
                if (!member.manageable) return interaction.reply({ content: 'رتبة البوت لا تسمح بتغيير اسم هذا العضو.', ephemeral: true });
                if (newName && newName.length > 32) return interaction.reply({ content: 'الاسم الجديد يجب ألا يتجاوز 32 حرفًا.', ephemeral: true });
                try { await member.setNickname(newName || null); } catch { return interaction.reply({ content: 'تعذر تغيير الاسم؛ تحقق من الصلاحيات وترتيب الرتب.', ephemeral: true }); }
                return interaction.reply({ content: newName ? `تم تغيير اسم ${target} إلى **${newName}**.` : `تم إرجاع اسم ${target} الأصلي.` });
            }

            if (interaction.commandName === 'addrole') {
                const target = interaction.options.getUser('user');
                const role = interaction.options.getRole('role');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                { const guard = moderationTargetError(interaction, member); if (guard) return interaction.reply({ content: guard, ephemeral: true }); }
                if (role.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) return interaction.reply({ content: 'لا يمكنك تعديل رتبة تساوي رتبتك أو أعلى منها.', ephemeral: true });
                if (role.managed || role.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: 'رتبة البوت يجب أن تكون أعلى من الرتبة المستهدفة.', ephemeral: true });
                try { await member.roles.add(role); } catch { return interaction.reply({ content: 'تعذر إعطاء الرتبة؛ تحقق من صلاحيات البوت.', ephemeral: true }); }
                return interaction.reply({ content: `تم إعطاء رتبة **${role.name}** لـ ${target}.` });
            }

            if (interaction.commandName === 'removerole') {
                const target = interaction.options.getUser('user');
                const role = interaction.options.getRole('role');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                { const guard = moderationTargetError(interaction, member); if (guard) return interaction.reply({ content: guard, ephemeral: true }); }
                if (role.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) return interaction.reply({ content: 'لا يمكنك تعديل رتبة تساوي رتبتك أو أعلى منها.', ephemeral: true });
                if (role.managed || role.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: 'رتبة البوت يجب أن تكون أعلى من الرتبة المستهدفة.', ephemeral: true });
                try { await member.roles.remove(role); } catch { return interaction.reply({ content: 'تعذر سحب الرتبة؛ تحقق من صلاحيات البوت.', ephemeral: true }); }
                return interaction.reply({ content: `تم سحب رتبة **${role.name}** من ${target}.` });
            }

            if (interaction.commandName === 'announce') {
                const title = interaction.options.getString('title');
                const text = interaction.options.getString('text');
                const channel = interaction.options.getChannel('channel');
                const role = interaction.options.getRole('mention_role');
                const image = interaction.options.getAttachment('image');

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(text)
                    .setColor(0xd4af37)
                    .setFooter({ text: `Drayz System  - إعلان رسمي بواسطة ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();
                if (image) embed.setImage(image.url);

                if (!channel?.isTextBased?.()) return interaction.reply({ content: 'اختر قناة نصية صالحة للإعلان.', ephemeral: true });
                try { await channel.send({ content: role ? `${role}` : undefined, embeds: [embed], allowedMentions: { parse: [], roles: role ? [role.id] : [] } }); }
                catch { return interaction.reply({ content: 'تعذر إرسال الإعلان؛ تحقق من صلاحيات البوت ونوع القناة.', ephemeral: true }); }
                return interaction.reply({ content: `تم نشر الإعلان في ${channel}.`, ephemeral: true });
            }

            if (interaction.commandName === 'say') {
                const text = interaction.options.getString('text');
                const channel = interaction.options.getChannel('channel') || interaction.channel;
                try { await channel.send({ content: text, allowedMentions: { parse: [] } }); } catch { return interaction.reply({ content: 'تعذر إرسال الرسالة في القناة المحددة.', ephemeral: true }); }
                return interaction.reply({ content: `تم إرسال الرسالة في ${channel}.`, ephemeral: true });
            }

            if (interaction.commandName === 'userinfo') {
                const target = interaction.options.getUser('user') || interaction.user;
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                const embed = new EmbedBuilder()
                    .setTitle(`معلومات ${target.username}`)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setColor(0xd4af37)
                    .addFields(
                        { name: 'الاسم الكامل', value: target.tag, inline: true },
                        { name: 'ID', value: target.id, inline: true },
                        { name: 'تاريخ إنشاء الحساب', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
                    );
                if (member) {
                    embed.addFields(
                        { name: 'تاريخ الانضمام', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true },
                        { name: 'عدد الرتب', value: `${member.roles.cache.size - 1}`, inline: true }
                    );
                }
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'serverinfo') {
                const g = interaction.guild;
                const embed = new EmbedBuilder()
                    .setTitle(g.name)
                    .setThumbnail(g.iconURL({ dynamic: true }))
                    .setColor(0xd4af37)
                    .addFields(
                        { name: 'المالك', value: `<@${g.ownerId}>`, inline: true },
                        { name: 'عدد الأعضاء', value: `${g.memberCount}`, inline: true },
                        { name: 'عدد الرومات', value: `${g.channels.cache.size}`, inline: true },
                        { name: 'عدد الرتب', value: `${g.roles.cache.size}`, inline: true },
                        { name: 'تاريخ الإنشاء', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
                    )
                    .setFooter({ text: 'Drayz System ' })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'avatar') {
                const target = interaction.options.getUser('user') || interaction.user;
                const embed = new EmbedBuilder()
                    .setTitle(`صورة ${target.username}`)
                    .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
                    .setColor(0xd4af37);
                return interaction.reply({ embeds: [embed] });
            }
        }

        // ===== 20 أوامر إدارية إضافية =====
        const command = interaction.commandName;
        const reply = (content, ephemeral = false) => interaction.reply({ content, ephemeral });
        if (command === 'clear') {
            const amount = interaction.options.getInteger('amount');
            if (amount < 1 || amount > 100) return reply('العدد يجب أن يكون بين 1 و100.', true);
            const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
            return reply(`تم حذف ${deleted?.size || 0} رسالة.`, true);
        }
        if (command === 'softban') {
            const user = interaction.options.getUser('user'); const reason = interaction.options.getString('reason') || 'بدون سبب';
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member) return reply('العضو غير موجود بالسيرفر؛ لا يمكن تنفيذ Softban.', true);
            const guard = moderationTargetError(interaction, member);
            if (guard) return reply(guard, true);
            if (!member.bannable) return reply('لا يمكنني تنفيذ الحظر على هذا العضو.', true);
            try { await member.ban({ deleteMessageSeconds: 86400, reason }); }
            catch { return reply('فشل الحظر؛ لم يكتمل Softban.', true); }
            try { await interaction.guild.members.unban(user.id, 'Softban مكتمل'); }
            catch { return reply('تم الحظر وحذف الرسائل، لكن تعذر فك الحظر تلقائيًا؛ ما زال العضو محظورًا.', true); }
            return reply(`تم تنفيذ Softban على ${user.tag}.`);
        }
        if (command === 'roleinfo') {
            const role = interaction.options.getRole('role');
            return reply(`**${role.name}**\nID: ${role.id}\nالموضع: ${role.position}\nالأعضاء: ${role.members.size}`);
        }
        if (command === 'channelinfo') {
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            return reply(`**${channel.name}**\nID: ${channel.id}\nالنوع: ${channel.type}\nالفئة: ${channel.parent?.name || 'بدون فئة'}`);
        }
        if (command === 'membercount') {
            const g = interaction.guild; await g.members.fetch().catch(() => {});
            const bots = g.members.cache.filter(m => m.user.bot).size;
            return reply(`الأعضاء: **${g.memberCount}**\nالبوتات: **${bots}**\nالبشر: **${g.memberCount - bots}**`);
        }
        if (command === 'settopic') {
            const text = interaction.options.getString('text') || null;
            if (!interaction.channel.setTopic) return reply('هذه القناة لا تدعم الموضوع.', true);
            await interaction.channel.setTopic(text); return reply(text ? 'تم تحديث موضوع القناة.' : 'تم حذف موضوع القناة.');
        }
        if (command === 'renamechannel') {
            const channel = interaction.options.getChannel('channel'); const name = interaction.options.getString('name');
            await channel.setName(name); return reply(`تم تغيير اسم القناة إلى **${name}**.`);
        }
        if (command === 'createchannel') {
            const name = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9\-_]/g, '-').slice(0, 90) || 'new-channel';
            const channel = await interaction.guild.channels.create({ name, type: ChannelType.GuildText });
            return reply(`تم إنشاء القناة ${channel}.`);
        }
        if (command === 'deletechannel') {
            const channel = interaction.options.getChannel('channel'); const name = channel.name;
            await channel.delete('حذف بأمر إداري'); return reply(`تم حذف القناة **${name}**.`);
        }
        if (command === 'setnsfw') {
            const enabled = interaction.options.getBoolean('enabled'); const channel = interaction.channel;
            if (!channel.setNSFW) return reply('هذه القناة لا تدعم NSFW.', true);
            await channel.setNSFW(enabled); return reply(enabled ? 'تم تفعيل NSFW.' : 'تم تعطيل NSFW.');
        }
        if (command === 'lockserver' || command === 'unlockserver') {
            const locking = command === 'lockserver'; let count = 0, failed = 0;
            for (const channel of interaction.guild.channels.cache.values()) {
                if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) continue;
                try {
                    const state = await setManagedChannelLock(interaction.guild, channel, locking, interaction.user.id);
                    if (state === 'not-managed-locked') failed++; else count++;
                } catch { failed++; }
            }
            return reply(`${locking ? 'تم قفل' : 'تم فتح واستعادة صلاحيات'} **${count}** قناة${failed ? `، وتعذر تطبيق الإجراء على ${failed}` : ''}.`, failed > 0);
        }
        if (command === 'hidechannel' || command === 'showchannel') {
            const channel = interaction.options.getChannel('channel') || interaction.channel; const value = command === 'showchannel';
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: value }); return reply(value ? 'تم إظهار القناة.' : 'تم إخفاء القناة.');
        }
        if (command === 'voicelimit') {
            const channel = interaction.options.getChannel('channel'); const limit = interaction.options.getInteger('limit');
            if (![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type) || limit < 0 || limit > 99) return reply('اختر قناة صوتية وحدد حدًا بين 0 و99.', true);
            await channel.setUserLimit(limit); return reply(`تم ضبط الحد إلى **${limit}**.`);
        }
        if (command === 'move') {
            const user = interaction.options.getUser('user'); const channel = interaction.options.getChannel('channel'); const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member?.voice?.channel) return reply('العضو ليس في قناة صوتية.', true); if (![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)) return reply('القناة ليست صوتية.', true);
            await member.voice.setChannel(channel); return reply(`تم نقل ${user} إلى ${channel}.`);
        }
        if (command === 'disconnect') {
            const user = interaction.options.getUser('user'); const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member?.voice?.channel) return reply('العضو ليس في قناة صوتية.', true); await member.voice.disconnect(); return reply(`تم فصل ${user} من الصوت.`);
        }
        if (command === 'massrole') {
            const role = interaction.options.getRole('role'); if (role.position >= interaction.guild.members.me.roles.highest.position) return reply('رتبة البوت أقل من الرتبة المطلوبة.', true);
            if (interaction.user.id !== interaction.guild.ownerId && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && role.position >= interaction.member.roles.highest.position) return reply('لا يمكنك توزيع رتبة تساوي رتبتك أو أعلى منها.', true);
            if (role.managed) return reply('لا يمكن توزيع رتبة يديرها تكامل أو بوت آخر.', true);
            await interaction.deferReply({ ephemeral: true }); await interaction.guild.members.fetch(); let count = 0;
            for (const member of interaction.guild.members.cache.values()) if (!member.user.bot && !member.roles.cache.has(role.id)) { await member.roles.add(role).then(() => count++).catch(() => {}); }
            return interaction.editReply(`تم إعطاء الرتبة لـ **${count}** عضو.`);
        }
        if (command === 'resetnick') {
            const user = interaction.options.getUser('user'); const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member?.manageable) return reply('لا يمكنني تعديل اسم هذا العضو.', true); await member.setNickname(null); return reply(`تم إرجاع اسم ${user}.`);
        }
        if (command === 'emojiinfo') {
            const id = interaction.options.getString('emoji').match(/\d{15,}/)?.[0]; const emoji = id && interaction.guild.emojis.cache.get(id);
            if (!emoji) return reply('الإيموجي غير موجود في السيرفر.', true); return reply(`**${emoji.name}**\nID: ${emoji.id}\nمتحرك: ${emoji.animated ? 'نعم' : 'لا'}\nالاستخدام: ${emoji}`);
        }

        // --- [ Rename Buttons ] ---
        if (interaction.isButton() && interaction.customId.startsWith('rename_user:')) {
            const newName = interaction.customId.split(':')[1];
            const setResult = await interaction.member.setNickname(newName).catch(() => null);
            if (!setResult) return interaction.reply({ content: 'ما بقدر أغير الاسم (تأكد من صلاحياتي)', ephemeral: true });
            return interaction.reply({ content: `تم تغيير اسمك إلى: ${newName}`, ephemeral: true });
        }

        if (interaction.isButton() && interaction.customId === 'reset_name') {
            const setResult = await interaction.member.setNickname(null).catch(() => null);
            if (!setResult) return interaction.reply({ content: 'ما بقدر أرجع الاسم', ephemeral: true });
            return interaction.reply({ content: 'تم ارجاع اسمك الأصلي', ephemeral: true });
        }

        // --- [ Ticket Rating Buttons ] ---
        if (interaction.isButton() && interaction.customId.startsWith('ticket_rate:')) {
            const [, ticketId, scoreText] = interaction.customId.split(':');
            const score = Number(scoreText);
            if (!Number.isInteger(score) || score < 1 || score > 5) return interaction.reply({ content: 'هذا التقييم غير صالح.', ephemeral: true });
            const ticketData = await TicketData.findOne({ _id: ticketId, guildId: interaction.guild.id });
            if (!ticketData) return interaction.reply({ content: 'لم يتم العثور على سجل التذكرة.', ephemeral: true });
            if (ticketData.ownerId !== interaction.user.id) return interaction.reply({ content: 'التقييم متاح لصاحب التذكرة فقط.', ephemeral: true });
            if (!ticketData.closedAt) return interaction.reply({ content: 'يمكنك التقييم بعد إغلاق التذكرة.', ephemeral: true });
            try {
                await TicketRating.create({ guildId: interaction.guild.id, ticketId: ticketData._id, channelId: ticketData.channelId, ownerId: interaction.user.id, rating: score });
            } catch (error) {
                if (error?.code === 11000) return interaction.reply({ content: 'تم إرسال تقييم لهذه التذكرة مسبقًا، شكرًا لك.', ephemeral: true });
                throw error;
            }
            const icons = '★'.repeat(score) + '☆'.repeat(5-score);
            await interaction.update({ content: `تم تسجيل تقييمك بنجاح\n${icons}  **${score}/5** — شكرًا لك. أُغلقت التذكرة وأُخفيت من قائمة تذاكرك.`, components: [] }).catch(async () => interaction.reply({ content: `تم حفظ تقييمك: ${icons} (${score}/5).`, ephemeral: true }));
            try {
                await interaction.channel.permissionOverwrites.edit(ticketData.ownerId, { ViewChannel: false, SendMessages: false });
                ticketData.archivedAt = new Date();
                await ticketData.save();
            } catch (archiveError) {
                console.error('[Ticket Archive Error]', archiveError.message);
                await interaction.followUp({ content: 'تم حفظ تقييمك، لكن تعذر إخفاء القناة تلقائيًا؛ أبلغ الإدارة للتحقق من صلاحيات البوت.', ephemeral: true }).catch(() => {});
            }
            return;
        }

        // --- [ Ticket Control Menu ] ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_control_menu') {
            const selected = interaction.values[0];
            const ticketData = await TicketData.findOne({ channelId: interaction.channelId });
            if (!ticketData) return interaction.reply({ content: 'لم يتم العثور على بيانات التكت.', ephemeral: true });

            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            const adminRole = ticketData.adminRole;
            const isAdmin = Boolean((adminRole && interaction.member.roles.cache.has(adminRole)) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
            const isOwner = ticketData.ownerId === interaction.user.id;

            if (selected === 'claim_ticket') {
                if (!isAdmin) return interaction.reply({ content: 'فقط الإدارة يمكنهم استلام التكت.', ephemeral: true });
                ticketData.claimedBy = interaction.user.id;
                await ticketData.save();
                return interaction.reply({ content: `تم استلام التكت بواسطة ${interaction.user}.`, ephemeral: false });
            }

            if (selected === 'close_ticket') {
                if (!isAdmin && !isOwner) return interaction.reply({ content: 'ليس لديك صلاحية لإغلاق التكت.', ephemeral: true });
                if (ticketData.closedAt) return interaction.reply({ content: 'هذا التكت مغلق مسبقاً.', ephemeral: true });
                const priorOwnerOverwrite = interaction.channel.permissionOverwrites.cache.get(ticketData.ownerId);
                const priorSendMessages = priorOwnerOverwrite?.deny?.has(PermissionFlagsBits.SendMessages) ? false : priorOwnerOverwrite?.allow?.has(PermissionFlagsBits.SendMessages) ? true : null;
                try { await interaction.channel.permissionOverwrites.edit(ticketData.ownerId, { SendMessages: false }); }
                catch (error) { console.error('[Ticket Close Permission Error]', error.message); return interaction.reply({ content: 'تعذر قفل الكتابة في التكت؛ لم يتم اعتماد الإغلاق.', ephemeral: true }); }
                ticketData.closedAt = new Date();
                ticketData.closedBy = interaction.user.id;
                try { await ticketData.save(); }
                catch (error) {
                    await interaction.channel.permissionOverwrites.edit(ticketData.ownerId, { SendMessages: priorSendMessages }).catch(() => {});
                    throw error;
                }
                const ratingRow = new ActionRowBuilder().addComponents([1,2,3,4,5].map(score =>
                    new ButtonBuilder().setCustomId(`ticket_rate:${ticketData._id}:${score}`).setLabel(`${score}  ★`).setStyle(score >= 4 ? ButtonStyle.Success : ButtonStyle.Secondary)
                ));
                try {
                    await interaction.channel.send({ content: `تم إغلاق التذكرة بواسطة ${interaction.user}.\n**كيف كانت تجربتك؟** اختر تقييمك من 1 إلى 5.`, components: [ratingRow], allowedMentions: { users: [interaction.user.id] } });
                } catch (error) {
                    console.error('[Ticket Rating Prompt Error]', error.message);
                    ticketData.closedAt = null;
                    ticketData.closedBy = null;
                    await ticketData.save().catch(rollbackError => console.error('[Ticket Close Rollback Error]', rollbackError.message));
                    await interaction.channel.permissionOverwrites.edit(ticketData.ownerId, { SendMessages: priorSendMessages }).catch(() => {});
                    return interaction.reply({ content: 'تعذر إرسال أزرار التقييم؛ أُعيد فتح التكت. تحقق من صلاحية إرسال الرسائل في القناة.', ephemeral: true });
                }
                ticketData.activeTicketKey = null;
                try { await ticketData.save(); }
                catch (releaseError) {
                    console.error('[Ticket Lock Release Error]', releaseError.message);
                    await TicketData.updateOne({ _id: ticketData._id }, { $unset: { activeTicketKey: 1 } }).catch(() => {});
                }
                await interaction.message.edit({ components: [] }).catch(() => {});
                await interaction.reply({ content: 'تم إغلاق التكت وظهرت أزرار التقييم لصاحبه. بعد التقييم ستُخفى القناة عنه وتبقى محفوظة للإدارة.', ephemeral: true });
                return;
            }

            if (selected === 'add_member') {
                if (!isAdmin) return interaction.reply({ content: 'فقط الإدارة يمكنهم إضافة أعضاء.', ephemeral: true });
                const modal = new ModalBuilder().setCustomId('ticket_add_member').setTitle('إضافة عضو للتكت');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('member_id').setLabel('ID العضو').setStyle(TextInputStyle.Short).setRequired(true)
                ));
                return interaction.showModal(modal);
            }

            if (selected === 'remove_member') {
                if (!isAdmin) return interaction.reply({ content: 'فقط الإدارة يمكنهم إزالة أعضاء.', ephemeral: true });
                const modal = new ModalBuilder().setCustomId('ticket_remove_member').setTitle('إزالة عضو من التكت');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('member_id').setLabel('ID العضو').setStyle(TextInputStyle.Short).setRequired(true)
                ));
                return interaction.showModal(modal);
            }

            if (selected === 'summon_member') {
                if (!isAdmin) return interaction.reply({ content: 'فقط الإدارة يمكنهم استدعاء الأعضاء.', ephemeral: true });
                await interaction.reply({ content: `<@${ticketData.ownerId}> تم استدعاؤك!`, ephemeral: false });
                return;
            }
        }

        // --- [ Ticket Modals ] ---
        if (interaction.isModalSubmit() && (interaction.customId === 'ticket_add_member' || interaction.customId === 'ticket_remove_member')) {
            const memberId = interaction.fields.getTextInputValue('member_id').trim();
            const member = await interaction.guild.members.fetch(memberId).catch(() => null);
            if (!member) return interaction.reply({ content: 'العضو غير موجود.', ephemeral: true });

            if (interaction.customId === 'ticket_add_member') {
                await interaction.channel.permissionOverwrites.create(memberId, { ViewChannel: true, SendMessages: true }).catch(() => {});
                return interaction.reply({ content: `تم إضافة ${member.user.tag} للتكت.`, ephemeral: true });
            } else {
                await interaction.channel.permissionOverwrites.delete(memberId).catch(() => {});
                return interaction.reply({ content: `تم إزالة ${member.user.tag} من التكت.`, ephemeral: true });
            }
        }
// --- [ Ticket Panel Select Menu ] ---
if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
    const selected = interaction.values[0];
    const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
    if (!tConfig) return interaction.reply({ content: 'لم يتم العثور على إعدادات التذاكر.', ephemeral: true });

    // استخراج رقم الخيار من الـ value (مثلاً ticket_opt_0 → 0)
    const optIndex = /^ticket_opt_\d+$/.test(selected) ? Number(selected.slice('ticket_opt_'.length)) : -1;
    const sectionConfig = tConfig.menuOptions?.[optIndex];
    if (!sectionConfig) return interaction.reply({ content: 'خيار التذكرة لم يعد متاحًا؛ حدّث اللوحة وحاول مجددًا.', ephemeral: true });
    let ticketType = 'تذكرة دعم';
    if (sectionConfig.label) ticketType = sectionConfig.label;

    await openTicket(interaction, tConfig, ticketType, sectionConfig);
    return;
}

        // --- [ Ticket Buttons ] ---
        if (interaction.isButton() && (interaction.customId === 'open_ticket' || interaction.customId.startsWith('ticket_btn_'))) {
            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            if (!tConfig) return interaction.reply({ content: 'لم يتم العثور على إعدادات التذاكر.', ephemeral: true });

            let ticketType = 'تذكرة دعم';
            let sectionConfig = {};
            if (interaction.customId.startsWith('ticket_btn_')) {
                const btnIndex = parseInt(interaction.customId.replace('ticket_btn_', ''));
                sectionConfig = tConfig.buttons?.[btnIndex] || {};
                if (sectionConfig.label) ticketType = sectionConfig.label;
            }
            await openTicket(interaction, tConfig, ticketType, sectionConfig);
        }
        // --- [ Suggestion Menu ] ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'suggestion_menu') {
            const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return interaction.reply({ content: 'هذا الإجراء مخصص للإدارة فقط.', ephemeral: true });

            const suggestion = await Suggestion.findOne({ guildId: interaction.guild.id, messageId: interaction.message.id });
            if (!suggestion) return interaction.reply({ content: 'لم يتم العثور على بيانات الاقتراح.', ephemeral: true });

            const selected = interaction.values[0];

            if (selected === 'reply') {
                const modal = new ModalBuilder()
                    .setCustomId(`suggestion_reply_modal:${interaction.message.id}`)
                    .setTitle('الرد على الاقتراح');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('reply_text').setLabel('نص رد الإدارة').setStyle(TextInputStyle.Paragraph).setRequired(true)
                ));
                return interaction.showModal(modal);
            }

            if (selected === 'accept') {
                suggestion.status = 'accepted';
                await suggestion.save();
                await interaction.message.reactions.removeAll().catch(() => {});
                const embed = EmbedBuilder.from(interaction.message.embeds[0]).setDescription(
                    `${interaction.message.embeds[0].description || ''}\n\n**✅ تمت الموافقة على الاقتراح.**`
                );
                await interaction.update({ embeds: [embed], components: [] });
                return;
            }

            if (selected === 'delete') {
                await Suggestion.deleteOne({ _id: suggestion._id });
                await interaction.message.delete().catch(() => {});
                return interaction.reply({ content: 'تم حذف الاقتراح.', ephemeral: true });
            }
        }

        // --- [ Suggestion Reply Modal ] ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('suggestion_reply_modal:')) {
            const messageId = interaction.customId.split(':')[1];
            const suggestion = await Suggestion.findOne({ guildId: interaction.guild.id, messageId });
            if (!suggestion) return interaction.reply({ content: 'لم يتم العثور على بيانات الاقتراح.', ephemeral: true });

            const replyText = interaction.fields.getTextInputValue('reply_text');
            const channel = interaction.channel;

            let thread = suggestion.replyThreadId ? await channel.threads.fetch(suggestion.replyThreadId).catch(() => null) : null;

            if (!thread) {
                const suggestionMsg = await channel.messages.fetch(messageId).catch(() => null);
                if (!suggestionMsg) return interaction.reply({ content: 'لم يتم العثور على رسالة الاقتراح.', ephemeral: true });

                thread = await suggestionMsg.startThread({
                    name: `رد-الإدارة-${interaction.user.username}`,
                    autoArchiveDuration: 1440,
                    type: ChannelType.PrivateThread
                }).catch(async () => {
                    return await suggestionMsg.startThread({
                        name: `رد-الإدارة-${interaction.user.username}`,
                        autoArchiveDuration: 1440
                    }).catch(() => null);
                });

                if (!thread) return interaction.reply({ content: 'تعذر إنشاء الثريد الخاص بالرد.', ephemeral: true });
                suggestion.replyThreadId = thread.id;
                await suggestion.save();

                const suggestionEmbed = EmbedBuilder.from(suggestionMsg.embeds[0]);
                const existingComponents = suggestionMsg.components.map(row => ActionRowBuilder.from(row));
                const viewBtnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`view_admin_reply:${messageId}`).setLabel('عرض رد الإدارة').setStyle(ButtonStyle.Secondary).setEmoji('💬')
                );
                await suggestionMsg.edit({ embeds: [suggestionEmbed], components: [...existingComponents, viewBtnRow] }).catch(() => {});
            }

            const replyEmbed = new EmbedBuilder()
                .setAuthor({ name: `رد الإدارة - ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(replyText)
                .setColor(0xd4af37)
                .setTimestamp();
            await thread.send({ embeds: [replyEmbed] });

            return interaction.reply({ content: 'تم إرسال ردك بنجاح.', ephemeral: true });
        }

        // --- [ View Admin Reply Button ] ---
        if (interaction.isButton() && interaction.customId.startsWith('view_admin_reply:')) {
            const messageId = interaction.customId.split(':')[1];
            const suggestion = await Suggestion.findOne({ guildId: interaction.guild.id, messageId });
            if (!suggestion?.replyThreadId) return interaction.reply({ content: 'لا يوجد رد من الإدارة على هذا الاقتراح بعد.', ephemeral: true });

            const thread = await interaction.channel.threads.fetch(suggestion.replyThreadId).catch(() => null);
            if (!thread) return interaction.reply({ content: 'الثريد غير موجود.', ephemeral: true });

            await thread.members.add(interaction.user.id).catch(() => {});
            return interaction.reply({ content: `تمت إضافتك لثريد رد الإدارة: ${thread}`, ephemeral: true });
        }
    } catch (err) {
        console.error('[Interaction Error]', { command: interaction.commandName || interaction.customId, guildId: interaction.guildId, userId: interaction.user?.id, message: err?.message });
        if (!interaction.isRepliable?.()) return;
        const payload = { content: 'تعذر تنفيذ العملية الآن. تحقق من صلاحيات البوت وحاول مجددًا.', ephemeral: true };
        if (interaction.deferred) await interaction.editReply(payload).catch(() => {});
        else if (interaction.replied) await interaction.followUp(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
    }
});


// ==========================================
// 13. Helper Functions
// ==========================================

async function openTicket(interaction, tConfig, ticketType, sectionConfig = {}) {
    let reservation = null;
    let ticketChannel = null;
    try {
        const activeTicketKey = `${interaction.guild.id}:${interaction.user.id}`;
        const existingTicket = await TicketData.findOne({ $or: [
            { activeTicketKey },
            { guildId: interaction.guild.id, ownerId: interaction.user.id, closedAt: null, channelId: { $nin: ['', null] }, activeTicketKey: { $exists: false } }
        ] });
        if (existingTicket) return interaction.reply({ content: existingTicket.channelId ? `لديك تكت مفتوح بالفعل: <#${existingTicket.channelId}>` : 'تكتك قيد الإنشاء الآن؛ انتظر قليلًا قبل المحاولة مجددًا.', ephemeral: true });

        const counter = await TicketConfig.findOneAndUpdate({ guildId: interaction.guild.id }, { $inc: { ticketCount: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        const ticketCount = counter.ticketCount;
        try {
            reservation = await TicketData.create({ guildId: interaction.guild.id, channelId: '', ownerId: interaction.user.id, activeTicketKey, ticketCount, ticketType, adminRole: sectionConfig.adminRole || '', categoryId: sectionConfig.categoryId || '', openedAt: new Date() });
        } catch (error) {
            if (error?.code === 11000) {
                const current = await TicketData.findOne({ guildId: interaction.guild.id, ownerId: interaction.user.id, closedAt: null, channelId: { $nin: ['', null] } });
                return interaction.reply({ content: current ? `لديك تكت مفتوح بالفعل: <#${current.channelId}>` : 'يجري فتح تكت لك الآن؛ انتظر لحظة وحاول مرة أخرى.', ephemeral: true });
            }
            throw error;
        }

        const safeUsername = String(interaction.user.username || 'member').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 48) || 'member';
        const permOverwrites = [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ];
        if (sectionConfig.adminRole) {
            const role = interaction.guild.roles.cache.get(sectionConfig.adminRole);
            if (role) permOverwrites.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] });
        }
        const channelOptions = { name: `ticket-${ticketCount}-${safeUsername}`.slice(0, 95), type: ChannelType.GuildText, permissionOverwrites: permOverwrites };
        if (sectionConfig.categoryId && interaction.guild.channels.cache.get(sectionConfig.categoryId)?.type === ChannelType.GuildCategory) channelOptions.parent = sectionConfig.categoryId;
        ticketChannel = await interaction.guild.channels.create(channelOptions);
        reservation.channelId = ticketChannel.id;
        await reservation.save();

        const files = [];
        const embed = new EmbedBuilder()
            .setTitle(`تكت ${String(ticketType || 'دعم').slice(0, 180)} | #${ticketCount}`)
            .setDescription(`مرحباً ${interaction.user}!\n\nالإدارة ستتواصل معك قريباً. يرجى شرح مشكلتك بالتفصيل.`)
            .setColor(0xd4af37)
            .addFields({ name: 'صاحب التكت', value: `${interaction.user}`, inline: true }, { name: 'النوع', value: String(ticketType || 'دعم').slice(0, 100), inline: true })
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: 'Drayz System · Tickets' });
        if (tConfig.topImagePath && fs.existsSync(tConfig.topImagePath)) {
            const topName = path.basename(tConfig.topImagePath);
            files.push(new AttachmentBuilder(tConfig.topImagePath, { name: topName }));
            embed.setThumbnail(`attachment://${topName}`);
        }
        if (tConfig.bottomImagePath && fs.existsSync(tConfig.bottomImagePath)) {
            const bottomName = path.basename(tConfig.bottomImagePath);
            files.push(new AttachmentBuilder(tConfig.bottomImagePath, { name: bottomName }));
            embed.setImage(`attachment://${bottomName}`);
        }
        const controlMenu = new StringSelectMenuBuilder().setCustomId('ticket_control_menu').setPlaceholder('لوحة التحكم بالتكت').addOptions([
            { label: 'استلام التكت', value: 'claim_ticket', description: 'استلام التكت للمعالجة' },
            { label: 'إغلاق وأرشفة', value: 'close_ticket', description: 'قفل الكتابة وحفظ السجل والتقييم' },
            { label: 'إضافة شخص', value: 'add_member', description: 'إضافة شخص للتكت' },
            { label: 'إزالة شخص', value: 'remove_member', description: 'إزالة شخص من التكت' },
            { label: 'استدعاء صاحب التكت', value: 'summon_member', description: 'إشعار صاحب التكت' }
        ]);
        try {
            await ticketChannel.send({ content: `${interaction.user} ${sectionConfig.adminRole ? `<@&${sectionConfig.adminRole}>` : ''}`, embeds: [embed], components: [new ActionRowBuilder().addComponents(controlMenu)], files, allowedMentions: { users: [interaction.user.id], roles: sectionConfig.adminRole ? [sectionConfig.adminRole] : [] } });
        } catch (error) {
            await Promise.all([ticketChannel.delete('فشل إرسال رسالة بدء التكت').catch(() => {}), TicketData.deleteOne({ _id: reservation._id }).catch(() => {})]);
            console.error('[Ticket Channel Send Error]', error.message);
            return interaction.reply({ content: 'تم إنشاء القناة لكن تعذر إرسال لوحة التكت؛ أزلنا القناة والحجز. تحقق من صلاحيات البوت وحاول مجددًا.', ephemeral: true });
        }
        return interaction.reply({ content: `تم فتح تكتك: ${ticketChannel}`, ephemeral: true });
    } catch (err) {
        console.error('[Ticket Error]', err);
        if (ticketChannel) await ticketChannel.delete('تعذر إكمال فتح التكت').catch(() => {});
        if (reservation) await TicketData.deleteOne({ _id: reservation._id }).catch(() => {});
        return interaction.reply({ content: 'حدث خطأ عند فتح التكت؛ تحقق من صلاحيات البوت وإعداد القناة.', ephemeral: true }).catch(() => {});
    }
}

// ==========================================
// 14. Kick Live Checker
// ==========================================

let kickCheckRunning = false;

function normalizeKickUsername(value) {
    return String(value || '')
        .trim()
        .replace(/^https?:\/\/(www\.)?kick\.com\//i, '')
        .replace(/^@/, '')
        .replace(/\?.*$/, '')
        .replace(/\/$/, '')
        .toLowerCase();
}

async function fetchKickChannel(username) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const headers = { Accept: 'application/json', 'User-Agent': 'Drayz System-Bot/2.0' };
        for (const version of ['v2', 'v1']) {
            const response = await fetch(`https://kick.com/api/${version}/channels/${encodeURIComponent(username)}`, {
                headers, signal: controller.signal
            });
            if (response.ok) return await response.json();
            if (response.status === 404) return null;
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function findKickStreamImage(value, key = '', depth = 0) {
    if (depth > 5 || value == null) return null;
    if (typeof value === 'string') {
        const url = value.trim();
        if (/^https?:\/\//i.test(url) && /(thumbnail|preview|stream)/i.test(key)) return url;
        return null;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findKickStreamImage(item, key, depth + 1);
            if (found) return found;
        }
        return null;
    }
    if (typeof value === 'object') {
        for (const [childKey, childValue] of Object.entries(value)) {
            const found = findKickStreamImage(childValue, childKey, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

function normalizeKickImageUrl(value) {
    return value
        ? String(value).replace(/\{width\}/gi, '1280').replace(/\{height\}/gi, '720')
        : null;
}

async function checkKickLive() {
    if (kickCheckRunning) return;
    kickCheckRunning = true;
    try {
        const allConfigs = await KickConfig.find({ 'streamers.0': { $exists: true } });
        for (const config of allConfigs) {
            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) continue;
            let changed = false;
            for (const streamer of config.streamers) {
                const username = normalizeKickUsername(streamer.kickUsername);
                if (!username) continue;
                try {
                    const data = await fetchKickChannel(username);
                    const livestream = data?.livestream ?? data?.data?.livestream ?? null;
                    const isLive = Boolean(livestream && (livestream.id || livestream.session_title || livestream.viewer_count !== undefined));
                    const categorySource = livestream?.category
    || (Array.isArray(livestream?.categories) ? livestream.categories[0] : null)
    || (Array.isArray(data?.categories) ? data.categories[0] : null);
const categoryName = categorySource?.name || categorySource?.title || categorySource?.slug || null;
const categorySlug = categorySource?.slug || null;
                    const channel = guild.channels.cache.get(streamer.channelId);

                    // Send first, then persist state. This prevents a transient Discord/API failure from losing the alert forever.
                    if (isLive && !streamer.isLive && channel?.isTextBased()) {
                        const embed = new EmbedBuilder()
                            .setTitle(`${username} بدأ البث المباشر`)
                            .setDescription((streamer.customMessage || '%name% بدأ البث الآن!').replace(/%name%/g, username))
                            .setURL(`https://kick.com/${username}`)
                            .setColor(0x53fc18)
                            .addFields(
                                { name: 'عنوان البث', value: String(livestream.session_title || 'بث مباشر').slice(0, 1024), inline: true },
                                { name: 'المشاهدون', value: `${livestream.viewer_count ?? 0}`, inline: true }
                            ).setTimestamp();
                        const profilePic = data?.user?.profile_pic || data?.user?.profile_pic_url || null;
                        const streamThumbnail = normalizeKickImageUrl(
                            findKickStreamImage(livestream) ||
                            livestream?.thumbnail?.url ||
                            livestream?.thumbnail_url ||
                            livestream?.preview?.url ||
                            null
                        );
                        if (profilePic) embed.setThumbnail(profilePic);
                        if (streamThumbnail) embed.setImage(streamThumbnail);
                        const mention = streamer.roleId ? `<@&${streamer.roleId}>` : undefined;
                        await channel.send({ content: mention, embeds: [embed] });
                        streamer.isLive = true;
                        streamer.lastCategoryName = categoryName;
                        streamer.kickUsername = username;
                        changed = true;
                    } else if (isLive && streamer.isLive && categoryName && streamer.lastCategoryName && categoryName !== streamer.lastCategoryName) {
                        const targetChannel = channel?.isTextBased() ? channel : null;
                        const categoryUrl = categorySlug ? `https://kick.com/category/${categorySlug}` : `https://kick.com/${username}`;
                        if (targetChannel) {
                            const mention = streamer.roleId ? `<@&${streamer.roleId}>` : undefined;
                            const categoryEmbed = new EmbedBuilder()
                                .setTitle('تغيير كاتيقوري البث')
                                .setURL(`https://kick.com/${username}`)
                                .setColor(0xf4c24c)
                                .setDescription(`**${username}** غيّر كاتيقوري بثه المباشر.`)
                                .addFields(
                                    { name: 'صاحب البث', value: `[${username}](https://kick.com/${username})`, inline: true },
                                    { name: 'من', value: String(streamer.lastCategoryName).slice(0, 1024), inline: true },
                                    { name: 'إلى', value: `[${categoryName}](${categoryUrl})`.slice(0, 1024), inline: true }
                                )
                                .setTimestamp();
                            await targetChannel.send({ content: mention, embeds: [categoryEmbed] });
                        }
                        streamer.lastCategoryName = categoryName;
                        streamer.kickUsername = username;
                        changed = true;
                    } else if (isLive && streamer.isLive && categoryName && streamer.lastCategoryName !== categoryName) {
                        // Initialize missing/old state without sending a false category-change alert.
                        streamer.lastCategoryName = categoryName;
                        streamer.kickUsername = username;
                        changed = true;
                    } else if (!isLive && streamer.isLive) {
                        streamer.isLive = false;
                        streamer.lastCategoryName = null;
                        streamer.kickUsername = username;
                        changed = true;
                    }
                } catch (err) {
                    console.error(`[Kick] ${username}:`, err.name === 'AbortError' ? 'request timeout' : err.message);
                }
            }
            if (changed) {
                config.markModified('streamers');
                await config.save();
            }
        }
    } catch (err) {
        console.error('[Kick Checker Error]', err.message);
    } finally {
        kickCheckRunning = false;
    }
}

setInterval(checkKickLive, Number(process.env.KICK_CHECK_INTERVAL_MS || 30000));

// ==========================================
// 15. Slash Commands Registration
// ==========================================

async function registerSlashCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('setbanner')
            .setDescription('ضبط بنر الترحيب')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addAttachmentOption(opt => opt.setName('image').setDescription('صورة البنر').setRequired(true)),
        new SlashCommandBuilder()
            .setName('rename_panel')
            .setDescription('إرسال لوحة تغيير الاسم')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(opt => opt.setName('name').setDescription('الاسم الجديد').setRequired(true))
            .addAttachmentOption(opt => opt.setName('image').setDescription('صورة اللوحة').setRequired(false)),

        // ===== 20 أمر إشراف قوية =====
        new SlashCommandBuilder().setName('ban').setDescription('حظر عضو من السيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب حظره').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('سبب الحظر').setRequired(false)),

        new SlashCommandBuilder().setName('unban').setDescription('فك حظر عضو عبر الـ ID')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addStringOption(o => o.setName('id').setDescription('ID العضو').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('سبب فك الحظر').setRequired(false)),

        new SlashCommandBuilder().setName('kick').setDescription('طرد عضو من السيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب طرده').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('سبب الطرد').setRequired(false)),

        new SlashCommandBuilder().setName('timeout').setDescription('كتم عضو (تايم اوت) لفترة محددة')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب كتمه').setRequired(true))
            .addIntegerOption(o => o.setName('minutes').setDescription('مدة الكتم بالدقائق').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('سبب الكتم').setRequired(false)),

        new SlashCommandBuilder().setName('untimeout').setDescription('فك الكتم عن عضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب فك كتمه').setRequired(true)),

        new SlashCommandBuilder().setName('warn').setDescription('توجيه تحذير لعضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب تحذيره').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('سبب التحذير').setRequired(true)),

        new SlashCommandBuilder().setName('warnings').setDescription('عرض تحذيرات عضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب عرض تحذيراته').setRequired(true)),

        new SlashCommandBuilder().setName('clearwarns').setDescription('مسح كل تحذيرات عضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب مسح تحذيراته').setRequired(true)),

        new SlashCommandBuilder().setName('purge').setDescription('حذف عدد من الرسائل من الروم')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addIntegerOption(o => o.setName('amount').setDescription('عدد الرسائل (1-100)').setRequired(true)),

        new SlashCommandBuilder().setName('lock').setDescription('قفل الروم الحالي عن الأعضاء')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

        new SlashCommandBuilder().setName('unlock').setDescription('فتح الروم الحالي للأعضاء')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

        new SlashCommandBuilder().setName('slowmode').setDescription('ضبط وضع البطء بالروم الحالي')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addIntegerOption(o => o.setName('seconds').setDescription('عدد الثواني (0 للإيقاف)').setRequired(true)),

        new SlashCommandBuilder().setName('nickname').setDescription('تغيير اسم عضو داخل السيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب').setRequired(true))
            .addStringOption(o => o.setName('name').setDescription('الاسم الجديد (اتركه فاضي للإرجاع)').setRequired(false)),

        new SlashCommandBuilder().setName('addrole').setDescription('إعطاء رتبة لعضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب').setRequired(true))
            .addRoleOption(o => o.setName('role').setDescription('الرتبة المطلوب إعطاؤها').setRequired(true)),

        new SlashCommandBuilder().setName('removerole').setDescription('سحب رتبة من عضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب').setRequired(true))
            .addRoleOption(o => o.setName('role').setDescription('الرتبة المطلوب سحبها').setRequired(true)),

        new SlashCommandBuilder().setName('announce').setDescription('نشر إعلان رسمي بالسيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(o => o.setName('title').setDescription('عنوان الإعلان').setRequired(true))
            .addStringOption(o => o.setName('text').setDescription('نص الإعلان').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('روم النشر').setRequired(true))
            .addRoleOption(o => o.setName('mention_role').setDescription('الرتبة المطلوب منشنها').setRequired(false))
            .addAttachmentOption(o => o.setName('image').setDescription('صورة الإعلان').setRequired(false)),

        new SlashCommandBuilder().setName('say').setDescription('إرسال رسالة من البوت لروم محدد')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(o => o.setName('text').setDescription('نص الرسالة').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('روم الإرسال').setRequired(false)),

        new SlashCommandBuilder().setName('userinfo').setDescription('عرض معلومات عن عضو')
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب').setRequired(false)),

        new SlashCommandBuilder().setName('serverinfo').setDescription('عرض معلومات عن السيرفر'),

        new SlashCommandBuilder().setName('avatar').setDescription('عرض صورة عضو')
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب').setRequired(false)),

        new SlashCommandBuilder().setName('clear').setDescription('حذف رسائل حديثة من الروم')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addIntegerOption(o => o.setName('amount').setDescription('العدد من 1 إلى 100').setRequired(true)),
        new SlashCommandBuilder().setName('softban').setDescription('حظر عضو مع حذف رسائله ثم فك الحظر')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('السبب').setRequired(false)),
        new SlashCommandBuilder().setName('roleinfo').setDescription('عرض معلومات رتبة')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .addRoleOption(o => o.setName('role').setDescription('الرتبة').setRequired(true)),
        new SlashCommandBuilder().setName('channelinfo').setDescription('عرض معلومات قناة')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(o => o.setName('channel').setDescription('القناة').setRequired(false)),
        new SlashCommandBuilder().setName('membercount').setDescription('عرض إحصائية الأعضاء')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder().setName('settopic').setDescription('تغيير موضوع القناة')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addStringOption(o => o.setName('text').setDescription('الموضوع الجديد').setRequired(false)),
        new SlashCommandBuilder().setName('renamechannel').setDescription('تغيير اسم قناة')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(o => o.setName('channel').setDescription('القناة').setRequired(true))
            .addStringOption(o => o.setName('name').setDescription('الاسم الجديد').setRequired(true)),
        new SlashCommandBuilder().setName('createchannel').setDescription('إنشاء قناة نصية')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addStringOption(o => o.setName('name').setDescription('اسم القناة').setRequired(true)),
        new SlashCommandBuilder().setName('deletechannel').setDescription('حذف قناة')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(o => o.setName('channel').setDescription('القناة').setRequired(true)),
        new SlashCommandBuilder().setName('setnsfw').setDescription('تفعيل أو تعطيل محتوى NSFW للقناة')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addBooleanOption(o => o.setName('enabled').setDescription('تفعيل').setRequired(true)),
        new SlashCommandBuilder().setName('lockserver').setDescription('قفل الكتابة في كل القنوات النصية')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder().setName('unlockserver').setDescription('فتح الكتابة في كل القنوات النصية')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder().setName('hidechannel').setDescription('إخفاء القناة عن الأعضاء')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(o => o.setName('channel').setDescription('القناة').setRequired(false)),
        new SlashCommandBuilder().setName('showchannel').setDescription('إظهار القناة للأعضاء')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(o => o.setName('channel').setDescription('القناة').setRequired(false)),
        new SlashCommandBuilder().setName('voicelimit').setDescription('ضبط حد أعضاء القناة الصوتية')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(o => o.setName('channel').setDescription('القناة الصوتية').setRequired(true))
            .addIntegerOption(o => o.setName('limit').setDescription('0 إلى 99').setRequired(true)),
        new SlashCommandBuilder().setName('move').setDescription('نقل عضو إلى قناة صوتية')
            .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
            .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('القناة الصوتية').setRequired(true)),
        new SlashCommandBuilder().setName('disconnect').setDescription('فصل عضو من القناة الصوتية')
            .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
            .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
        new SlashCommandBuilder().setName('massrole').setDescription('إعطاء رتبة لكل الأعضاء')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addRoleOption(o => o.setName('role').setDescription('الرتبة').setRequired(true)),
        new SlashCommandBuilder().setName('resetnick').setDescription('إرجاع أسماء الأعضاء المحدد')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
            .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
        new SlashCommandBuilder().setName('memberhistory').setDescription('عرض سجل عضو كامل')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب').setRequired(true)),
        new SlashCommandBuilder().setName('invites').setDescription('عرض إحصائيات دعوات عضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .addUserOption(o => o.setName('user').setDescription('العضو المطلوب').setRequired(true)),
        new SlashCommandBuilder().setName('resetlevels').setDescription('تصفير جميع مستويات السيرفر مع حفظ نسخة احتياطية')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder().setName('restorelevels').setDescription('استرجاع المستويات المحفوظة قبل آخر تصفير')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder().setName('emojiinfo').setDescription('عرض معلومات إيموجي')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers)
            .addStringOption(o => o.setName('emoji').setDescription('ID الإيموجي').setRequired(true)),
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('[Drayz System ] Slash commands registered.');
    } catch (err) {
        console.error('[Slash Register Error]', err);
    }
}

// ==========================================
// 16. Client Ready
// ==========================================

client.once('ready', async () => {
    console.log(`[Drayz System ] Bot is online as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'Drayz System ', type: ActivityType.Watching }],
        status: 'online'
    });

    for (const guild of client.guilds.cache.values()) await fetchGuildInvites(guild);
    await registerSlashCommands();
    checkKickLive();
});

// ==========================================
// 17. Start Server & Login
// ==========================================
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const uploadError = error?.name === 'MulterError';
    const status = uploadError && error.code === 'LIMIT_FILE_SIZE' ? 413 : (uploadError || error?.type === 'entity.too.large' || error instanceof SyntaxError ? 400 : 500);
    console.error('[HTTP Request Error]', { method: req.method, path: req.path, status, message: error?.message });
    return res.status(status).send(status === 413 ? 'حجم الملف أكبر من الحد المسموح.' : status === 400 ? 'الملف أو بيانات الطلب غير صالحة.' : 'حدث خطأ داخلي أثناء معالجة الطلب.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[Drayz System ] Dashboard running on port ${PORT}`);
});

client.login(process.env.TOKEN).catch(err => {
    console.error('[Drayz System ] Login failed:', err);
    process.exit(1);
});
