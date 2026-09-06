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
const axios = require('axios');
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

const TicketData = mongoose.model('TicketData', new mongoose.Schema({
    ticketCount: { type: Number, default: 0 },
    guildId: String,
    channelId: String,
    ownerId: String,
    ticketType: { type: String, default: 'تذكرة دعم' },
    adminRole: String,
    categoryId: String,
    claimedBy: String,
    openedAt: Date,
    closedAt: Date,
    closedBy: String
}));

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

const ModConfig = mongoose.model('ModConfig', new mongoose.Schema({
    guildId: String,
    jail: {
        commandName: { type: String, default: 'jail' },
        unjailCommand: { type: String, default: 'unjail' },
        roleId: String,
        channelId: String,
        adminRoles: [String]
    }
}));

const Warn = mongoose.model('Warn', new mongoose.Schema({
    guildId: String,
    userId: String,
    reason: String,
    moderatorId: String,
    createdAt: { type: Date, default: Date.now }
}));

const JailData = mongoose.model('JailData', new mongoose.Schema({
    guildId: String,
    userId: String,
    oldRoles: [String],
    endAt: Date
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
        levelUpChannel: String,
        leaderboardCommand: { type: String, default: '!levels' }
    },
    rolesPanel: [{
        roleId: String,
        label: String,
        type: { type: String, default: 'button' }
    }],
    rolesChannel: String,
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
    emoji1: String,
    emoji2: String
}));


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

const TicketConfig = mongoose.model('TicketConfig', new mongoose.Schema({
    guildId: String,
    channelId: String,
    title: String,
    description: String,
    color: String,
    topImagePath: String,
    bottomImagePath: String,
    ticketCount: { type: Number, default: 0 },
    buttons: [{ label: String, emoji: String, adminRole: String, categoryId: String }],
    menuOptions: [{ label: String, emoji: String, adminRole: String, categoryId: String }]
}));

// ==========================================
// 2. Express App Setup
// ==========================================
const app = express();
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json());
app.set('trust proxy', 1);
app.set('view engine', 'ejs');

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    .then(() => console.log('[DB] Connected to MongoDB'))
    .catch(err => console.log('[DB] Connection Error:', err));

// ==========================================
// 5. الدوال المساعدة
// ==========================================
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

function createRandomWelcomeBackground(filePath) {
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
    fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
    return { width: 1200, height: 600, theme: theme.accent };
}

function getEmojiDisplay(guild, emojiId) {
    if (!emojiId) return '❓';
    const em = guild.emojis.cache.get(emojiId);
    return em ? em.toString() : `<:v:${emojiId}>`;
}

async function handleUnjail(member, guildId) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild || !member) return;

        const jailData = await JailData.findOne({ guildId, userId: member.id });
        const modConfig = await ModConfig.findOne({ guildId });

        if (!jailData) return;

        const rolesToRestore = (jailData.oldRoles || []).filter(rId => guild.roles.cache.has(rId));

        if (modConfig?.jail?.roleId) {
            await member.roles.remove(modConfig.jail.roleId).catch(() => {});
        }

        for (const roleId of rolesToRestore) {
            await member.roles.add(roleId).catch(() => {});
        }

        await JailData.deleteOne({ guildId, userId: member.id });

        const jailChannel = guild.channels.cache.get(modConfig?.jail?.channelId);
        if (jailChannel) {
            const embed = new EmbedBuilder()
                .setTitle('فك السجن')
                .setDescription(`تم فك سجن <@${member.id}> وتم استرجاع رتبه بنجاح.`)
                .setColor(0x00ff88)
                .setTimestamp();
            jailChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[Unjail Error]', err);
    }
}

// ==========================================
// 6. Upload Setup
// ==========================================
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ==========================================
// 7. Auth Setup
// ==========================================
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    proxy: true,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

app.use(session({
    secret: process.env.SESSION_SECRET || 'VORTEX -secret-key-2026',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
};

const checkDashboardOwner = (req, res, next) => {
    const ownerId = String(process.env.DASHBOARD_OWNER_ID || '').trim();
    if (!ownerId) return res.status(500).send('DASHBOARD_OWNER_ID غير مضبوط في متغيرات البيئة.');
    if (String(req.user?.id || '') !== ownerId) return res.status(403).send('هذا الحساب غير مخول لدخول لوحة التحكم.');
    next();
};

const checkBotGuildAccess = (req, res, next) => {
    if (!client.guilds.cache.has(req.params.guildId)) return res.status(404).send('البوت غير موجود في هذا السيرفر.');
    next();
};

const checkGuildAccess = (req, res, next) => {
    const guildId = req.params.guildId;
    const guild = req.user?.guilds?.find(g => g.id === guildId);
    if (!guild) return res.status(403).send('ليس لديك صلاحية إدارة هذا السيرفر.');
    try {
        const permissions = BigInt(guild.permissions || 0);
        if ((permissions & 8n) !== 8n && (permissions & 32n) !== 32n) return res.status(403).send('تحتاج إلى صلاحية إدارة السيرفر أو Administrator.');
    } catch { return res.status(403).send('صلاحيات السيرفر غير صالحة.'); }
    next();
};

// The dashboard owner may view and configure every guild where the bot is present.
// Discord permissions are still checked separately before each bot action.
app.use('/manage/:guildId', checkAuth, checkDashboardOwner, checkBotGuildAccess);
app.use('/save/:guildId', checkAuth, checkDashboardOwner, checkBotGuildAccess);
app.use('/delete-kick/:guildId', checkAuth, checkDashboardOwner, checkBotGuildAccess);

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => {
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    req.logout(() => { res.redirect('/login'); });
});

app.get('/login', (req, res) => {
    res.send(`<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VORTEX · الدخول</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#0b0a08;--panel:#17130e;--panel-2:#211a12;--gold:#f4c24c;--gold-2:#a86e13;--red:#dd5147;--text:#f6f0e5;--muted:#a19889;--line:rgba(244,194,76,.18)}
*{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:var(--gold-2) #0f0d0a}*::-webkit-scrollbar{width:8px}*::-webkit-scrollbar-track{background:#0f0d0a}*::-webkit-scrollbar-thumb{background:linear-gradient(var(--gold),var(--gold-2));border-radius:20px}*::-webkit-scrollbar-button{display:none}
body{margin:0;min-height:100vh;background:var(--ink);color:var(--text);font-family:'Cairo',sans-serif;display:grid;place-items:center;overflow:hidden}body:before{content:'';position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 12% 20%,rgba(244,194,76,.13),transparent 28%),radial-gradient(circle at 84% 76%,rgba(221,81,71,.09),transparent 24%),linear-gradient(135deg,#0b0a08,#160f0d 48%,#0b0a08)}body:after{content:'';position:fixed;inset:0;pointer-events:none;opacity:.24;background-image:linear-gradient(rgba(244,194,76,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(244,194,76,.08) 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(90deg,transparent,#000 22%,#000 78%,transparent)}.login-shell{position:relative;z-index:1;width:min(1040px,calc(100% - 48px));min-height:590px;display:grid;grid-template-columns:1.1fr .9fr;background:rgba(20,16,11,.78);border:1px solid var(--line);border-radius:28px;overflow:hidden;box-shadow:0 30px 100px rgba(0,0,0,.42)}.brand-panel{position:relative;padding:58px 52px;background:linear-gradient(145deg,rgba(244,194,76,.12),rgba(18,14,10,.82) 53%,rgba(221,81,71,.09));display:flex;flex-direction:column;justify-content:space-between;border-left:1px solid var(--line)}.brand-panel:after{content:'V';position:absolute;left:5%;bottom:-24%;font:900 360px 'IBM Plex Mono',monospace;color:rgba(244,194,76,.045);line-height:1}.micro{position:relative;z-index:1;color:var(--gold);font:600 10px 'IBM Plex Mono',monospace;letter-spacing:2px}.brand-panel h1{position:relative;z-index:1;font-size:clamp(58px,8vw,105px);letter-spacing:10px;line-height:.9;margin:0;background:linear-gradient(115deg,#fff0b0 8%,var(--gold) 42%,#e47665 88%);-webkit-background-clip:text;color:transparent}.brand-panel p{position:relative;z-index:1;max-width:360px;color:var(--muted);font-size:13px;line-height:2;margin:20px 0 0}.system-list{position:relative;z-index:1;display:flex;gap:9px;flex-wrap:wrap;margin-top:30px}.system-list span{padding:7px 11px;border:1px solid var(--line);border-radius:20px;color:#cfc5b3;font-size:10px;background:rgba(0,0,0,.14)}.login-panel{padding:58px 52px;display:flex;flex-direction:column;justify-content:center;background:rgba(12,10,8,.74)}.panel-kicker{color:var(--muted);font:600 10px 'IBM Plex Mono',monospace;letter-spacing:1.5px;margin-bottom:20px}.login-panel h2{margin:0;font-size:31px;line-height:1.3}.login-panel p{color:var(--muted);font-size:13px;line-height:1.9;margin:12px 0 30px}.discord-button{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;min-height:58px;border-radius:13px;text-decoration:none;color:#191207;font-weight:800;font-size:14px;background:linear-gradient(100deg,var(--gold),#ffe59a 45%,var(--gold));box-shadow:0 14px 34px rgba(244,194,76,.18);transition:.25s}.discord-button svg{width:22px;height:22px;fill:#191207}.discord-button:hover{transform:translateY(-3px);box-shadow:0 20px 42px rgba(244,194,76,.3);filter:saturate(1.1)}.secure-note{display:flex;gap:8px;align-items:center;color:#827a6d;font-size:10px;margin-top:20px}.secure-note i{width:7px;height:7px;border-radius:50%;background:#5fd083;box-shadow:0 0 10px #5fd083}.corner-mark{margin-top:58px;color:#5f584e;font:500 9px 'IBM Plex Mono',monospace;letter-spacing:1.5px}
@media(max-width:760px){body{overflow:auto;display:block;padding:18px 0}.login-shell{width:calc(100% - 28px);min-height:0;display:flex;flex-direction:column}.brand-panel{padding:34px 25px 30px;min-height:300px}.brand-panel h1{font-size:58px;letter-spacing:6px}.brand-panel p{font-size:12px;margin-top:14px}.brand-panel:after{font-size:220px;bottom:-22%}.login-panel{padding:32px 25px 36px}.login-panel h2{font-size:26px}.corner-mark{margin-top:35px}}
</style>
</head>
<body><main class="login-shell"><section class="brand-panel"><div><div class="micro">VORTEX / CONTROL CENTER</div><h1>VORTEX</h1><p>مركز تحكم واحد لإدارة سيرفراتك، حماية مجتمعك، ومتابعة كل الأنظمة من واجهة مرتبة وسريعة.</p><div class="system-list"><span>SECURE ACCESS</span><span>DISCORD POWERED</span><span>LIVE CONTROL</span></div></div><div class="corner-mark">SYSTEM ONLINE · BUILD 2.0</div></section><section class="login-panel"><div class="panel-kicker">AUTHENTICATION REQUIRED</div><h2>أهلًا بك في مركز التحكم</h2><p>سجّل الدخول بحساب Discord المصرّح له للوصول إلى إعدادات السيرفر ولوحة الإدارة.</p><a href="/auth/discord" class="discord-button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.54 5.04A16.9 16.9 0 0 0 15.4 3.75l-.52 1.06a15.2 15.2 0 0 0-5.76 0L8.6 3.75a16.9 16.9 0 0 0-4.14 1.29C1.84 8.94 1.13 12.86 1.49 16.73a16.8 16.8 0 0 0 5.06 2.57l1.23-1.67c-.68-.26-1.33-.58-1.94-.96l.47-.36c3.74 1.75 7.8 1.75 11.49 0l.48.36c-.62.38-1.27.7-1.95.96l1.23 1.67a16.8 16.8 0 0 0 5.06-2.57c.42-4.49-.72-8.37-3.08-11.69ZM8.24 15.23c-1.12 0-2.04-1.03-2.04-2.3s.9-2.3 2.04-2.3c1.14 0 2.05 1.03 2.04 2.3 0 1.27-.9 2.3-2.04 2.3Zm7.52 0c-1.12 0-2.04-1.03-2.04-2.3s.9-2.3 2.04-2.3c1.14 0 2.05 1.03 2.04 2.3 0 1.27-.9 2.3-2.04 2.3Z"/></svg>تسجيل الدخول عبر Discord</a><div class="secure-note"><i></i> يتم تحويلك إلى Discord الرسمي للمصادقة الآمنة</div></section></main></body></html>`);
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
        ['serverinvite', 'رابط السيرفر', `/manage/${guildId}/serverinvite`, '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.2-1.2"/><path d="m8 16 8-8"/>'],
        ['security', 'الحماية', `/manage/${guildId}/security`, '<path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/>'],
        ['kick', 'تنبيهات Kick', `/manage/${guildId}/kick`, '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'],
        ['admincmds', 'الأوامر الإدارية', `/manage/${guildId}/admincmds`, '<path d="m4 7 4-4 4 4-4 4zM12 17l4-4 4 4-4 4zM14 7h6M4 17h6"/>'],
        ['suggestions', 'الاقتراحات', `/manage/${guildId}/suggestions`, '<path d="M20 11a7 7 0 0 1-7 7H8l-4 3v-6a7 7 0 1 1 16-4z"/>'],
        ['logs', 'السجلات', `/manage/${guildId}/logs`, '<path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6M9 7h3"/>'],
        ['tickets', 'التذاكر', `/manage/${guildId}/tickets`, '<path d="M4 7h16v10H4z"/><path d="M8 7v10M16 7v10"/>'],
        ['autoreply', 'الردود الآلية', `/manage/${guildId}/autoreply`, '<path d="M4 5h16v11H8l-4 3z"/><path d="M8 9h8M8 12h5"/>'],
        ['levels', 'نظام المستويات', `/manage/${guildId}/levels`, '<path d="M5 19V9M12 19V5M19 19v-8"/>'],
        ['welcome', 'الترحيب', `/manage/${guildId}/welcome`, '<path d="M12 21s-8-4.5-8-10V5l8-3 8 3v6c0 5.5-8 10-8 10z"/><path d="m9 12 2 2 4-4"/>'],
        ['giveaway', 'الهدايا', `/manage/${guildId}/giveaway`, '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7H8a2 2 0 1 1 2-2c2 0 2 2 2 2z"/>'],
        ['roles', 'الرتب', `/manage/${guildId}/roles`, '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 0 1 5 2M17 20h4"/>'],
        ['mod', 'الإشراف', `/manage/${guildId}/mod`, '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'],
        ['massban', 'تبنيد الأشخاص', `/manage/${guildId}/massban`, '<path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6z"/><path d="M8 12h8"/>'],
        ['channelswipe', 'حذف جميع الرومات', `/manage/${guildId}/channelswipe`, '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>'],
        ['poetry', 'الشعر العراقي', `/manage/${guildId}/poetry`, '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>']
    ] : [];
    const navHtml = nav.map(([key, label, href, path]) => `<a class="rail-link ${active === key ? 'is-active' : ''}" href="${href}" aria-current="${active === key ? 'page' : 'false'}"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg><span>${label}</span><i></i></a>`).join('');
    return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safe(guildName)} · VORTEX</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#0c0b09;--panel:#15120e;--panel-2:#1b1711;--panel-3:#231d15;--line:rgba(244,194,76,.15);--line-strong:rgba(244,194,76,.34);--gold:#f4c24c;--gold-2:#b57b19;--red:#e14d43;--red-soft:rgba(225,77,67,.14);--muted:#918a7c;--text:#f5f0e6;--shadow:0 22px 70px rgba(0,0,0,.28);--rail:272px}
*{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:var(--gold-2) #0f0d0a}*::-webkit-scrollbar{width:9px;height:9px}*::-webkit-scrollbar-track{background:#0f0d0a;border-radius:12px}*::-webkit-scrollbar-thumb{background:linear-gradient(180deg,var(--gold),var(--gold-2));border:2px solid #0f0d0a;border-radius:12px}*::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#ffe08a,var(--gold))}*::-webkit-scrollbar-button{display:none;width:0;height:0}html{background:var(--ink);overflow-x:hidden}body{margin:0;background:radial-gradient(circle at 15% 8%,rgba(244,194,76,.06),transparent 28%),radial-gradient(circle at 90% 80%,rgba(225,77,67,.05),transparent 24%),var(--ink);color:var(--text);font-family:'Cairo',sans-serif;min-height:100vh}body:before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.22;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom,#000,transparent 88%)}a{color:inherit}.app{min-height:100vh}.rail{position:fixed;z-index:20;inset:0 0 0 auto;width:var(--rail);padding:24px 16px 18px;background:linear-gradient(180deg,rgba(24,19,13,.98),rgba(12,11,9,.98));border-left:1px solid var(--line);display:flex;flex-direction:column;box-shadow:-16px 0 50px rgba(0,0,0,.16)}.brand{display:flex;align-items:center;gap:11px;padding:4px 9px 23px;border-bottom:1px solid var(--line)}.brand-mark{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(145deg,var(--gold),var(--gold-2));color:#161007;font-size:18px;font-weight:900;box-shadow:0 10px 25px rgba(244,194,76,.18)}.brand strong{display:block;font-size:19px;letter-spacing:2px;line-height:1}.brand small{display:block;color:var(--muted);font-size:9px;letter-spacing:2px;margin-top:5px;font-family:'IBM Plex Mono',monospace}.rail-section{color:#756d61;font:600 10px 'IBM Plex Mono',monospace;letter-spacing:1px;margin:25px 10px 9px;text-transform:uppercase}.rail-nav{display:flex;flex-direction:column;gap:4px;overflow:auto;padding:2px 3px 10px 2px;scrollbar-width:thin;scrollbar-color:var(--gold-2) transparent}.rail-nav::-webkit-scrollbar{width:6px}.rail-nav::-webkit-scrollbar-track{background:transparent}.rail-nav::-webkit-scrollbar-thumb{border:0;background:linear-gradient(180deg,var(--gold),var(--gold-2))}.rail-nav::-webkit-scrollbar-button{display:none}.rail-link{min-height:43px;display:flex;align-items:center;gap:12px;padding:9px 11px;border:1px solid transparent;border-radius:12px;text-decoration:none;color:#a59c8d;font-size:12px;font-weight:600;transition:.2s ease}.rail-link svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}.rail-link i{width:5px;height:5px;border-radius:50%;margin-right:auto;background:transparent}.rail-link:hover{background:rgba(244,194,76,.07);color:var(--text);transform:translateX(-3px)}.rail-link.is-active{background:linear-gradient(90deg,rgba(244,194,76,.16),rgba(244,194,76,.045));border-color:var(--line);color:var(--gold);box-shadow:inset -3px 0 var(--gold)}.rail-link.is-active i{background:var(--gold);box-shadow:0 0 12px var(--gold)}.rail-footer{margin-top:auto;padding:15px 10px 0;border-top:1px solid var(--line);color:var(--muted);font-size:10px}.rail-footer a{color:var(--red);text-decoration:none;float:left}.workspace{margin-right:var(--rail);min-width:0}.topbar{height:78px;padding:0 42px;display:flex;align-items:center;gap:18px;border-bottom:1px solid var(--line);background:rgba(12,11,9,.72);backdrop-filter:blur(18px);position:sticky;top:0;z-index:10}.menu-btn{display:none;border:1px solid var(--line);background:var(--panel);color:var(--gold);border-radius:11px;width:42px;height:42px;font-size:20px}.crumb{color:var(--muted);font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.5px}.crumb b{display:block;color:var(--text);font:700 18px 'Cairo',sans-serif;margin-top:2px}.top-status{margin-right:auto;display:flex;align-items:center;gap:8px;color:#b4ad9f;font-size:11px}.status-dot{width:7px;height:7px;border-radius:50%;background:#48c774;box-shadow:0 0 12px #48c774}.top-actions{display:flex;gap:8px}.top-actions a{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--line);border-radius:10px;color:var(--muted);text-decoration:none;background:rgba(255,255,255,.015)}.top-actions a:hover{color:var(--gold);border-color:var(--line-strong)}.content{padding:38px 42px 60px;max-width:1500px;margin:auto}.welcome-strip{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:30px;padding:31px 34px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(110deg,rgba(244,194,76,.11),rgba(23,18,12,.88) 45%),var(--panel);box-shadow:var(--shadow);position:relative;overflow:hidden}.welcome-strip:after{content:'V';position:absolute;left:27px;top:-42px;color:rgba(244,194,76,.055);font:900 180px 'IBM Plex Mono',monospace}.eyebrow{color:var(--gold);font:600 10px 'IBM Plex Mono',monospace;letter-spacing:1.5px;text-transform:uppercase}.welcome-strip h1{margin:8px 0 3px;font-size:29px;letter-spacing:-.5px}.welcome-strip p{margin:0;color:var(--muted);font-size:12px}.welcome-meta{position:relative;z-index:1;text-align:left;color:var(--muted);font:500 10px 'IBM Plex Mono',monospace}.view{min-width:0}.card{background:linear-gradient(145deg,rgba(35,29,21,.88),rgba(18,15,11,.92));border:1px solid var(--line);border-radius:18px;padding:25px;margin-bottom:20px;box-shadow:0 12px 40px rgba(0,0,0,.14)}.card:hover{border-color:var(--line-strong)}.card h3{display:flex;align-items:center;gap:10px;margin:0 0 20px;font-size:16px;color:var(--text)}.card h3 svg{width:19px;color:var(--gold)}label{display:block;color:#b6ad9d;font-size:12px;margin:15px 0 7px}input,select,textarea{width:100%;padding:12px 14px;color:var(--text);background:#0f0d0a;border:1px solid rgba(255,255,255,.09);border-radius:10px;outline:0;font:500 13px 'Cairo',sans-serif;transition:.2s}input:focus,select:focus,textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(244,194,76,.1)}textarea{min-height:105px;resize:vertical}.btn-save{border:0;border-radius:10px;padding:12px 21px;background:linear-gradient(135deg,var(--gold),var(--gold-2));color:#171006;font:800 12px 'Cairo',sans-serif;cursor:pointer;box-shadow:0 8px 20px rgba(244,194,76,.12);transition:.2s}.btn-save:hover{transform:translateY(-2px);filter:brightness(1.08)}.btn-danger{background:var(--red)!important;color:#fff!important}.tag{display:inline-flex;align-items:center;border-radius:20px;padding:4px 9px;font-size:10px}.tag-blue{background:rgba(244,194,76,.12);color:var(--gold);border:1px solid var(--line)}.tag-red{background:var(--red-soft);color:#f0837b;border:1px solid rgba(225,77,67,.2)}.data-table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid var(--line);border-radius:13px;font-size:12px}.data-table th{background:rgba(244,194,76,.07);color:var(--gold);font-size:10px;text-align:right;padding:13px}.data-table td{padding:13px;border-top:1px solid rgba(255,255,255,.055);color:#c8c0b2}.data-table-wrap{overflow:auto}.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.stat-box{padding:20px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.018)}.stat-num{color:var(--gold);font:800 28px 'IBM Plex Mono',monospace}.stat-label{color:var(--muted);font-size:11px;margin-top:5px}.guild-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}.guild-card{padding:21px;border:1px solid var(--line);border-radius:17px;background:var(--panel);transition:.2s}.guild-card:hover{transform:translateY(-4px);border-color:var(--gold)}.guild-icon{width:48px;height:48px;border-radius:14px;object-fit:cover;margin-bottom:14px}.guild-card h3{margin:0 0 12px;font-size:15px}.toggle-row{display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.06)}.toggle-row input[type=checkbox]{width:19px;height:19px;accent-color:var(--gold)}.drawer-backdrop{display:none}
@media(max-width:950px){:root{--rail:245px}.content{padding:28px 24px}.topbar{padding:0 24px}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.rail{transform:translateX(110%);transition:transform .25s ease;width:min(300px,88vw);box-shadow:-25px 0 80px rgba(0,0,0,.5)}.rail.is-open{transform:translateX(0)}.workspace{margin-right:0}.menu-btn{display:block}.topbar{height:67px;padding:0 15px}.top-status,.top-actions a:first-child{display:none}.crumb b{font-size:15px}.content{padding:18px 13px 35px}.welcome-strip{display:block;padding:22px 20px}.welcome-strip h1{font-size:23px}.welcome-meta{text-align:right;margin-top:16px}.stats-grid{grid-template-columns:1fr 1fr;gap:9px}.stat-box{padding:15px}.stat-num{font-size:21px}.card{padding:18px 14px;border-radius:14px}.drawer-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:15}.drawer-backdrop.is-open{display:block}}
</style>
</head>
<body>
<div class="app">
<aside class="rail" id="rail"><div class="brand"><div class="brand-mark">V</div><div><strong>VORTEX</strong><small>CONTROL CENTER</small></div></div>${guildId ? '<div class="rail-section">Workspace</div><nav class="rail-nav">'+navHtml+'</nav>' : ''}<div class="rail-footer">${guildId ? safe(guildName) : 'إدارة السيرفرات'}<a href="/logout">خروج</a></div></aside>
<div class="drawer-backdrop" id="backdrop"></div>
<section class="workspace"><header class="topbar"><button class="menu-btn" id="menuBtn" aria-label="فتح القائمة">☰</button><div class="crumb"><span>VORTEX / DASHBOARD</span><b>${safe(guildName)}</b></div><div class="top-status"><span class="status-dot"></span> النظام متصل</div><div class="top-actions"><a href="/dashboard" title="السيرفرات">⌂</a><a href="/logout" title="تسجيل الخروج">↪</a></div></header><main class="content"><section class="welcome-strip"><div><div class="eyebrow">ADMINISTRATIVE WORKSPACE</div><h1>${safe(guildName)}</h1><p>تحكم بكل أنظمة السيرفر من مساحة واحدة واضحة وسريعة.</p></div><div class="welcome-meta">LIVE / ${new Date().toLocaleDateString('en-GB')}</div></section><div class="view">${content}</div></main></section>
</div>
<script>
(() => { const rail=document.getElementById('rail'), backdrop=document.getElementById('backdrop'), btn=document.getElementById('menuBtn'); if(!rail||!backdrop||!btn)return; const close=()=>{rail.classList.remove('is-open');backdrop.classList.remove('is-open')}; btn.addEventListener('click',()=>{rail.classList.toggle('is-open');backdrop.classList.toggle('is-open')}); backdrop.addEventListener('click',close); window.addEventListener('keydown',e=>{if(e.key==='Escape')close()}); })();
</script>
</body></html>`;
}

// --- [ Dashboard - Admin Commands ] ---
app.get('/manage/:guildId/admincmds', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let config = await AdminCmdConfig.findOne({ guildId: g.id }) || new AdminCmdConfig({ guildId: g.id });

    const classes = [
        { title: 'إدارة الشات', keys: ['lock', 'unlock'] },
        { title: 'نظام الكتم', keys: ['timeout', 'untimeout'] },
        { title: 'نظام الحظر', keys: ['ban', 'unban'] },
        { title: 'نظام الطرد', keys: ['kick'] }
    ];

    let classesHtml = '';
    classes.forEach(cls => {
        classesHtml += `<div class="card" style="border-right: 4px solid var(--gold);"><h4 style="color:var(--gold); margin-bottom:15px;">${cls.title}</h4><div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">`;
        cls.keys.forEach(k => {
            const s = config.settings[k];
            const label = k === 'lock' ? 'قفل الشات' : k === 'unlock' ? 'فتح الشات' : k === 'timeout' ? 'كتم' : k === 'untimeout' ? 'فك الكتم' : k === 'ban' ? 'باند' : k === 'unban' ? 'فك باند' : 'كيك';
            classesHtml += `
                <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
                    <div style="font-weight:800; font-size:14px; margin-bottom:10px;">${label}</div>
                    <label style="font-size:11px; color:#888;">الاختصار</label>
                    <input type="text" name="${k}_shortcut" value="${s.shortcut}" style="margin-top:5px; margin-bottom:10px;">
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                            <input type="checkbox" name="${k}_delUser" ${s.delUser ? 'checked' : ''} style="width:16px; height:16px; margin:0;"> حذف رسالة العضو
                        </label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                            <input type="checkbox" name="${k}_delBot" ${s.delBot ? 'checked' : ''} style="width:16px; height:16px; margin:0;"> حذف رد البوت
                        </label>
                    </div>
                </div>
            `;
        });
        classesHtml += `</div></div>`;
    });

    const content = `
        <div class="card">
            <h2 style="margin-bottom:10px;">الأوامر الإدارية المتقدمة</h2>
            <p style="color:#666; font-size:13px; margin-bottom:30px;">تحكم في اختصارات الأوامر وطريقة تفاعل البوت معها في السيرفر.</p>
            <form method="POST" action="/save/${g.id}/admincmds">
                <div class="card" style="background:rgba(212,175,55,0.05); border:1px dashed var(--gold);">
                    <label style="font-weight:800;">الرتب المسموح لها (IDs مفصولة بفاصلة)</label>
                    <input type="text" name="adminRoles" value="${config.adminRoles.join(',')}" placeholder="مثلاً: 123456789,987654321">
                </div>
                ${classesHtml}
                <button type="submit" class="btn-save" style="font-size:16px; padding:15px;">حفظ كافة التغييرات</button>
            </form>
        </div>
    `;
    res.send(ui(g, 'admincmds', content));
});

app.post('/save/:guildId/admincmds', checkAuth, async (req, res) => {
    const guildId = req.params.guildId;
    const b = req.body;
    const roles = b.adminRoles.split(',').map(r => r.trim()).filter(Boolean);
    const update = {
        adminRoles: roles,
        settings: {
            lock: { shortcut: b.lock_shortcut, delUser: !!b.lock_delUser, delBot: !!b.lock_delBot },
            unlock: { shortcut: b.unlock_shortcut, delUser: !!b.unlock_delUser, delBot: !!b.unlock_delBot },
            timeout: { shortcut: b.timeout_shortcut, delUser: !!b.timeout_delUser, delBot: !!b.timeout_delBot },
            untimeout: { shortcut: b.untimeout_shortcut, delUser: !!b.untimeout_delUser, delBot: !!b.untimeout_delBot },
            ban: { shortcut: b.ban_shortcut, delUser: !!b.ban_delUser, delBot: !!b.ban_delBot },
            unban: { shortcut: b.unban_shortcut, delUser: !!b.unban_delUser, delBot: !!b.unban_delBot },
            kick: { shortcut: b.kick_shortcut, delUser: !!b.kick_delUser, delBot: !!b.kick_delBot }
        }
    };
    await AdminCmdConfig.findOneAndUpdate({ guildId }, { $set: update }, { upsert: true });
    res.redirect(`/manage/${guildId}/admincmds`);
});

// ==========================================

// --- [ Dashboard - Server List ] ---
app.get('/dashboard', checkAuth, checkDashboardOwner, (req, res) => {
    const botGuilds = [...client.guilds.cache.values()];
    const cards = botGuilds.map(g => {
        const iconURL = g.iconURL({ extension: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        return `<div class="guild-card"><img src="${iconURL}" class="guild-icon" alt="${g.name}"><h3>${g.name}</h3><a href="/manage/${g.id}/home" style="color:var(--gold);">الإعدادات</a></div>`;
    }).join('');

    const content = `
    <div style="text-align:center; margin-bottom:40px;">
        <div style="font-size:48px; font-weight:800; letter-spacing:6px;
            background: linear-gradient(135deg, var(--gold), #fff, var(--red));
            -webkit-background-clip:text; -webkit-text-fill-color:transparent;
            margin-bottom:10px;">VORTEX </div>
        <p style="color:var(--text-muted); font-size:15px;">اختر السيرفر لإدارته</p>
        <div style="margin-top:20px; max-width:400px; margin-left:auto; margin-right:auto;">
            <input type="text" id="guildSearch" placeholder="ابحث عن سيرفر..." onkeyup="filterGuilds()" style="text-align:center; border-radius:20px; background:rgba(212,175,55,0.05); border:1px solid var(--gold-border);">
        </div>
    </div>
    <div class="guild-grid" id="guildGrid">${cards}</div>
    <script>
        function filterGuilds() {
            const input = document.getElementById('guildSearch');
            const filter = input.value.toLowerCase();
            const grid = document.getElementById('guildGrid');
            const cards = grid.getElementsByClassName('guild-card');
            for (let i = 0; i < cards.length; i++) {
                const h3 = cards[i].getElementsByTagName('h3')[0];
                const txtValue = h3.textContent || h3.innerText;
                if (txtValue.toLowerCase().indexOf(filter) > -1) {
                    cards[i].style.display = "";
                } else {
                    cards[i].style.display = "none";
                }
            }
        }
    </script>`;

    res.send(ui({ id: null, name: 'قائمة السيرفرات' }, 'home', content));
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

async function createGuildInvite(guild) {
    const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
    if (!botMember) return null;
    const channels = [...guild.channels.cache.values()]
        .filter(channel => channel.type !== ChannelType.GuildCategory && channel.isTextBased?.());
    for (const channel of channels) {
        const permissions = channel.permissionsFor(botMember);
        if (!permissions?.has(PermissionFlagsBits.CreateInstantInvite)) continue;
        const invite = await channel.createInvite({
            maxAge: 0,
            maxUses: 0,
            unique: false,
            reason: 'إنشاء رابط دخول من لوحة تحكم VORTEX'
        }).catch(() => null);
        if (invite) return { url: invite.url, channelName: channel.name };
    }
    return null;
}

app.get('/manage/:guildId/serverinvite', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const invite = await createGuildInvite(g);
    const safeUrl = invite?.url ? invite.url.replace(/&/g, '&amp;').replace(/"/g, '&quot;') : '';
    const content = invite
        ? `<div class="card"><h3>رابط دخول السيرفر</h3><p style="color:var(--text-muted);font-size:13px;line-height:1.9;">هذا رابط دعوة دائم للسيرفر، تم إنشاؤه من القناة <b style="color:var(--gold);">#${invite.channelName}</b>.</p><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><input id="serverInvite" value="${safeUrl}" readonly style="direction:ltr;text-align:left;flex:1;min-width:240px;"><button type="button" id="copyInvite" class="btn-save">نسخ الرابط</button><a href="${safeUrl}" target="_blank" rel="noopener" class="btn-save" style="text-decoration:none;">فتح الرابط</a></div></div><script>document.getElementById('copyInvite').addEventListener('click',async function(){const input=document.getElementById('serverInvite');try{await navigator.clipboard.writeText(input.value)}catch{input.select();document.execCommand('copy')}this.textContent='تم النسخ';setTimeout(()=>this.textContent='نسخ الرابط',1800)});</script>`
        : `<div class="card"><h3>رابط دخول السيرفر</h3><p style="color:var(--red);font-size:13px;line-height:1.9;">تعذر إنشاء رابط دعوة. تأكد أن البوت يملك صلاحية <b>Create Instant Invite</b> في روم واحد على الأقل، ثم حدّث الصفحة.</p></div>`;
    res.send(ui(g, 'serverinvite', content));
});

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
        <td><span class="tag tag-blue">${st.kickUsername}</span></td>
        <td style="color:var(--text-muted);">#${g.channels.cache.get(st.channelId)?.name || 'قناة محذوفة'}</td>
        <td>${st.roleId ? `<span class="tag tag-red">@${g.roles.cache.get(st.roleId)?.name || 'رتبة محذوفة'}</span>` : '<span class="tag" style="background:rgba(255,255,255,0.05);color:var(--text-muted);">بدون منشن</span>'}</td>
        <td>
            <a href="/delete-kick/${g.id}/${i}" class="btn-save btn-danger btn-sm" style="text-decoration:none;" onclick="return confirm('حذف الستريمر؟')">حذف</a>
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
                            ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label>الرتبة للمنشن (اختياري)</label>
                        <select name="roleId">
                            <option value="">-- بدون منشن --</option>
                            ${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
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

app.post('/save/:guildId/kick', checkAuth, async (req, res) => {
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

app.get('/delete-kick/:guildId/:index', checkAuth, async (req, res) => {
    const { guildId, index } = req.params;
    const config = await KickConfig.findOne({ guildId });
    if (config) { config.streamers.splice(index, 1); await config.save(); }
    res.redirect(`/manage/${guildId}/kick`);
});

// --- [ Suggestions ] ---
app.get('/manage/:guildId/suggestions', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await SuggestionConfig.findOne({ guildId: g.id }) || {};

    const content = `
    <form method="POST" action="/save/${g.id}/suggestions" enctype="multipart/form-data">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>
                نظام الاقتراحات
            </h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
                حدد روم الاقتراحات، ارفع صورة تظهر داخل كل اقتراح، وحدد إيموجيين (بالـ ID) يستخدمان للتصويت.
            </p>
            <label>روم الاقتراحات</label>
            <select name="channelId" required>
                <option value="">-- اختر الروم --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.channelId === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
            </select>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>ID الإيموجي الأول</label>
                    <input type="text" name="emoji1" value="${s.emoji1 || ''}" placeholder="مثلاً: 123456789012345678">
                </div>
                <div>
                    <label>ID الإيموجي الثاني</label>
                    <input type="text" name="emoji2" value="${s.emoji2 || ''}" placeholder="مثلاً: 123456789012345678">
                </div>
            </div>
            <label>صورة الاقتراح (تظهر داخل كل ايمبد اقتراح)</label>
            <input type="file" name="suggestImage" accept="image/*">
            ${s.imagePath ? `<div style="margin-top:12px;"><img src="/${s.imagePath.replace(/^\.\//,'')}" style="max-width:220px; border-radius:12px; border:1px solid var(--gold-border);"></div>` : ''}
            <button class="btn-save" style="margin-top:20px;">حفظ إعدادات الاقتراحات</button>
        </div>
    </form>`;

    res.send(ui(g, 'suggestions', content));
});

app.post('/save/:guildId/suggestions', checkAuth, upload.single('suggestImage'), async (req, res) => {
    const { guildId } = req.params;
    const { channelId, emoji1, emoji2 } = req.body;
    const update = { channelId, emoji1: (emoji1 || '').trim(), emoji2: (emoji2 || '').trim() };
    if (req.file) update.imagePath = req.file.path;
    await SuggestionConfig.findOneAndUpdate({ guildId }, { $set: update }, { upsert: true });
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
                        `<option value="${c.id}" ${s.logs?.[t]?.channel === c.id ? 'selected' : ''}># ${c.name}</option>`
                    ).join('')}
                </select>
            </div>`).join('')}
            <button class="btn-save" style="margin-top:20px;">حفظ اللوق</button>
        </div>
    </form>`;

    res.send(ui(g, 'logs', content));
});

app.post('/save/:guildId/logs', checkAuth, async (req, res) => {
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
    let img = s.welcome?.imagePath || 'https://placehold.co/800x400?text=No+Background';

    const content = `
    <form method="POST" action="/save/${g.id}/welcome" class="welcome-editor">
        <div class="editor-grid">
            <div class="card designer-card">
                <div class="editor-heading"><div><div class="eyebrow">WELCOME BUILDER</div><h2>صمّم بطاقة الترحيب</h2><p>حرّك الصورة أو استخدم أدوات التحكم الدقيقة. التغيير يظهر مباشرة داخل المعاينة.</p></div><span class="editor-badge">LIVE PREVIEW</span></div>
                <div class="welcome-preview" id="previewContainer">
                    <img src="${img}" id="bgPreview" alt="خلفية المعاينة">
                    <div class="preview-shade"></div><div class="preview-copy"><span>WELCOME</span><strong>{member}</strong><small>إلى ${g.name}</small></div>
                    <div id="previewAvatar" class="preview-avatar" style="width:${s.welcome?.avatarWidth || 150}px;height:${s.welcome?.avatarHeight || 150}px;left:calc(${s.welcome?.avatarX || 50}% - ${(s.welcome?.avatarWidth || 150)/2}px);top:calc(${s.welcome?.avatarY || 50}% - ${(s.welcome?.avatarHeight || 150)/2}px);background-image:url('${client.user?.displayAvatarURL() || ''}')"><button type="button" id="avatarHandle" aria-label="تحريك الصورة">✥</button></div>
                </div>
                <div class="range-controls">
                    <label>حجم الصورة <output id="sizeOutput">${s.welcome?.avatarWidth || 150}px</output><input id="sizeSlider" type="range" min="70" max="320" value="${s.welcome?.avatarWidth || 150}"></label>
                    <label>الموضع الأفقي <output id="xOutput">${s.welcome?.avatarX || 50}%</output><input id="xSlider" type="range" min="0" max="100" value="${s.welcome?.avatarX || 50}"></label>
                    <label>الموضع العمودي <output id="yOutput">${s.welcome?.avatarY || 50}%</output><input id="ySlider" type="range" min="0" max="100" value="${s.welcome?.avatarY || 50}"></label>
                </div>
            </div>
            <div class="card settings-card">
                <div class="card-title"><span class="title-icon">✦</span><h3>إعدادات المحتوى</h3></div>
                <div class="toggle-row"><label style="margin:0;color:var(--text)">تفعيل الترحيب</label><input type="checkbox" name="enabled" ${s.welcome?.enabled ? 'checked' : ''}></div>
                <label>قناة الترحيب</label><select name="channel"><option value="">-- اختر القناة --</option>${g.channels.cache.filter(c=>c.type===0).map(c=>`<option value="${c.id}" ${s.welcome?.channel===c.id?'selected':''}># ${c.name}</option>`).join('')}</select>
                <label>رسالة الترحيب</label><textarea name="embedMessage" placeholder="استخدم {member} و {guild} و {count}">${s.welcome?.embedMessage || 'مرحباً بك {member} في سيرفر {guild}!'}</textarea>
                <label>رابط خلفية البطاقة</label><input type="url" name="imageUrl" value="${s.welcome?.imagePath || ''}" placeholder="https://example.com/image.png" style="direction:ltr;text-align:left">
                <div class="upload-note">ضع رابط صورة مباشر ثم اضغط حفظ.</div>
                <div class="upload-note">يجب أن يكون الرابط عامًا ومباشرًا ويبدأ بـ https://</div>
                <input type="hidden" name="avatarX" id="avatarX" value="${s.welcome?.avatarX || 50}"><input type="hidden" name="avatarY" id="avatarY" value="${s.welcome?.avatarY || 50}"><input type="hidden" name="avatarWidth" id="avatarWidth" value="${s.welcome?.avatarWidth || 150}"><input type="hidden" name="avatarHeight" id="avatarHeight" value="${s.welcome?.avatarHeight || 150}">
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

app.post('/generate/:guildId/welcome-random', checkAuth, checkDashboardOwner, checkBotGuildAccess, async (req, res) => {
    try {
        const filename = `welcome-generated-${req.params.guildId}-${Date.now()}-${Math.floor(Math.random() * 100000)}.png`;
        const absolutePath = path.join(__dirname, 'uploads', filename);
        createRandomWelcomeBackground(absolutePath);
        const imagePath = `data:image/png;base64,${fs.readFileSync(absolutePath).toString('base64')}`;
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

app.post('/save/:guildId/welcome', checkAuth, async (req, res) => {
    const b = req.body;
    const safeNumber = (value, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    };

    let updateData = {
        'welcome.enabled': b.enabled === 'on',
        'welcome.channel': b.channel || '',
        'welcome.embedMessage': b.embedMessage || 'مرحباً بك {member} في سيرفر {guild}!',
        'welcome.avatarX': safeNumber(b.avatarX, 50),
        'welcome.avatarY': safeNumber(b.avatarY, 50),
        'welcome.avatarWidth': safeNumber(b.avatarWidth, 150),
        'welcome.avatarHeight': safeNumber(b.avatarHeight, 150)
    };
    if (b.imageUrl?.trim()) updateData['welcome.imagePath'] = b.imageUrl.trim();
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: updateData }, { upsert: true });
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
            <label>الكلمات المحظورة (افصل بفاصلة)</label>
            <input type="text" name="badWords" value="${s.security?.badWords || ''}" placeholder="كلمة1, كلمة2, ...">
            <label>الإيموجيات المحظورة (افصل بفاصلة)</label>
            <input type="text" name="badEmojis" value="${s.security?.badEmojis || ''}" placeholder="إيموجي1, إيموجي2, ...">
            <label>رتب الاستثناء (لن تطبق عليهم الحماية)</label>
            ${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `
            <div style="display:flex; align-items:center; gap:10px; margin:6px 0;">
                <input type="checkbox" name="bypassRoles" value="${r.id}" id="bypass_${r.id}" ${s.security?.bypassRoles?.includes(r.id) ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--gold);">
                <label for="bypass_${r.id}" style="margin:0; color:var(--text); cursor:pointer;">${r.name}</label>
            </div>`).join('')}
            <button class="btn-save" style="margin-top:20px;">حفظ الإعدادات</button>
        </div>
    </form>`;

    res.send(ui(g, 'security', content));
});

app.post('/save/:guildId/security', checkAuth, async (req, res) => {
    const b = req.body;
    const bypassRoles = Array.isArray(b.bypassRoles) ? b.bypassRoles : (b.bypassRoles ? [b.bypassRoles] : []);
    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: { security: { antiLinks: b.antiLinks === 'on', badWords: b.badWords, badEmojis: b.badEmojis, bypassRoles } } },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/security`);
});

// --- [ Auto Reply ] ---
app.get('/manage/:guildId/autoreply', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { autoReply: [] };

    const rows = Array.from({ length: 15 }, (_, i) => `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; padding:14px; background:rgba(0,0,0,0.2); border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
        <input name="trigger_${i}" value="${s.autoReply?.[i]?.trigger || ''}" placeholder="الكلمة المحفزة ${i + 1}">
        <input name="reply_${i}" value="${s.autoReply?.[i]?.reply || ''}" placeholder="الرد التلقائي ${i + 1}">
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

app.post('/save/:guildId/autoreply', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const finalData = [];
        for (let i = 0; i < 15; i++) {
            const t = req.body[`trigger_${i}`]?.trim();
            const r = req.body[`reply_${i}`]?.trim();
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
                        ${g.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
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
                <span style="color:white; font-weight:700;">${gw.prize}</span>
                <span class="tag tag-blue" style="margin-right:10px;">${gw.participants?.length || 0} مشارك / ${gw.winnersCount} فائز</span>
            </div>
            <span style="color:var(--text-muted); font-size:13px;">ينتهي <t:${Math.floor(new Date(gw.endAt).getTime() / 1000)}:R></span>
        </div>`).join('')}
    </div>` : ''}`;

    res.send(ui(g, 'giveaway', content));
});

app.post('/save/:guildId/giveaway', checkAuth, upload.single('giveawayImage'), async (req, res) => {
    const { prize, duration, winners, channel, description } = req.body;
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.status(404).send('السيرفر غير موجود');
    const timeMs = ms(duration);
    if (!timeMs) return res.send('خطأ في صيغة الوقت! استخدم 1h أو 1d أو 30m');
    const endAt = new Date(Date.now() + timeMs);
    const targetCh = g.channels.cache.get(channel);
    if (!targetCh) return res.send('الروم غير موجود');

    const imagePath = req.file?.path || '';
    const imageName = imagePath ? path.basename(imagePath) : '';
    const embed = new EmbedBuilder()
        .setTitle(`قيف اواي: ${prize}`)
        .setDescription(`${description || 'لا يوجد وصف'}\n\nالمدة: <t:${Math.floor(endAt.getTime() / 1000)}:R>\nعدد الفائزين: ${winners}\nعدد المشاركين: 0`)
        .setColor(0xd4af37)
        .setFooter({ text: 'اضغط الزر بالأسفل للدخول' });
    const stableGiveawayUrl = imagePath ? publicUploadUrl(imagePath) : null;
    if (stableGiveawayUrl) embed.setImage(stableGiveawayUrl);
    else if (imageName) embed.setImage(`attachment://${imageName}`);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway_join_pending').setLabel('دخول القيف اواي').setStyle(ButtonStyle.Primary)
    );
    const files = imagePath && !stableGiveawayUrl ? [new AttachmentBuilder(imagePath, { name: imageName })] : [];
    const giveawayMsg = await targetCh.send({ embeds: [embed], components: [row], files });
    const giveaway = await Giveaway.create({ guildId: g.id, messageId: giveawayMsg.id, channelId: channel, endAt, winnersCount: parseInt(winners, 10), prize, description, imagePath, participants: [] });
    await giveawayMsg.edit({
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`giveaway_join:${giveaway._id}`).setLabel('دخول القيف اواي').setStyle(ButtonStyle.Primary)
        )],
        attachments: keepMessageAttachments(giveawayMsg)
    });
    res.redirect(`/manage/${g.id}/giveaway`);
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

async function finishGiveaway(giveaway) {
    const locked = await Giveaway.findOneAndUpdate(
        { _id: giveaway._id, ended: false, endAt: { $lte: new Date() } },
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
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const winnerIds = shuffled.slice(0, Math.min(locked.winnersCount, shuffled.length));
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
    await channel.send({ content: winnerIds.length ? `مبروك للفائزين في قيف اواي **${locked.prize}**: ${winnersText}` : `انتهى قيف اواي **${locked.prize}** بدون فائزين.` }).catch(() => {});
}

async function checkGiveaways() {
    const expired = await Giveaway.find({ ended: false, endAt: { $lte: new Date() } }).limit(25);
    for (const giveaway of expired) await finishGiveaway(giveaway).catch(err => console.error('[Giveaway Finish Error]', err));
}

setInterval(checkGiveaways, 1000);

// --- [ Tickets ] ---
app.get('/manage/:guildId/tickets', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await TicketConfig.findOne({ guildId: g.id }) || { buttons: [], menuOptions: [] };
    let topImg = s.topImagePath ? `/uploads/${path.basename(s.topImagePath)}` : 'https://placehold.co/110x110?text=Top';
    let bottomImg = s.bottomImagePath ? `/uploads/${path.basename(s.bottomImagePath)}` : 'https://placehold.co/110x110?text=Bottom';

    const content = `
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
                    <input name="title" value="${s.title || ''}" placeholder="عنوان نظام التذاكر">
                </div>
                <div>
                    <label>ملاحظة</label>
                    <div style="color:var(--text-muted); padding:10px 0;">يتم تحديد رتبة الإدارة والكاتيجوري بشكل مستقل لكل قسم بالأسفل.</div>
                </div>
            </div>
            <label>الوصف</label>
            <textarea name="description">${s.description || ''}</textarea>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:16px;">
                <div>
                    <div style="color:var(--gold); font-size:13px; font-weight:700; margin-bottom:10px;">الازرار (حتى 4)</div>
                    ${[0,1,2,3].map(i => `
                    <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px; margin-bottom:8px;">
                        <input name="btn_label_${i}" value="${s.buttons?.[i]?.label || ''}" placeholder="نص الزر ${i+1}">
                        <input name="btn_emoji_${i}" value="${s.buttons?.[i]?.emoji || ''}" placeholder="ID الإيموجي">
                        <select name="btn_role_${i}" style="grid-column:1/-1;"><option value="">-- رتبة هذا القسم --</option>${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `<option value="${r.id}" ${s.buttons?.[i]?.adminRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
                        <select name="btn_category_${i}" style="grid-column:1/-1;"><option value="">-- كاتيجوري هذا القسم --</option>${g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => `<option value="${c.id}" ${s.buttons?.[i]?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
                    </div>`).join('')}
                </div>
                <div>
                    <div style="color:var(--gold); font-size:13px; font-weight:700; margin-bottom:10px;">خيارات المنيو (حتى 4)</div>
                    ${[0,1,2,3].map(i => `
                    <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px; margin-bottom:8px;">
                        <input name="menu_label_${i}" value="${s.menuOptions?.[i]?.label || ''}" placeholder="خيار ${i+1}">
                        <input name="menu_emoji_${i}" value="${s.menuOptions?.[i]?.emoji || ''}" placeholder="ID الإيموجي">
                        <select name="menu_role_${i}" style="grid-column:1/-1;"><option value="">-- رتبة هذا القسم --</option>${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `<option value="${r.id}" ${s.menuOptions?.[i]?.adminRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
                        <select name="menu_category_${i}" style="grid-column:1/-1;"><option value="">-- كاتيجوري هذا القسم --</option>${g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => `<option value="${c.id}" ${s.menuOptions?.[i]?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
                    </div>`).join('')}
                </div>
            </div>

            <label style="margin-top:16px;">قناة الإرسال (اختياري)</label>
            <select name="targetChannel">
                <option value="">-- لا ترسل الآن --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
            </select>
            <button class="btn-save" style="margin-top:20px;">حفظ وإرسال</button>
        </div>
    </form>`;

    res.send(ui(g, 'tickets', content));
});

app.post('/save/:guildId/tickets', checkAuth, upload.fields([{ name: 'topImage' }, { name: 'bottomImage' }]), async (req, res) => {
    try {
        const b = req.body;
        const g = client.guilds.cache.get(req.params.guildId);
        if (!g) return res.status(404).send('Guild not found');

        let buttons = [], menuOptions = [];
        for (let i = 0; i < 4; i++) {
            const btnLabel = b[`btn_label_${i}`]?.trim();
            const btnEmoji = b[`btn_emoji_${i}`]?.trim();
            const menuLabel = b[`menu_label_${i}`]?.trim();
            const menuEmoji = b[`menu_emoji_${i}`]?.trim();
            if (btnLabel) buttons.push({ label: btnLabel, emoji: btnEmoji || '', adminRole: b[`btn_role_${i}`] || '', categoryId: b[`btn_category_${i}`] || '' });
            if (menuLabel) menuOptions.push({ label: menuLabel, emoji: menuEmoji || '', adminRole: b[`menu_role_${i}`] || '', categoryId: b[`menu_category_${i}`] || '' });
        }

        let updateData = { title: b.title, description: b.description, color: b.color || '#d4af37', buttons, menuOptions };
        if (req.files?.topImage?.[0]) updateData.topImagePath = req.files.topImage[0].path;
        if (req.files?.bottomImage?.[0]) updateData.bottomImagePath = req.files.bottomImage[0].path;

        const config = await TicketConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: updateData }, { upsert: true, new: true });

        if (b.targetChannel) {
            const channel = g.channels.cache.get(b.targetChannel);
            if (channel) {
                const files = [];
                const embed = new EmbedBuilder()
                    .setTitle(config.title || 'نظام التذاكر')
                    .setDescription(config.description || 'اضغط للفتح')
                    .setColor(parseInt((config.color || '#d4af37').replace('#', ''), 16));

                if (config.topImagePath && fs.existsSync(config.topImagePath)) {
                    const topName = path.basename(config.topImagePath);
                    files.push(new AttachmentBuilder(config.topImagePath, { name: topName }));
                    embed.setThumbnail(`attachment://${topName}`);
                }
                if (config.bottomImagePath && fs.existsSync(config.bottomImagePath)) {
                    const bottomName = path.basename(config.bottomImagePath);
                    files.push(new AttachmentBuilder(config.bottomImagePath, { name: bottomName }));
                    embed.setImage(`attachment://${bottomName}`);
                }

                const components = [];
                if (config.buttons?.length > 0) {
                    const btnRow = new ActionRowBuilder();
                    config.buttons.forEach((btn, i) => {
                        const button = new ButtonBuilder().setCustomId(`ticket_btn_${i}`).setLabel(btn.label).setStyle(ButtonStyle.Primary);
                        if (btn.emoji && btn.emoji.trim() !== '') {
                            const em = btn.emoji.trim();
                            try {
                                if (/^\d+$/.test(em)) button.setEmoji({ id: em });
                                else if (/^<a?:\w+:\d+>$/.test(em)) button.setEmoji(em);
                            } catch (e) {}
                        }
                        btnRow.addComponents(button);
                    });
                    if (btnRow.components.length > 0) components.push(btnRow);
                }
                if (config.menuOptions?.length > 0) {
                    const select = new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('اختر من القائمة...');
                    config.menuOptions.forEach((opt, i) => {
                        const option = { label: opt.label, value: `ticket_opt_${i}` };
                        if (opt.emoji && opt.emoji.trim() !== '') {
                            const em = opt.emoji.trim();
                            try { option.emoji = /^\d+$/.test(em) ? { id: em } : em; } catch (e) {}
                        }
                        select.addOptions(option);
                    });
                    components.push(new ActionRowBuilder().addComponents(select));
                }
                if (components.length === 0) {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setStyle(ButtonStyle.Primary)
                    ));
                }
                await channel.send({ embeds: [embed], components, files }).catch(e => console.error('[Ticket Send Error]', e));
            }
        }
        res.redirect(`/manage/${req.params.guildId}/tickets`);
    } catch (error) {
        console.error('[Ticket Save Error]', error);
        res.status(500).send('Internal Error');
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
            <input type="number" name="xpPerMessage" value="${s.levels?.xpPerMessage || 10}" min="1">
            <label>قناة رسائل الترقية</label>
            <select name="levelUpChannel">
                <option value="">-- نفس القناة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.levels?.levelUpChannel === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>
            <label>أمر قائمة المتصدرين</label>
            <input name="leaderboardCommand" value="${s.levels?.leaderboardCommand || '!levels'}" placeholder="!levels">
            <button class="btn-save" style="margin-top:20px;">حفظ الإعدادات</button>
        </div>
    </form>`;

    res.send(ui(g, 'levels', content));
});

app.post('/save/:guildId/levels', checkAuth, async (req, res) => {
    const b = req.body;
    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: { levels: { enabled: b.enabled === 'on', xpPerMessage: Number(b.xpPerMessage) || 10, levelUpChannel: b.levelUpChannel, leaderboardCommand: b.leaderboardCommand || '!levels' } } },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/levels`);
});

// --- [ Roles Panel ] ---
app.get('/manage/:guildId/roles', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { rolesPanel: [] };

    const content = `
    <div class="card">
        <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            لوحة الرتب الذاتية
        </h3>
        <form method="POST" action="/save/${g.id}/roles">
            <label>قناة إرسال اللوحة</label>
            <select name="rolesChannel">
                <option value="">-- اختر القناة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.rolesChannel === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>
            <div style="margin-top:20px;">
                <div style="color:var(--gold); font-size:13px; font-weight:700; margin-bottom:12px;">الرتب (حتى 10)</div>
                ${Array.from({ length: 10 }, (_, i) => `
                <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:10px;">
                    <select name="role_id_${i}">
                        <option value="">-- اختر رتبة --</option>
                        ${g.roles.cache.filter(r => r.name !== '@everyone').map(r =>
                            `<option value="${r.id}" ${s.rolesPanel?.[i]?.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
                        ).join('')}
                    </select>
                    <input name="role_label_${i}" value="${s.rolesPanel?.[i]?.label || ''}" placeholder="نص الزر ${i+1}">
                </div>`).join('')}
            </div>
            <button class="btn-save" style="margin-top:12px;">حفظ اللوحة</button>
        </form>
    </div>`;

    res.send(ui(g, 'roles', content));
});
app.post('/save/:guildId/roles', checkAuth, async (req, res) => {
    const b = req.body;
    const rolesPanel = [];
    for (let i = 0; i < 10; i++) {
        const roleId = b[`role_id_${i}`];
        const label = b[`role_label_${i}`]?.trim();
        if (roleId && label) rolesPanel.push({ roleId, label, type: 'button' });
    }
    
    const config = await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: { rolesPanel, rolesChannel: b.rolesChannel } },
        { upsert: true, new: true }
    );

    // إرسال اللوحة تلقائياً للروم
    const g = client.guilds.cache.get(req.params.guildId);
    if (g && b.rolesChannel && rolesPanel.length > 0) {
        const channel = g.channels.cache.get(b.rolesChannel);
        if (channel) {
            const rows = [];
            let row = new ActionRowBuilder();
            for (const r of rolesPanel) {
                row.addComponents(new ButtonBuilder().setCustomId(`role_${r.roleId}`).setLabel(r.label).setStyle(ButtonStyle.Secondary));
                if (row.components.length === 5) { rows.push(row); row = new ActionRowBuilder(); }
            }
            if (row.components.length > 0) rows.push(row);
            
            await channel.send({ 
                embeds: [new EmbedBuilder().setTitle('لوحة الرتب الذاتية').setDescription('اضغط على الزر للحصول على الرتبة أو إزالتها').setColor(0xd4af37)],
                components: rows 
            }).catch(() => {});
        }
    }

    res.redirect(`/manage/${req.params.guildId}/roles`);
});


// --- [ Mod / Jail Config ] ---
app.get('/manage/:guildId/mod', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await ModConfig.findOne({ guildId: g.id }) || { jail: {} };

    const content = `
    <form method="POST" action="/save/${g.id}/mod">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                إعدادات نظام السجن
            </h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
                عند سجن شخص، يتم سحب جميع رتبه تلقائياً ويُعطى رتبة السجن فقط، ولن يستطيع رؤية أي روم سوى روم السجن.
            </p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>أمر السجن</label>
                    <input name="jailCmd" value="${s.jail?.commandName || 'jail'}" placeholder="jail">
                </div>
                <div>
                    <label>أمر فك السجن</label>
                    <input name="unjailCmd" value="${s.jail?.unjailCommand || 'unjail'}" placeholder="unjail">
                </div>
            </div>
            <label>رتبة السجن</label>
            <select name="jailRole">
                <option value="">-- اختر رتبة السجن --</option>
                ${g.roles.cache.filter(r => r.name !== '@everyone').map(r =>
                    `<option value="${r.id}" ${s.jail?.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
                ).join('')}
            </select>
            <label>روم السجن (الروم الوحيد الذي يراه المسجون)</label>
            <select name="jailChannel">
                <option value="">-- اختر روم السجن --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.jail?.channelId === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>
            <button class="btn-save" style="margin-top:20px;">حفظ الإعدادات</button>
        </div>
    </form>`;

    res.send(ui(g, 'mod', content));
});

app.post('/save/:guildId/mod', checkAuth, async (req, res) => {
    await ModConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: {
            'jail.commandName': req.body.jailCmd || 'jail',
            'jail.unjailCommand': req.body.unjailCmd || 'unjail',
            'jail.roleId': req.body.jailRole,
            'jail.channelId': req.body.jailChannel
        }},
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/mod`);
});

// --- [ Iraqi Poetry ] ---
app.get('/manage/:guildId/poetry', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await PoetryConfig.findOne({ guildId: g.id }) || {};
    const totalPoems = await Poem.countDocuments();

    const content = `
    <form method="POST" action="/save/${g.id}/poetry">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                نظام الشعر العراقي
            </h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
                يقوم البوت بإرسال بيت شعر عراقي (باللهجة العراقية) بشكل دوري في الروم المحدد، بدون تكرار حتى تنتهي كل الأبيات المخزنة (يوجد حالياً <b style="color:var(--gold);">${totalPoems}</b> بيت في قاعدة البيانات).
            </p>
            <div class="toggle-row">
                <label style="color:white; margin:0;">تفعيل نظام الشعر</label>
                <input type="checkbox" name="enabled" ${s.enabled ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--gold); cursor:pointer;">
            </div>
            <label>روم إرسال الشعر</label>
            <select name="channelId" required>
                <option value="">-- اختر القناة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.channelId === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>
            <label>كل كم دقيقة يرسل بيت شعر جديد</label>
            <input type="number" name="intervalMinutes" min="1" max="1440" value="${s.intervalMinutes || 2}" placeholder="2">
            <label>رتبة يتم منشنها عند إرسال الشعر (اختياري)</label>
            <select name="roleId">
                <option value="">-- بدون منشن --</option>
                ${g.roles.cache.filter(r => r.name !== '@everyone').map(r =>
                    `<option value="${r.id}" ${s.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
                ).join('')}
            </select>
            <button class="btn-save" style="margin-top:20px;">حفظ إعدادات الشعر</button>
        </div>
    </form>`;

    res.send(ui(g, 'poetry', content));
});

app.post('/save/:guildId/poetry', checkAuth, async (req, res) => {
    const { guildId } = req.params;
    const b = req.body;
    const intervalMinutes = Math.min(1440, Math.max(1, parseInt(b.intervalMinutes) || 2));
    await PoetryConfig.findOneAndUpdate(
        { guildId },
        { $set: {
            enabled: b.enabled === 'on',
            channelId: b.channelId || '',
            intervalMinutes,
            roleId: b.roleId || ''
        }},
        { upsert: true }
    );
    res.redirect(`/manage/${guildId}/poetry`);
});



// --- [ Dashboard - Bulk Moderation ] ---
function parseExcludedIds(value) {
    return new Set(String(value || '').split(/[\s,؛،]+/).map(x => x.trim()).filter(x => /^\d{15,22}$/.test(x)));
}
function actionNotice(type, message) {
    const color = type === 'error' ? 'var(--red)' : 'var(--gold)';
    return `<div style="padding:13px 16px;border:1px solid ${color};border-radius:12px;background:rgba(244,194,76,.08);color:${color};margin-bottom:18px;font-weight:700;">${message}</div>`;
}
app.get('/manage/:guildId/massban', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId); if (!g) return res.redirect('/dashboard');
    const botMember = g.members.me || await g.members.fetch(client.user.id).catch(() => null);
    const canBan = !!botMember?.permissions.has(PermissionFlagsBits.BanMembers);
    const notice = req.query.notice ? actionNotice(req.query.type === 'error' ? 'error' : 'ok', String(req.query.notice).replace(/[<>"']/g, '')) : '';
    const content = `${notice}<div class="card"><h3>تبنيد عدد محدد من الأشخاص</h3><p style="color:var(--text-muted);font-size:13px;line-height:1.9;">اكتب العدد المطلوب. سيختار البوت أعضاءً يمكنه تبنيدهم فقط، ولن يتجاوز مالك السيرفر أو الأعضاء الأعلى من رتبة البوت أو الأعضاء الموجودين في قائمة الاستثناء.</p><div style="padding:12px 14px;border-radius:12px;border:1px solid ${canBan ? 'rgba(95,208,131,.35)' : 'rgba(225,77,67,.45)'};color:${canBan ? '#8de4a6' : 'var(--red)'};margin-bottom:18px;">${canBan ? 'صلاحية التبنيد متوفرة للبوت.' : 'البوت لا يملك صلاحية Ban Members.'}</div><form method="POST" action="/manage/${g.id}/massban" onsubmit="return confirm('سيتم تنفيذ التبنيد مباشرة. هل تريد المتابعة؟');"><label>عدد الأشخاص المطلوب تبنيدهم</label><input type="number" name="count" min="1" max="500" required placeholder="مثال: 10"><label>استثناءات (User IDs فقط، افصل بينها بفواصل أو أسطر)</label><textarea name="excludedIds" rows="5" placeholder="123456789012345678\n987654321098765432"></textarea><small style="display:block;color:var(--text-muted);margin-top:8px;">فعّل Developer Mode في Discord لنسخ User ID.</small><button class="btn-save" type="submit" style="margin-top:20px;" ${canBan ? '' : 'disabled'}>تم — ابدأ التبنيد</button></form></div>`;
    res.send(ui(g, 'massban', content));
});
app.post('/manage/:guildId/massban', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId); if (!g) return res.redirect('/dashboard');
    const count = Math.min(500, Math.max(1, Number.parseInt(req.body.count, 10) || 0));
    const excluded = parseExcludedIds(req.body.excludedIds);
    const botMember = g.members.me || await g.members.fetch(client.user.id).catch(() => null);
    if (!count || !botMember?.permissions.has(PermissionFlagsBits.BanMembers)) return res.redirect(`/manage/${g.id}/massban?type=error&notice=${encodeURIComponent('العدد غير صالح أو صلاحية التبنيد غير متوفرة.')}`);
    try {
        const members = await g.members.fetch();
        const candidates = [...members.values()].filter(member => !member.user.bot && member.id !== g.ownerId && !excluded.has(member.id) && member.bannable && botMember.roles.highest.comparePositionTo(member.roles.highest) > 0).slice(0, count);
        let banned = 0;
        for (const member of candidates) if (await member.ban({ reason: `تبنيد جماعي من لوحة التحكم بواسطة ${req.user.username || req.user.id}` }).then(() => true).catch(() => false)) banned++;
        return res.redirect(`/manage/${g.id}/massban?type=${banned ? 'ok' : 'error'}&notice=${encodeURIComponent(`تم تبنيد ${banned} من أصل ${count}. تم تجاوز ${count - banned} بسبب الرتبة أو الاستثناءات أو عدم إمكانية التبنيد.`)}`);
    } catch (err) { console.error('[Mass Ban Error]', err); return res.redirect(`/manage/${g.id}/massban?type=error&notice=${encodeURIComponent('حدث خطأ أثناء تنفيذ التبنيد.')}`); }
});
app.get('/manage/:guildId/channelswipe', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId); if (!g) return res.redirect('/dashboard');
    const botMember = g.members.me || await g.members.fetch(client.user.id).catch(() => null);
    const canManage = !!botMember?.permissions.has(PermissionFlagsBits.ManageChannels);
    const notice = req.query.notice ? actionNotice(req.query.type === 'error' ? 'error' : 'ok', String(req.query.notice).replace(/[<>"']/g, '')) : '';
    const content = `${notice}<div class="card"><h3>حذف جميع الرومات</h3><p style="color:var(--text-muted);font-size:13px;line-height:1.9;">هذا الإجراء يحذف كل القنوات والتصنيفات نهائيًا ولا يمكن التراجع عنه. لن يبدأ التنفيذ إلا بعد كتابة عبارة التأكيد حرفيًا.</p><div style="padding:14px;border:1px solid rgba(225,77,67,.5);border-radius:12px;background:rgba(225,77,67,.1);color:#ffaaa3;margin-bottom:18px;font-weight:700;">تحذير: سيتم حذف ${g.channels.cache.size} رومًا/تصنيفًا.</div><form method="POST" action="/manage/${g.id}/channelswipe" onsubmit="return confirm('تحذير أخير: حذف جميع الرومات نهائي. هل تريد المتابعة؟');"><label>اكتب: حذف كل الرومات</label><input name="confirmation" required autocomplete="off" placeholder="حذف كل الرومات"><button class="btn-save" type="submit" style="margin-top:20px;background:linear-gradient(100deg,#e14d43,#a5221d);" ${canManage ? '' : 'disabled'}>تم — احذف جميع الرومات</button></form></div>`;
    res.send(ui(g, 'channelswipe', content));
});
app.post('/manage/:guildId/channelswipe', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId); if (!g) return res.redirect('/dashboard');
    const botMember = g.members.me || await g.members.fetch(client.user.id).catch(() => null);
    if (req.body.confirmation !== 'حذف كل الرومات') return res.redirect(`/manage/${g.id}/channelswipe?type=error&notice=${encodeURIComponent('عبارة التأكيد غير صحيحة، لم يتم حذف أي روم.')}`);
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) return res.redirect(`/manage/${g.id}/channelswipe?type=error&notice=${encodeURIComponent('البوت لا يملك صلاحية Manage Channels.')}`);
    try {
        const channels = [...g.channels.cache.values()].sort((a, b) => (a.type === ChannelType.GuildCategory ? 1 : 0) - (b.type === ChannelType.GuildCategory ? 1 : 0));
        let deleted = 0;
        for (const channel of channels) if (await channel.delete('حذف جماعي من لوحة التحكم').then(() => true).catch(() => false)) deleted++;
        return res.redirect(`/manage/${g.id}/channelswipe?type=${deleted ? 'ok' : 'error'}&notice=${encodeURIComponent(`تم حذف ${deleted} من أصل ${channels.length} قناة/تصنيف.`)}`);
    } catch (err) { console.error('[Delete All Channels Error]', err); return res.redirect(`/manage/${g.id}/channelswipe?type=error&notice=${encodeURIComponent('حدث خطأ أثناء حذف الرومات.')}`); }
});

// ==========================================
// 10. Discord Event Handlers
// ==========================================

client.on('messageCreate', async (msg) => {if (!msg.guild || msg.author.bot) return;

    // --- [ نظام اختصارات الأوامر الإدارية المطور ] ---
    try {
        let adminCfg = await AdminCmdConfig.findOne({ guildId: msg.guild.id });
        const defaultConfig = {
            adminRoles: [],
            settings: {
                lock: { shortcut: '-ق', delUser: false, delBot: false },
                unlock: { shortcut: '-ف', delUser: false, delBot: false },
                timeout: { shortcut: '-ت', delUser: false, delBot: false },
                untimeout: { shortcut: '-فت', delUser: false, delBot: false },
                ban: { shortcut: '-ب', delUser: false, delBot: false },
                unban: { shortcut: '-فب', delUser: false, delBot: false },
                kick: { shortcut: '-ك', delUser: false, delBot: false }
            }
        };
        const config = adminCfg || defaultConfig;
        const args = msg.content.trim().split(/ +/);
        const cmdText = args[0];
        const entry = Object.entries(config.settings).find(([k, v]) => v.shortcut === cmdText);
        if (entry) {
            const [actionKey, settings] = entry;
            const hasPerm = msg.member.permissions.has(PermissionFlagsBits.Administrator) || 
                            msg.member.roles.cache.some(r => config.adminRoles.includes(r.id));
            if (hasPerm) {
                const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[1]);
                let resultMsg = null;
                if (settings.delUser) await msg.delete().catch(() => {});
                if (actionKey === 'lock') {
                    await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false });
                    resultMsg = await msg.channel.send('🔒 تم قفل الشات بنجاح.');
                } else if (actionKey === 'unlock') {
                    await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: null });
                    resultMsg = await msg.channel.send('🔓 تم فتح الشات بنجاح.');
                } else if (actionKey === 'timeout' && target) {
                    const mins = parseInt(args[2]) || 60;
                    await target.timeout(mins * 60 * 1000).catch(() => {});
                    resultMsg = await msg.channel.send(`⏳ تم إعطاء تايم أوت لـ ${target.user.username} لمدة ${mins} دقيقة.`);
                } else if (actionKey === 'untimeout' && target) {
                    await target.timeout(null).catch(() => {});
                    resultMsg = await msg.channel.send(`✅ تم فك التايم أوت عن ${target.user.username}.`);
                } else if (actionKey === 'ban' && target) {
                    await target.ban().catch(() => {});
                    resultMsg = await msg.channel.send(`🔨 تم حظر ${target.user.username} بنجاح.`);
                } else if (actionKey === 'unban' && args[1]) {
                    await msg.guild.members.unban(args[1]).catch(() => {});
                    resultMsg = await msg.channel.send(`✅ تم فك الحظر عن العضو بنجاح.`);
                } else if (actionKey === 'kick' && target) {
                    await target.kick().catch(() => {});
                    resultMsg = await msg.channel.send(`👢 تم طرد ${target.user.username} بنجاح.`);
                }
                if (resultMsg && settings.delBot) { setTimeout(() => resultMsg.delete().catch(() => {}), 5000); }
                return;
            }
        }
    } catch (e) {}


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
                    .setFooter({ text: 'VORTEX  - Suggestions' })
                    .setTimestamp()
                    .addFields(
                        { name: getEmojiDisplay(msg.guild, sugCfg.emoji1), value: '0', inline: true },
                        { name: getEmojiDisplay(msg.guild, sugCfg.emoji2), value: '0', inline: true }
                    );

                
                const files = [];
                const dashboardUrl = process.env.RENDER_EXTERNAL_URL || '';
                if (attachmentImg) {
                    embed.setImage(attachmentImg.url);
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

                const sentMsg = await msg.channel.send({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(menu)],
                    files
                });

                await Suggestion.create({
                    guildId: msg.guild.id,
                    messageId: sentMsg.id,
                    channelId: msg.channel.id,
                    authorId: msg.author.id,
                    content: content || ''
                });

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


    // --- [ جلب بيانات العضو ] ---
    let u = await UserLevel.findOne({ guildId: msg.guild.id, userId: msg.author.id });
    if (!u) u = new UserLevel({ guildId: msg.guild.id, userId: msg.author.id });

    // --- [ إحصائيات الرسائل ] ---
    await Stats.findOneAndUpdate(
        { guildId: msg.guild.id },
        { $inc: {
            'messages.total': 1,
            'messages.daily': 1,
            'messages.weekly': 1,
            'messages.monthly': 1,
            [`activeChannels.${msg.channel.id}`]: 1
        }},
        { upsert: true }
    ).catch(() => {});

    // --- [ نظام الحماية ] ---
    const hasBypass = msg.member.roles.cache.some(role => s.security?.bypassRoles?.includes(role.id));
    if (!hasBypass) {
        if (s.security?.badWords && s.security.badWords.trim().length > 0) {
            const forbiddenWords = s.security.badWords.split(',').map(w => w.trim()).filter(Boolean);
            const hasBadWord = forbiddenWords.some(word => {
                try {
                    const regex = new RegExp(`(?<=^|[^أ-يa-zA-Z0-9])${word}(?=[^أ-يa-zA-Z0-9]|$)`, 'iu');
                    return regex.test(msg.content);
                } catch { return msg.content.includes(word); }
            });
            if (hasBadWord) {
                await msg.delete().catch(() => {});
                return msg.channel.send(`${msg.author}، ممنوع استخدام هذه الكلمة!`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        if (s.security?.badEmojis && s.security.badEmojis.trim().length > 0) {
            const forbiddenEmojis = s.security.badEmojis.split(',').map(e => e.trim()).filter(Boolean);
            const hasBadEmoji = forbiddenEmojis.some(emoji => msg.content.includes(emoji));
            if (hasBadEmoji) {
                await msg.delete().catch(() => {});
                return msg.channel.send(`${msg.author}، هذا الإيموجي ممنوع!`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        if (s.security?.antiLinks && /(https?:\/\/)/.test(msg.content)) {
            await msg.delete().catch(() => {});
            return msg.channel.send(`${msg.author}، الروابط ممنوعة هنا!`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        }
    }

    // --- [ أمر !rolespanel ] ---
    if (msg.content === '!rolespanel') {
        const config = await GuildConfig.findOne({ guildId: msg.guild.id });
        if (!config?.rolesPanel?.length) return msg.reply('ما في رتب مضافة');
        const channel = msg.guild.channels.cache.get(config.rolesChannel);
        if (!channel) return msg.reply('الروم غير موجود');

        const rows = [];
        let row = new ActionRowBuilder();
        for (const r of config.rolesPanel) {
            if (r.type === 'button') {
                row.addComponents(new ButtonBuilder().setCustomId(`role_${r.roleId}`).setLabel(r.label).setStyle(ButtonStyle.Secondary));
            }
            if (row.components.length === 5) { rows.push(row); row = new ActionRowBuilder(); }
        }
        if (row.components.length > 0) rows.push(row);
        channel.send({ content: 'نظام الرتب', components: rows });
        msg.reply('تم إرسال لوحة الرتب');
    }

    // --- [ الرد الآلي ] ---
    const r = s.autoReply?.find(x => x.trigger && msg.content.toLowerCase() === x.trigger.toLowerCase());
    if (r) return msg.reply(r.reply).catch(() => {});

    // --- [ نظام المستويات ] ---
    if (s.levels?.enabled) {
        u.xp += s.levels.xpPerMessage || 10;
        u.msgCount++;
        if (u.xp >= u.level * u.level * 100) {
            u.level++;
            const lvChannel = msg.guild.channels.cache.get(s.levels.levelUpChannel) || msg.channel;
            lvChannel.send(`مبروك ${msg.author}! وصلت للمستوى **${u.level}**`).catch(() => {});
        }
        await u.save();
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
                const button = new ButtonBuilder().setCustomId(`ticket_btn_${i}`).setLabel(btn.label).setStyle(ButtonStyle.Primary);
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
                const option = { label: opt.label, value: `ticket_opt_${i}` };
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

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'aboud-profile.png' });
        msg.reply({ files: [attachment] });
    }

    // --- [ نظام السجن ] ---
    const modConfig = await ModConfig.findOne({ guildId: msg.guild.id });
    if (modConfig && modConfig.jail && msg.content.startsWith('!')) {
        const prefix = '!';
        const args = msg.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // أمر السجن
        if (command === modConfig.jail.commandName.toLowerCase()) {
            const isAdmin = msg.member.permissions.has(PermissionFlagsBits.Administrator);
            const hasAdminRole = modConfig.jail.adminRoles?.some(rId => msg.member.roles.cache.has(rId));
            if (!isAdmin && !hasAdminRole) return msg.reply('عذراً، هذا الأمر مخصص للإدارة فقط!');

            const target = msg.mentions.members.first();
            const timeInput = args.find(arg => /\d+[smhdw]/.test(arg));

            if (!target || !timeInput) return msg.reply(`الاستخدام الصحيح: \`!${command} @user 1h\``);
            if (target.id === msg.author.id) return msg.reply('لا يمكنك سجن نفسك!');
            if (target.user.bot) return msg.reply('لا يمكنك سجن البوتات!');

            if (msg.author.id !== msg.guild.ownerId) {
                if (target.roles.highest.position >= msg.member.roles.highest.position) {
                    return msg.reply('لا يمكنك سجن شخص رتبته أعلى منك أو مساوية لرتبتك!');
                }
            }

            const durationMs = ms(timeInput);
            if (!durationMs) return msg.reply('صيغة الوقت غير صحيحة (مثال: 10m, 1h, 1d)');

            const jailRole = msg.guild.roles.cache.get(modConfig.jail.roleId);
            if (!jailRole) return msg.reply('رتبة السجن غير مضبوطة في الداشبورد!');

            try {
                const currentRoles = target.roles.cache.filter(r => r.id !== msg.guild.id).map(r => r.id);
                await JailData.findOneAndUpdate(
                    { guildId: msg.guild.id, userId: target.id },
                    { oldRoles: currentRoles, endAt: new Date(Date.now() + durationMs) },
                    { upsert: true }
                );

                // سحب كل الرتب وإعطاء رتبة السجن فقط
                await target.roles.set([jailRole.id]).catch(() => {
                    return msg.reply('فشل سحب الرتب، تأكد أن رتبة البوت أعلى من رتبة العضو.');
                });

                // إخفاء كل الرومات عن المسجون (تلقائي عبر رتبة السجن)
                // يجب أن تكون رتبة السجن تمنع ViewChannel في كل الرومات
                const jailChannel = msg.guild.channels.cache.get(modConfig.jail.channelId);
                if (jailChannel) {
                    // السماح للمسجون برؤية روم السجن فقط
                    await jailChannel.permissionOverwrites.edit(target.id, {
                        ViewChannel: true,
                        SendMessages: true
                    }).catch(() => {});
                }

                const embed = new EmbedBuilder()
                    .setTitle('تم السجن')
                    .setDescription(`تم سجن ${target} لمدة **${timeInput}**`)
                    .setColor(0xe63946)
                    .addFields(
                        { name: 'العضو', value: `${target}`, inline: true },
                        { name: 'بواسطة', value: `${msg.author}`, inline: true },
                        { name: 'المدة', value: timeInput, inline: true }
                    )
                    .setTimestamp();

                msg.channel.send({ embeds: [embed] });
                setTimeout(async () => { await handleUnjail(target, msg.guild.id); }, durationMs);
            } catch (e) {
                console.error('[Jail Error]', e);
                msg.reply('حدث خطأ فني أثناء محاولة السجن.');
            }
        }

        // أمر فك السجن
        if (command === (modConfig.jail.unjailCommand || 'unjail').toLowerCase()) {
            const isAdmin = msg.member.permissions.has(PermissionFlagsBits.Administrator);
            const hasAdminRole = modConfig.jail.adminRoles?.some(rId => msg.member.roles.cache.has(rId));
            if (!isAdmin && !hasAdminRole) return msg.reply('عذراً، لا تملك صلاحيات لفك السجن!');

            const target = msg.mentions.members.first();
            if (!target) return msg.reply('يرجى منشن العضو لفك سجنه!');
            await handleUnjail(target, msg.guild.id);

            const embed = new EmbedBuilder()
                .setTitle('فك السجن')
                .setDescription(`تم فك سجن ${target} واسترجاع رتبه كاملة.`)
                .setColor(0x00c853)
                .setTimestamp();
            msg.channel.send({ embeds: [embed] });
        }
    }

});

// --- [ تصويت الاقتراحات ] ---
async function updateSuggestionVotes(reaction, user, isAdd) {
    try {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});
        const message = reaction.message;
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

        if (isAdd) {
            if (!suggestion[field].includes(user.id)) suggestion[field].push(user.id);
            suggestion[otherField] = suggestion[otherField].filter(id => id !== user.id);
        } else {
            suggestion[field] = suggestion[field].filter(id => id !== user.id);
        }
        await suggestion.save();

        const embed = EmbedBuilder.from(message.embeds[0]);
        embed.setFields(
            { name: getEmojiDisplay(message.guild, sugCfg.emoji1), value: `${suggestion.votes1.length}`, inline: true },
            { name: getEmojiDisplay(message.guild, sugCfg.emoji2), value: `${suggestion.votes2.length}`, inline: true }
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
        // إحصائيات
        await Stats.findOneAndUpdate(
            { guildId: member.guild.id },
            { $push: { 'membersLog.joined': new Date() } },
            { upsert: true }
        ).catch(() => {});

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
            .setFooter({ text: `VORTEX  - العضو رقم ${member.guild.memberCount}`, iconURL: member.guild.iconURL() });

        try {
            const canvas = createCanvas(800, 400);
            const ctx = canvas.getContext('2d');

            let bgUrl = config.welcome.imagePath;
if (!bgUrl) bgUrl = 'https://placehold.co/800x400/050510/1e90ff?text=Welcome';
if (!bgUrl.startsWith('http' )) bgUrl = `${process.env.BASE_URL || 'http://localhost:3000'}${bgUrl}`;
const background = await loadImage(bgUrl ).catch(() => loadImage('https://placehold.co/800x400/050510/1e90ff?text=Welcome' ));

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
    await Stats.findOneAndUpdate({ guildId: member.guild.id }, { $push: { 'membersLog.left': new Date() } }, { upsert: true }).catch(() => {});
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
        if (!interaction.guild) return;

        // --- [ Giveaway Join Button ] ---
        if (interaction.isButton() && interaction.customId.startsWith('giveaway_join:')) {
            const giveawayId = interaction.customId.split(':')[1];
            const giveaway = await Giveaway.findOne({ _id: giveawayId, guildId: interaction.guild.id, ended: false });
            if (!giveaway) return interaction.reply({ content: 'هذا القيف اواي انتهى أو لم يعد موجودًا.', ephemeral: true });
            if (new Date(giveaway.endAt).getTime() <= Date.now()) return interaction.reply({ content: 'انتهت مدة القيف اواي.', ephemeral: true });
            const alreadyJoined = giveaway.participants.includes(interaction.user.id);
            if (!alreadyJoined) {
                giveaway.participants.push(interaction.user.id);
                await giveaway.save();
                await refreshGiveawayMessage(giveaway, interaction.message);
                return interaction.reply({ content: 'تم تسجيل دخولك في القيف اواي بنجاح.', ephemeral: true });
            }
            return interaction.reply({ content: 'أنت داخل القيف اواي مسبقًا.', ephemeral: true });
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
                if (member && !member.bannable) return interaction.reply({ content: 'لا يمكنني حظر هذا العضو (رتبته أعلى مني).', ephemeral: true });
                await interaction.guild.members.ban(target.id, { reason }).catch(() => {});
                const embed = new EmbedBuilder().setTitle('تم الحظر').setColor(0xe63946)
                    .addFields({ name: 'العضو', value: `${target.tag}`, inline: true }, { name: 'بواسطة', value: `${interaction.user}`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'unban') {
                const id = interaction.options.getString('id');
                const reason = interaction.options.getString('reason') || 'بدون سبب';
                await interaction.guild.members.unban(id, reason).catch(() => {
                    return interaction.reply({ content: 'تعذر فك الحظر، تأكد من صحة الـ ID.', ephemeral: true });
                });
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
                if (!member.kickable) return interaction.reply({ content: 'لا يمكنني طرد هذا العضو (رتبته أعلى مني).', ephemeral: true });
                await member.kick(reason).catch(() => {});
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
                if (!member.moderatable) return interaction.reply({ content: 'لا يمكنني كتم هذا العضو (رتبته أعلى مني).', ephemeral: true });
                await member.timeout(minutes * 60 * 1000, reason).catch(() => {});
                const embed = new EmbedBuilder().setTitle('تم الكتم (Timeout)').setColor(0xffac33)
                    .addFields({ name: 'العضو', value: `${target}`, inline: true }, { name: 'المدة', value: `${minutes} دقيقة`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'untimeout') {
                const target = interaction.options.getUser('user');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                await member.timeout(null).catch(() => {});
                return interaction.reply({ content: `تم فك الكتم عن ${target}.` });
            }

            if (interaction.commandName === 'warn') {
                const target = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason');
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
                await Warn.deleteMany({ guildId: interaction.guild.id, userId: target.id });
                return interaction.reply({ content: `تم مسح جميع تحذيرات ${target}.` });
            }

            if (interaction.commandName === 'purge') {
                const amount = interaction.options.getInteger('amount');
                if (amount < 1 || amount > 100) return interaction.reply({ content: 'العدد يجب أن يكون بين 1 و 100.', ephemeral: true });
                const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
                return interaction.reply({ content: `تم حذف ${deleted?.size || 0} رسالة.`, ephemeral: true });
            }

            if (interaction.commandName === 'lock') {
                await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }).catch(() => {});
                return interaction.reply({ content: '🔒 تم قفل الروم.' });
            }

            if (interaction.commandName === 'unlock') {
                await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null }).catch(() => {});
                return interaction.reply({ content: '🔓 تم فتح الروم.' });
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
                await member.setNickname(newName || null).catch(() => {});
                return interaction.reply({ content: newName ? `تم تغيير اسم ${target} إلى **${newName}**.` : `تم إرجاع اسم ${target} الأصلي.` });
            }

            if (interaction.commandName === 'addrole') {
                const target = interaction.options.getUser('user');
                const role = interaction.options.getRole('role');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                await member.roles.add(role).catch(() => {});
                return interaction.reply({ content: `تم إعطاء رتبة **${role.name}** لـ ${target}.` });
            }

            if (interaction.commandName === 'removerole') {
                const target = interaction.options.getUser('user');
                const role = interaction.options.getRole('role');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                await member.roles.remove(role).catch(() => {});
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
                    .setFooter({ text: `VORTEX  - إعلان رسمي بواسطة ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();
                if (image) embed.setImage(image.url);

                await channel.send({ content: role ? `${role}` : undefined, embeds: [embed] }).catch(() => {
                    return interaction.reply({ content: 'تعذر إرسال الإعلان بهذا الروم.', ephemeral: true });
                });
                return interaction.reply({ content: `تم نشر الإعلان في ${channel}.`, ephemeral: true });
            }

            if (interaction.commandName === 'say') {
                const text = interaction.options.getString('text');
                const channel = interaction.options.getChannel('channel') || interaction.channel;
                await channel.send({ content: text }).catch(() => {});
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
                    .setFooter({ text: 'VORTEX ' })
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
            if (!member?.bannable) return reply('لا يمكنني تنفيذ الحظر على هذا العضو.', true);
            await member.ban({ deleteMessageSeconds: 86400, reason });
            await interaction.guild.members.unban(user.id, 'Softban مكتمل').catch(() => {});
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
            const value = command === 'lockserver' ? false : null; let count = 0;
            for (const channel of interaction.guild.channels.cache.values()) if (channel.isTextBased() && channel.permissionOverwrites) { await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: value }).catch(() => {}); count++; }
            return reply(`${command === 'lockserver' ? 'تم قفل' : 'تم فتح'} ${count} قناة.`);
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

        // --- [ Self Roles ] ---
        if (interaction.isButton() && interaction.customId.startsWith('role_')) {
            try {
                const roleId = interaction.customId.replace('role_', '');
                const role = interaction.guild.roles.cache.get(roleId);
                if (!role) return interaction.reply({ content: 'الرتبة غير موجودة.', ephemeral: true });

                const guildData = await GuildConfig.findOne({ guildId: interaction.guild.id });
                const allPanelRoles = (guildData?.rolesPanel || []).map(r => r.roleId);

                if (interaction.member.roles.cache.has(roleId)) {
                    await interaction.member.roles.remove(roleId).catch(() => {});
                    return interaction.reply({ content: `تم سحب رتبة **${role.name}** منك.`, ephemeral: true });
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.reply({ content: 'رتبة البوت أقل من الرتبة المطلوبة.', ephemeral: true });
                }

                if (allPanelRoles.length > 0) {
                    const rolesToRemove = interaction.member.roles.cache.filter(r => allPanelRoles.includes(r.id));
                    if (rolesToRemove.size > 0) await interaction.member.roles.remove(rolesToRemove).catch(() => {});
                }

                await interaction.member.roles.add(roleId);
                return interaction.reply({ content: `تم إعطاؤك رتبة **${role.name}**.`, ephemeral: true });
            } catch (err) {
                console.error('[Role Error]', err);
                if (!interaction.replied) interaction.reply({ content: 'حدث خطأ، جرب مرة أخرى.', ephemeral: true });
            }
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

        // --- [ Ticket Control Menu ] ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_control_menu') {
            const selected = interaction.values[0];
            const ticketData = await TicketData.findOne({ channelId: interaction.channelId });
            if (!ticketData) return interaction.reply({ content: 'لم يتم العثور على بيانات التكت.', ephemeral: true });

            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            const adminRole = ticketData.adminRole;
            const isAdmin = Boolean(adminRole && interaction.member.roles.cache.has(adminRole));
            const isOwner = ticketData.ownerId === interaction.user.id;

            if (selected === 'claim_ticket') {
                if (!isAdmin) return interaction.reply({ content: 'فقط الإدارة يمكنهم استلام التكت.', ephemeral: true });
                ticketData.claimedBy = interaction.user.id;
                await ticketData.save();
                return interaction.reply({ content: `تم استلام التكت بواسطة ${interaction.user}.`, ephemeral: false });
            }

            if (selected === 'close_ticket') {
                if (!isAdmin && !isOwner) return interaction.reply({ content: 'ليس لديك صلاحية لإغلاق التكت.', ephemeral: true });
                ticketData.closedAt = new Date();
                ticketData.closedBy = interaction.user.id;
                await ticketData.save();
                await interaction.reply({ content: 'سيتم حذف التكت خلال 5 ثوان...', ephemeral: false });
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
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
    const optIndex = parseInt(selected.replace('ticket_opt_', ''));
    let ticketType = 'تذكرة دعم';
    const sectionConfig = tConfig.menuOptions?.[optIndex] || {};
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
        console.error('[Interaction Error]', err);
    }
});


// ==========================================
// 13. Helper Functions
// ==========================================

async function openTicket(interaction, tConfig, ticketType, sectionConfig = {}) {
    try {
        const existingTicket = await TicketData.findOne({ guildId: interaction.guild.id, ownerId: interaction.user.id, closedAt: null });
        if (existingTicket) {
            return interaction.reply({ content: `لديك تكت مفتوح بالفعل: <#${existingTicket.channelId}>`, ephemeral: true });
        }

        const ticketCount = await TicketData.countDocuments({ guildId: interaction.guild.id }) + 1;
        const channelName = `ticket-${ticketCount}-${interaction.user.username}`.substring(0, 100);

        const permOverwrites = [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ];
        if (sectionConfig.adminRole) {
            permOverwrites.push({ id: sectionConfig.adminRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] });
        }

        const channelOptions = {
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: permOverwrites
        };
        if (sectionConfig.categoryId) channelOptions.parent = sectionConfig.categoryId;

        const ticketChannel = await interaction.guild.channels.create(channelOptions).catch(() => null);

        if (!ticketChannel) return interaction.reply({ content: 'فشل إنشاء قناة التكت.', ephemeral: true });

        const ticketDoc = await TicketData.create({
            guildId: interaction.guild.id,
            channelId: ticketChannel.id,
            ownerId: interaction.user.id,
            ticketType,
            adminRole: sectionConfig.adminRole || '',
            categoryId: sectionConfig.categoryId || '',
            openedAt: new Date()
        });

        const files = [];
        const embed = new EmbedBuilder()
            .setTitle(`تكت ${ticketType} | #${ticketCount}`)
            .setDescription(`مرحباً ${interaction.user}!\n\nالإدارة ستتواصل معك قريباً. يرجى شرح مشكلتك بالتفصيل.`)
            .setColor(0xd4af37)
            .addFields(
                { name: 'صاحب التكت', value: `${interaction.user}`, inline: true },
                { name: 'النوع', value: ticketType, inline: true }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: 'VORTEX  - Tickets' });

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

        const controlMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_control_menu')
            .setPlaceholder('لوحة التحكم بالتكت')
            .addOptions([
                { label: 'استلام التكت', value: 'claim_ticket', description: 'استلام التكت للمعالجة' },
                { label: 'اغلاق التكت', value: 'close_ticket', description: 'اغلاق وحذف التكت' },
                { label: 'اضافة شخص', value: 'add_member', description: 'اضافة شخص للتكت' },
                { label: 'ازالة شخص', value: 'remove_member', description: 'ازالة شخص من التكت' },
                { label: 'استدعاء صاحب التكت', value: 'summon_member', description: 'منشن صاحب التكت' }
            ]);

        await ticketChannel.send({
            content: `${interaction.user} ${sectionConfig.adminRole ? `<@&${sectionConfig.adminRole}>` : ''}`,
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(controlMenu)],
            files
        }).catch(e => console.error('[Ticket Channel Send Error]', e));

        return interaction.reply({ content: `تم فتح تكتك: ${ticketChannel}`, ephemeral: true });
    } catch (err) {
        console.error('[Ticket Error]', err);
        return interaction.reply({ content: 'حدث خطأ عند فتح التكت.', ephemeral: true });
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
        const headers = { Accept: 'application/json', 'User-Agent': 'VORTEX-Bot/2.0' };
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
// 14.5 Iraqi Poetry System (شعر عراقي دوري)
// ==========================================

const Poem = mongoose.model('Poem', new mongoose.Schema({
    text: { type: String, required: true, unique: true },
    meaning: { type: String, default: 'يحچي عن إحساس صادق ومشاعر من القلب.' }
}));

const PoetryConfig = mongoose.model('PoetryConfig', new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    channelId: String,
    roleId: String,
    intervalMinutes: { type: Number, default: 2 },
    lastSentAt: Date,
    // طابور مخلوط من الـ ObjectId الخاصة بالأبيات المتبقية قبل إعادة التدوير، لضمان عدم تكرار أي بيت قبل ما تخلص كل الأبيات
    queue: [{ type: mongoose.Schema.Types.ObjectId }]
}));

// أبيات شعر عراقي قصيرة، من تأليف أصلي بأسلوب الشعر الشعبي العراقي (دارمي/أبوذية/حكم) - مو منسوخة من أي مصدر
const IRAQI_POEMS_SEED = [
"يا كل ما جيت أحجيلك تعب اللسان\nوتبقه الروح تدور الك أمان",
"سؤال الك ياكلبي شنو الدوه\nيريد الصبر ما بيه اشوفه",
"دربنه طويل وياريت نوصل\nولو تعبت الروح ما ننكسر",
"الفرگه صعبه بس الذكرى أصعب\nتبقه تدور بيك وياك تهرب",
"شفتك من بعيد وحسيت گلبي\nيرجف مثل ريشه بيها الهوه",
"چم مره گلت اسكت وما گدرت\nلأن الحچي يفضح اللي مخبيه",
"عيوني تدور دربك بكل مكان\nولو غبت ساعة تحسبها زمان",
"ما اريد غيرك ولا غيرك أريد\nوروحي بيك تحلم وتعيد",
"صبرت وصبري صار مثل الجبل\nبس گلبي ما زال يحبك ويحل",
"يا طيرالبيك اطير وياه\nخذ سلامي واحچيله اشتياگه",
"الدنيه دوارة وحنه بيها ضيوف\nنعيش يومين وناخذ الحلوف",
"گلبي صغير بس همومه چبار\nيتحمل الجرح وما يبين آثار",
"مو كل اللي يبتسم يكون مرتاح\nبعضهم يبچي بداخله وياه سلاح",
"العمر مايوگف على حالة\nيمشي ويمشي وياخذ رجالة",
"لو تسال الگلب شلون حاله\nيگلك تعبان بس ما يبين حاله",
"ما يفهم الحزن الا اللي ذاگه\nوما يعرف الفرح الا اللي باگه",
"صديج زين يسوه ألف قريب\nويبقه وياك بالفرح والنصيب",
"الصدگ صعب بزمن الكذب سهل\nبس اللي يصدگ يبقه بالمحل",
"چم ندمت على كلمة گلتها\nوچم فرحت بابتسامة رديتها",
"الوگت يمشي وما يوگف لحد\nخذ العبرة وسوي الخير وحد",
"يا ليل طول وخل الهم يفوت\nولا تخليني اعيش بهل السكوت",
"العتب مو حل والصبر أحسن طريج\nلأن الصبر بالآخر يصير بريج",
"ما كل من يضحك گلبه مرتاح\nوما كل من يبچي يريد سماح",
"احبك مثل ما يحب الگمر الليل\nوانته بگلبي مثل ماي السيل",
"سكتنه سنين وحچينه بساعة\nلأن الشوگ ما يعرف طاعة",
"يا وطني الغالي وين ما اروح\nگلبي وياك وروحي معك تلوح",
"الاصل يبين بالمواقف مو بالحچي\nواللي اصله زين يبين بلا شي",
"چان الفراگ صعب واليوم اصعب\nبس الأمل يبقه وما ينهزم",
"من كثر ما تعبت ما بقه ادعي\nبس اني اعرف الرب يسمعني",
"يا ايام مرت شگد كانت حلوة\nوليتها ترجع ولو ساعة وحدة",
"الوفه صار غالي والناس تغيرت\nبس گلبي الطيب ما زال ثابت",
"العين تشوف والگلب يحس\nوالروح تعرف اللي بيها امس",
"مو عيب تبچي إذا الجرح وجعك\nالعيب تخفي وتخلي الهم ياكلك",
"يا نجمة بالسمه شفتيه وين راح\nخبريه اني لهسه بعده ما ارتاح",
"دنيه غدارة وناسها تتغير\nبس روحي الطيبة ما راح تتغير",
"چم درب مشيته لحد ما وصلت\nوچم مرة تعبت وچم مرة ابتسمت",
"احچيلك عن گلبي وشلون تعب\nوانته السبب باللي صاير وسبب",
"العمر گصير والدنيه فانية\nخل نعيش بالخير ونترك امانة",
"يا حبيبي البعد صعب ونار\nبس گلبي بيك يفتخر ويفتخر",
"الصبر مفتاح الفرج يا اخوان\nولو طال الليل لازم يجي الاذان",
"ما ننسه اللي وقف وياي بضيقي\nولا ننسه اللي زرع الشوگ بطريقي",
"يا حظي العاثر ليش دايم تلعب\nخليني مرة اضحك بلا تعب",
"الگلب يعشگ والعين تدمع\nوالروح تحن للي ما ترجع",
"عيني تدور وجهك بكل زحمة\nوالگلب يحسب ثانية سنة",
"يا ريتني طير اطير وياك\nواحط براس التل واحچيلك احچاياك",
"مثل شمعة تحترگ وتنور غيرها\nهيچي الطيب يفنى ويبقه ذكرها",
"البعد قاسي والوصل احلى امنية\nوگلبي دايم يحلم بيك ثانية",
"لا تلوم گلبي إذا حن لأصله\nفكل شي براسه يرجع لأهله",
"يا ورده حمره شبيهه خدك\nوريحتك بالگلب ما تفارگ عندك",
"العمر مثل الماي يمشي وما يرجع\nخل نغتنم كل يوم قبل ما يوجع",
"صرت اتعلم من جروحي دروس\nواعرف مين الصادگ ومين الفلوس",
"يا صاحبي الزين وين ما تروح\nذكرك بگلبي ما يفارگ ولا يروح",
"الگربه صعبة والوطن بالگلب\nولو غبنه سنين نرجع بلا حسب",
"چم مرة گلت راح انسه واعيش\nبس گلبي يرجع ليك بلا تفتيش",
"يا شمعة العمر ليش تنطفي بسرعة\nخلي ضويچ يبقه بالگلب دفعة",
"الحچي يبين شنو نوع الانسان\nوالصمت احيان يحچي اكثر من لسان",
"يا غايب عن عيني حاضر بروحي\nما ينسه گلبي غيابك يا نوحي",
"العتب صار موده بزمن الغربه\nوالصبر صار زاد يا هل التربة",
"شگد صعب اضحك وگلبي مكسور\nبس الحياة تفرض هل الشعور",
"يا ريت الزمن يرجع الينه ايام\nنعيشها من جديد بلا ازعاج والام",
"الصدگ يبقه ولو مر الزمان\nوالكذب ينكشف ولو طال الأمان",
"گلبي تعلم يصبر على الجراح\nويحاول دايما يلگه طريج الفلاح",
"يا ابو العيون السود شفتك وهويت\nوانسه العالم كله وياك سبيت",
"الدرب طويل والزاد گليل\nبس العزيمة توصلنه بالتفصيل",
"يا حزن گلبي متى بتروح وتخلص\nتعبت اتحمل وابچي واتنفس",
"الاصدقاء بوگت الضيگ يبينون\nواللي يصبرون وياك هم الطيبون",
"يا ليل خذني بعيد عن همومي\nوردني اطفل العب بايامي",
"العشگ صعب لو صادگ ونظيف\nويصير سهل لو كان زيف وخفيف",
"چم حاولت انسه وچم فشلت\nلأن الذكرى بگلبي ما اندفنت",
"يا وردة الصبر تفتحي بروحي\nوخليني اتحمل واقاوم جروحي",
"الگلب لو صافي يشوف الصفه\nوالعين الحسودة ما تشوف الا العله",
"يا نسمة الصبح خذي سلامي\nوصليه لحبيبي بعيد امامي",
"العمر فرصة وحدة وما ترجع\nخل نعيشها بمعنه وما نضيع",
"چم مره سامحت وچم مره جرحوني\nبس گلبي الطيب دايم يرجع لهوني",
"يا اهل الطيبة الله يخليكم\nوياريت دايما الخير يوصلكم",
"الصبر مو ضعف الصبر قوة\nواللي يصبر بالنهاية يلگه الحلوة",
"يا نجمة تلمعين وسط الظلام\nكوني دليلي واهديني للسلام",
"العتاب بين الحبايب دليل شوگ\nوالسكوت بينهم اصعب من الفراگ",
"چم درب سلكته لحد ما لگيتك\nوچم ليلة سهرت وانه اتذكرك",
"يا ابو الگلب الطيب زادك الله خير\nوخلا ربي يحفظك من كل شر",
"العين لما تدمع تفضح گلب حزين\nوالابتسامة احيانا تخفي جرح دفين",
"يا وطن الاجداد كل الگلب اليك\nولو بعدت اجسادنه ارواحنه اليك",
"الصبر مفتاح والدعه سلاح\nوالله كريم يبدل الضيگ فلاح",
"يا صديج العمر شكراً على وفاك\nوعلى وگفتك وياي بايام شگاك",
"العمر دقايق تعدي وما ترجع\nخل كل دقيقة نعيشها ما تضيع",
"چم مره حاولت اداري دمعتي\nبس الحزن يبين ولو خفيت غصتي",
"يا رب فرجها على كل مهموم\nواسترها على كل مذنوب ومظلوم",
"الحياة درس وكل يوم فصل جديد\nنتعلم ونغلط ونحاول نعيد",
"يا حمامة السطح غنيلي شوية\nخفف عني الهم بهل العشية",
"العتب الك يا زمن ليش تدور\nوتاخذ الطيبين وتخلي الشرور",
"چم شخص مر بحياتي وترك اثر\nوچم شخص نسيته بلمح البصر",
"يا اهل الگلوب الصافية دوموا هيچي\nلأن الدنيه تحتاج قلوب نظيفة",
"الفرح لو صادگ ينور الوجه\nوالحزن لو ثگيل يبين بلا لبس",
"يا نور عيني وين ما تكون تنور\nودربك بگلبي محفور ومسطور",
"العمر مثل الكتاب كل يوم صفحة\nنكتبها احنه ونعيش القصة",
"چم مرة ضحكت وگلبي يبچي بداخل\nوچم مرة صبرت والصبر بيه فاصل",
"يا ابو الخلگ الزين تسلم يمينك\nوربي يديم عليك الخير ويحفظك",
"الصدگ نور ولو كان مر\nوالكذب ظلام ولو زين المظهر",
"يا صوت الاذان يريح گلوبنه\nويذكرنه بربنه وبديننه",
"العتاب حلو لو كان بين الاحباب\nويصير مر لو زاد عن الاسباب",
"چم ليلة سهرت اداري همومي\nوچم صباح ابتسمت رغم جروحي",
"يا اهل الوفه دوموا الينه سند\nوخلوا المحبة تجمعنه للأبد",
"العمر لو طال او گصر لازم ينتهي\nخل نسوي الخير قبل لا ينتهي",
"يا شمس الصبح طلعي بهاء\nوخلي النور يمحي كل ظلماء",
"الگلب الطيب ما يحمل حقد\nويسامح ويصفح ويبقه بالود",
"چم مرة گلت هذا اخر العنه\nوچم مرة رجعت نفس المكان",
"يا نسيم الفجر خذني بعيد\nوردني اعيش يوم زين وسعيد",
"العمر رحلة والزاد الايمان\nوالصبر رفيگ يوصلنه للأمان",
"يا صديگ الدرب شكرا لوجودك\nوعلى المحبة اللي دايم بعهودك",
"الحزن يمر مثل ما تمر الغيمة\nوبعده تطلع شمس الفرح بحكمة",
"چم مره سالت الگمر عنك يريد\nوچم مره حچيت الريح بلا ما تعيد",
"يا اهل البيت العتيگ ذكراكم تعيش\nوگلوبنه بيها الحنين ما يطيش",
"العمر گصير والدنيه ما تدوم\nخل نعيش بمحبة وناخذ عبر ونهوم",
"يا طير الحمام غني للمحبين\nوخبرهم اننه دايما ذاكرين",
"الصبر تاج ما يلبسه الا الكرام\nواللي يصبر ينال في الاخر مقام",
"چم درب صعب مشيته لحد النور\nوچم مرة كنت اظن اني مقهور",
"يا اهل الطيبة نورو دربنه\nوخلو المحبة تسود بيننه",
"العتب على الزمن مو على الناس\nلأن الزمن هو اللي يغير الاحساس",
"يا صوت الگيثارة عزف الأسى\nخل الالحان توصف اللي جرى",
"الگلب الجريح يشفى بوگتها\nويرجع يحب ويعيش فرحتها",
"چم مرة ندمت وچم مرة سامحت\nوچم مرة بالصمت گلبي تكلم وباح",
"يا اهل الاصالة انتم زين الديار\nوبيكم نفتخر ونعيش بكل فخار",
"العمر لحظات تعدي وتنمحي\nخل كل لحظة نعيشها بمعنى وحي",
"يا ابو الطيبة يخليك الله لينه\nونورك يبقه دايم يهدينه",
"الصدگ بالحچي يبين الرجال\nوالكذب يفضح صاحبه بلا سؤال",
"چم مرة تعبت وچم مرة ارتحت\nوچم مرة بعد الظلام النور لمحت",
"يا نجوم الليل شهدوا على شوگي\nوعلى صبري وعلى طول طريگي",
"العمر امانة والوگت يمشي بسرعة\nخل نسوي فيه اللي يفرح وينفعنه",
"يا صديگ الطفولة وين ما تكون\nذكرياتنه بگلبي ما تهون",
"الفرح الحقيقي يجي من گلب صافي\nوما يشترى بمال ولا بفلوس وافي",
"چم حلم حلمته وچم حلم تحقق\nوچم مرة بالصبر طريگي انفتح",
"يا اهل الگرية الطيبة عادت الينه ذكرى\nوگلبي بيها يحن وياخذ صورة",
"العمر مدرسة نتعلم منها كل يوم\nونحاول نصلح اخطانه ونقوم",
"يا شمس المغيب ودعي بهدوء\nوخلي غدنه يجي احلى وانقى",
"الصبر على البلوى فرج قريب\nوالله كريم مايخلي عبده بلا نصيب",
"چم صديج صدگ وچم صديج خان\nوگلبي مايزال يثق ومايهان",
"يا اهل المحبة دوموا كل هالطيب\nوخلو الگلوب تلتگي بلا عيب",
"العمر كتاب وكل صفحة درس\nنتعلم منها ونمشي بلا وسواس",
"يا طير مسافر خذ اشواگي وياك\nوردهن الحبيب اللي دايم بباله",
"الگلب الوفي ما ينسه اهله\nولو بعدت المسافة يبقه فيهم امله",
"چم مرة بچيت من الفرح لا من الحزن\nوچم مرة ضحكت وگلبي بيه شجن",
"يا اهل الصبر ربي وياكم دايما\nويجزيكم خير على كل ما تحملتوا",
"العمر لو طال يبقه ذكرى حلوة\nولو گصر يبقه بگلوبنه صورة",
"يا نسيم الليل بلغ سلامي\nلكل حبيب بعيد عن مكاني",
"الصدگ سلاح ولو كان صعب حمله\nوالكذب راحة موقتة وبعدها ذله",
"چم درب مشيته وچم درب بقه\nوگلبي دايم يدور طريگ الحق",
"يا اهل الوفه انتم زين الزمان\nوبيكم نفتخر بكل مكان",
"العمر رحلة قصيرة بس عميقة\nنعيشها بمحبة ونخلي الذكرى رقيقة"
];

// إضافات مولّدة من تراكيب أصلية باللهجة العراقية حتى يصير العدد قريب من 400 بيت.
// كل بيت ينحفظ ويّاه معنى واضح، والأبيات تبقى بدون تكرار.
const GENERATED_IRAQI_POEMS = [
    ['يا گلبي لا تگدر على كل فرگه', 'تره بعد العسر تضحكلك الدنيا', 'المعنى: لا تستسلم للحزن، لأن الفرج يجي بعد التعب.'],
    ['على طاري الوفه تنذكر الوجوه', 'والطيب يبقى لو تتبدل الأيام', 'المعنى: الإنسان الوفي تبقى قيمته حتى لو تغيّرت الظروف.'],
    ['هواي ناس مرّت وما خلّت أثر', 'وانت بگلبـي صرت أول وآخر', 'المعنى: بعض الأشخاص يكون حضورهم عابر، بينما الحبيب يترك أثراً عميقاً.'],
    ['يا ليل خلّي نجومك شاهدات', 'على گلب صابر وما باع الود', 'المعنى: الصبر والوفاء يثبتان صدق المشاعر مهما طال الانتظار.'],
    ['چنت أظن الجرح يعلّم نسيان', 'طلع يعلّم شلون نختار الناس', 'المعنى: التجارب المؤلمة تعلّمنا التمييز بين الصادق والمزيّف.'],
    ['من ينكسر خاطر الطيب يهدأ', 'بس تبقى بعيونه سالفة عمر', 'المعنى: الشخص الطيب قد يسكت عن ألمه، لكن أثره يبقى في داخله.'],
    ['يا صاحبي لا تشيل الهم وحدك', 'تره الرفقة الصدگ تسند جبل', 'المعنى: الصديق الحقيقي يخفف الحمل ويقف معك في الشدائد.'],
    ['لو ضاگت الدنيا بوجهك يوم', 'افتح باب الدعاء تلقى أمان', 'المعنى: اللجوء إلى الله يمنح القلب طمأنينة وقت الضيق.'],
    ['الشوگ مو كلمة وتنقال بساعة', 'الشوگ عمر يظل بالروح ساكن', 'المعنى: الاشتياق الحقيقي إحساس طويل يعيش في القلب ولا ينتهي بسرعة.'],
    ['يا وردة بستاني لا تميلين', 'تره ريحتچ ترد الروح للبيت', 'المعنى: الحضور الجميل يعيد الفرح والدفء إلى المكان والقلب.'],
    ['ما هزّني حچي الناس لو كثر', 'اللي يعرف أصله ما يلتفت', 'المعنى: صاحب المبدأ لا يتأثر بكلام الناس ما دام يعرف قيمته.'],
    ['الدرب لو بيه شوك نمشيه', 'المهم آخره يفتح للفرح باب', 'المعنى: الصعوبات تهون عندما يكون الهدف يستحق الوصول.'],
    ['يا حلم لا تسرع وتتركني وحدي', 'تره من دونك ما يطيب السهر', 'المعنى: الأمل هو الذي يجعل الانتظار والتعب محتملين.'],
    ['گلبـي تعلّم من سكوتك حچي', 'وصار يفسّر كل نظرة عيون', 'المعنى: المحبة الصادقة تفهم الإشارات حتى من دون كلام.'],
    ['الما يگدر يحفظ العشرة يوم', 'لا يطلب من گلبك تبقى وياه', 'المعنى: الوفاء مسؤولية، ومن يضيّع العشرة لا يحق له طلب البقاء.'],
    ['من يزرع الخير بگلوب البشر', 'يحصد محبة لو بعد حين', 'المعنى: المعروف يرجع إلى صاحبه ولو بعد وقت.'],
    ['يا شمس خلي دفوچ ببيوتنه', 'تره البرد مو بس بالجو يصير', 'المعنى: القسوة قد تكون في المشاعر، والحنان هو الدفء الحقيقي.'],
    ['الذكرى لو توجع تبقى غالية', 'لأن بيها ضحكة ناس نحبهم', 'المعنى: الذكريات المؤلمة تظل عزيزة لأنها مرتبطة بأشخاص مهمين.'],
    ['لا تحسب الهدوء ضعف وخوف', 'مرات السكوت أبلغ جواب', 'المعنى: الصمت أحياناً يدل على الحكمة والقوة وليس العجز.'],
    ['يا وطن يا ريحة أهلنه', 'بكل غربة نرجعلك بالبال', 'المعنى: الوطن يبقى حاضراً في القلب مهما ابتعد الإنسان عنه.']
]
for (const [first, second, meaning] of GENERATED_IRAQI_POEMS) {
    for (const suffix of [
        'وبعدها يجي الفرج', 'والطيب ما يضيع', 'والأمل يبقى حي', 'والگلب يعرف دربه', 'والعشرة إلها قدر', 'والله يكتب خير',
        'وما ننحني للضيم', 'والفرحة ترد للدار', 'والصبر يجيب نتيجة', 'والحچي يبقى بميزان',
        'والنية الطيبة تكفي', 'والبعد ما يطفي الود', 'والذكرى تبقى حلوة', 'والخير يفتح دربه'
    ]) {
        IRAQI_POEMS_SEED.push({ text: `${first}\n${second}، ${suffix}`, meaning });
    }
}

// تحويل الأبيات القديمة إلى سجلات تحمل معنى، مع إبقاء النصوص كما هي.
const POEM_MEANINGS = [
    { words: ['فراگ', 'غياب', 'بعد', 'غايب'], values: ['المعنى: يحچي عن وجع الفراگ والاشتياگ لشخص غالي.', 'المعنى: يصف شلون الغياب يطوّل الوقت ويخلّي الذكرى حاضرة.', 'المعنى: يعبّر عن أمل الوصل رغم قسوة البعد.'] },
    { words: ['صبر', 'جراح', 'حزن', 'هم', 'دمع'], values: ['المعنى: يعبّر عن تحمل التعب لحد ما يجي الفرج.', 'المعنى: يذكّر أن الجرح يعلّم الإنسان ويقوّي قلبه.', 'المعنى: يحچي عن حزن مخفي وراء السكوت والابتسامة.'] },
    { words: ['صديج', 'رفيق', 'وفه', 'عشرة'], values: ['المعنى: يمدح الصديق اللي يوقف ويّاك بوقت الضيگ.', 'المعنى: يبيّن أن العشرة الصادقة أغلى من كثرة المعارف.', 'المعنى: يعبّر عن امتنان شخص ما نسى وگفة حبيبه.'] },
    { words: ['وطن', 'دار', 'گرية', 'بيت', 'أهل'], values: ['المعنى: يعبّر عن حنين الروح للوطن والأهل.', 'المعنى: يبيّن أن الدار تبقى بالگلب حتى لو طال السفر.', 'المعنى: يحچي عن فخر الإنسان بمكانه وذكرياته.'] },
    { words: ['حب', 'عشگ', 'حبيب', 'شوگ', 'گلبي'], values: ['المعنى: يعبّر عن محبة صادگة ساكنة بالگلب.', 'المعنى: يصف اشتياگ المحب لشخص ما يگدر ينساه.', 'المعنى: يحچي عن أثر الحبيب اللي يبقى بكل تفاصيل اليوم.'] },
    { words: ['صدق', 'صدگ', 'كذب', 'مواقف', 'أصل'], values: ['المعنى: يوضح أن الصدگ يبان بالمواقف مو بكثرة الحچي.', 'المعنى: يفرّق بين صاحب الأصل وبين الكلام اللي ما وراه فعل.', 'المعنى: يذكّر أن الكذب ينكشف مهما طال الوقت.'] },
    { words: ['عمر', 'وگت', 'دنيه', 'حياة', 'يوم'], values: ['المعنى: يذكّرنا أن العمر يمشي بسرعة ولازم نغتنم أيامه.', 'المعنى: يحثّ على ترك أثر طيب قبل ما تمر السنين.', 'المعنى: يبيّن أن كل يوم فرصة جديدة للتغيير والفرح.'] }
];
function meaningForPoem(text) {
    const source = String(text || '');
    const matched = POEM_MEANINGS.find(group => group.words.some(word => source.includes(word)));
    const values = matched?.values || ['المعنى: يحچي عن إحساس صادق وتجربة من تجارب الحياة.', 'المعنى: يعبّر عن مشاعر وتجربة تركت أثرها بالروح.', 'المعنى: يصف إحساساً عميقاً يمر بيه الإنسان بحياته.'];
    let hash = 0;
    for (const char of source) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    return values[hash % values.length];
}
function resolvedPoemMeaning(poem) {
    const stored = String(poem?.meaning || '').trim();
    return !stored || stored === 'يحچي عن إحساس صادق ومشاعر من القلب.' || stored === 'المعنى: يحچي عن إحساس صادق وتجربة من تجارب الحياة.'
        ? meaningForPoem(poem?.text)
        : stored;
}
const NORMALIZED_POEMS = IRAQI_POEMS_SEED.map(item => typeof item === 'string'
    ? { text: item, meaning: meaningForPoem(item) }
    : item
);


async function seedPoemsIfNeeded() {
    try {
        const docs = [...new Map(NORMALIZED_POEMS.map(item => [item.text, item])).values()];
        for (const poem of docs) {
            await Poem.updateOne({ text: poem.text }, { $setOnInsert: poem, $set: { meaning: poem.meaning } }, { upsert: true }).catch(() => {});
        }
        const count = await Poem.countDocuments();
        console.log(`[Poetry] تم تجهيز ${count} بيت شعر عراقي في قاعدة البيانات.`);
    } catch (err) {
        console.error('[Poetry Seed Error]', err.message);
    }
}

async function refillPoetryQueue(config, excludeId = null) {
    const allIds = (await Poem.find({}, { _id: 1 }).lean()).map(p => p._id.toString());
    if (allIds.length === 0) return [];
    // خلط عشوائي (Fisher-Yates)
    for (let i = allIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
    }
    // نتجنب انو نفس البيت الاخير يطلع اول وحدة بالدورة الجديدة إذا العدد يسمح
    if (excludeId && allIds.length > 1 && allIds[0] === excludeId.toString()) {
        [allIds[0], allIds[1]] = [allIds[1], allIds[0]];
    }
    return allIds;
}

async function sendPoemToGuild(config) {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(config.channelId) || await guild.channels.fetch(config.channelId).catch(() => null);
    if (!channel?.isTextBased?.()) return;

    let queue = Array.isArray(config.queue) ? [...config.queue] : [];
    if (queue.length === 0) {
        queue = await refillPoetryQueue(config);
        if (queue.length === 0) return; // لا يوجد أي شعر بقاعدة البيانات
    }

    const nextId = queue.shift();
    const poem = await Poem.findById(nextId).catch(() => null);

    config.queue = queue;
    config.lastSentAt = new Date();
    await config.save().catch(() => {});

    if (!poem) return; // البيت انحذف بينهم، الدورة الجاية بتصلحها

    const guildConfig = await GuildConfig.findOne({ guildId: guild.id }).lean().catch(() => null);
    const bannerURL = guildConfig?.welcome?.bannerURL;
    const actualMeaning = resolvedPoemMeaning(poem);
    if (poem.meaning !== actualMeaning) {
        await Poem.updateOne({ _id: poem._id }, { $set: { meaning: actualMeaning } }).catch(() => {});
    }
    const embed = new EmbedBuilder()
        .setTitle('بيت شعر عراقي')
        .setDescription(`**${String(poem.text).replace(/\n/g, '\n')}**`)
        .addFields(
            { name: 'ــــــــــــــــــــــــــــ', value: 'ــــــــــــــــــــــــــــ', inline: false },
            { name: 'المعنى', value: actualMeaning, inline: false }
        )
        .setColor(0xff0000)
        .setFooter({ text: 'VORTEX - الشعر العراقي' })
        .setTimestamp();
    if (bannerURL) embed.setImage(bannerURL);

    const mention = config.roleId ? `<@&${config.roleId}>` : undefined;
    await channel.send({ content: mention, embeds: [embed], allowedMentions: config.roleId ? { roles: [config.roleId] } : undefined }).catch(e => console.error('[Poetry Send Error]', e.message));
}

let poetryCheckRunning = false;
async function checkPoetrySchedules() {
    if (poetryCheckRunning) return;
    poetryCheckRunning = true;
    try {
        const configs = await PoetryConfig.find({ enabled: true, channelId: { $exists: true, $ne: '' } });
        const now = Date.now();
        for (const config of configs) {
            const intervalMs = Math.max(1, config.intervalMinutes || 2) * 60 * 1000;
            const last = config.lastSentAt ? new Date(config.lastSentAt).getTime() : 0;
            if (now - last >= intervalMs) {
                await sendPoemToGuild(config);
            }
        }
    } catch (err) {
        console.error('[Poetry Scheduler Error]', err.message);
    } finally {
        poetryCheckRunning = false;
    }
}

// نفحص كل 20 ثانية بس الإرسال الفعلي يصير بس إذا وصل وگت العدّاد الخاص بكل سيرفر (intervalMinutes)
setInterval(checkPoetrySchedules, 20 * 1000);


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
        console.log('[VORTEX ] Slash commands registered.');
    } catch (err) {
        console.error('[Slash Register Error]', err);
    }
}

// ==========================================
// 16. Client Ready
// ==========================================

client.once('ready', async () => {
    console.log(`[VORTEX ] Bot is online as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'VORTEX ', type: ActivityType.Watching }],
        status: 'online'
    });

    // استئناف السجون المنتهية
    try {
        const now = new Date();
        const expiredJails = await JailData.find({ endAt: { $lte: now } });
        for (const jailEntry of expiredJails) {
            const guild = client.guilds.cache.get(jailEntry.guildId);
            if (!guild) continue;
            const member = await guild.members.fetch(jailEntry.userId).catch(() => null);
            if (member) await handleUnjail(member, jailEntry.guildId);
        }
    } catch (err) {
        console.error('[Jail Resume Error]', err);
    }

    for (const guild of client.guilds.cache.values()) await fetchGuildInvites(guild);
    await registerSlashCommands();
    await seedPoemsIfNeeded();
    checkKickLive();
    checkPoetrySchedules();
});

// ==========================================
// 17. Start Server & Login
// ==========================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[VORTEX ] Dashboard running on port ${PORT}`);
});

client.login(process.env.TOKEN).catch(err => {
    console.error('[VORTEX ] Login failed:', err);
    process.exit(1);
});
