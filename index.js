const crypto = require("node:crypto");
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  ChannelType,
  REST,
  Routes,
  AuditLogEvent,
} = require("discord.js");

// ============================================================
// NEXUS CONTROL — نقطة تشغيل التطبيق
// يجمع هذا الملف الخادم والداشبورد وبوت Discord في ملف واحد.
// ============================================================
const app = express();
const PORT = Number(process.env.PORT || 10000);
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const DISCORD_API = "https://discord.com/api/v10";
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message],
});
// ============================================================
// ذاكرة الإعدادات والبيانات المؤقتة
// يمكن استبدال هذه الخرائط بقاعدة بيانات دون تغيير واجهة البوت.
// ============================================================
const settings = new Map();
const warnings = new Map();
const xp = new Map();
const spam = new Map();
const nuke = new Map();

// ============================================================
// جلسات Discord OAuth2 الحقيقية
// لا تحفظ access tokens في المتصفح؛ تحفظ على الخادم فقط.
// ============================================================
const sessions = new Map();
const oauthStates = new Map();
const SESSION_COOKIE = "nexus_session";
const OAUTH_STATE_COOKIE = "nexus_oauth_state";
const defaults = {
  antiSpam: true,
  antiLinks: true,
  antiNuke: true,
  xp: true,
  welcome: true,
  logChannelId: process.env.LOG_CHANNEL_ID || "",
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || "",
  autoRoleId: process.env.AUTO_ROLE_ID || "",
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || "",
  mutedRoleId: process.env.MUTED_ROLE_ID || "",
};
const TRUSTED_DOMAINS = (
  process.env.TRUSTED_DOMAINS || "youtube.com,github.com,discord.com"
)
  .split(",")
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

// ============================================================
// Discord OAuth2: authorization code flow + جلسات HTTP
// ============================================================
function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [
          decodeURIComponent(part.slice(0, index).trim()),
          decodeURIComponent(part.slice(index + 1).trim()),
        ];
      }),
  );
}
function setCookie(res, name, value, maxAge = 86400) {
  const header = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax;${process.env.COOKIE_SECURE === "false" ? "" : " Secure"}`;
  const current = res.getHeader("Set-Cookie");
  const values = current ? (Array.isArray(current) ? current : [current]) : [];
  res.setHeader("Set-Cookie", [...values, header]);
}
function clearCookie(res, name) {
  setCookie(res, name, "", 0);
}
function signSessionId(id) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(id).digest("base64url");
}
function signedSessionId(id) {
  return `${id}.${signSessionId(id)}`;
}
function verifiedSessionId(value) {
  const [id, signature] = String(value || "").split(".");
  if (!id || !signature || !SESSION_SECRET) return null;
  const expected = signSessionId(id);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right) ? id : null;
}
function sessionFromRequest(req) {
  const id = verifiedSessionId(parseCookies(req)[SESSION_COOKIE]);
  return id ? sessions.get(id) || null : null;
}
function oauthConfigured() {
  return Boolean(CLIENT_ID && DISCORD_CLIENT_SECRET && DISCORD_REDIRECT_URI && SESSION_SECRET);
}
function oauthUrl(state) {
  const query = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds",
    state,
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${query}`;
}
async function discordRequest(path, accessToken, options = {}) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Discord API ${response.status}: ${await response.text()}`);
  return response.json();
}
async function exchangeOAuthCode(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: DISCORD_REDIRECT_URI,
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`OAuth token exchange failed: ${response.status}`);
  return response.json();
}
function canManageGuild(guild) {
  const permissions = BigInt(guild.permissions || "0");
  const manageGuild = 1n << 5n;
  const administrator = 1n << 3n;
  return Boolean(guild.owner || (permissions & manageGuild) === manageGuild || (permissions & administrator) === administrator);
}
function managedGuilds(session) {
  return (session?.guilds || []).filter(canManageGuild);
}
function requireSession(req, res) {
  const session = sessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  return session;
}

function getSettings(guildId) {
  if (!settings.has(guildId)) settings.set(guildId, { ...defaults });
  return settings.get(guildId);
}
function mentionUser(user) {
  return `<@${user.id}>`;
}
function mentionRole(role) {
  return `<@&${role.id}>`;
}
function mentionChannel(channel) {
  return `<#${channel.id}>`;
}
function card(title, description, color = 0x7c3aed) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}
async function logEvent(guild, title, description, color = 0x5865f2) {
  const id = getSettings(guild.id).logChannelId;
  if (!id) return;
  const channel = await guild.channels.fetch(id).catch(() => null);
  if (channel?.isTextBased())
    await channel
      .send({ embeds: [card(title, description, color)] })
      .catch(() => null);
}
function moderator(i) {
  return (
    i.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages) ||
    i.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers) ||
    i.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)
  );
}
function administrator(i) {
  return i.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
}
function targetError(i, member) {
  if (!member) return "العضو غير موجود داخل السيرفر.";
  if (member.id === i.user.id) return "لا يمكنك تنفيذ الإجراء على نفسك.";
  if (member.id === i.guild.ownerId)
    return "لا يمكن تنفيذ الإجراء على مالك السيرفر.";
  if (
    i.member.roles.highest.comparePositionTo(member.roles.highest) <= 0 &&
    i.user.id !== i.guild.ownerId
  )
    return "يجب أن تكون رتبتك أعلى من رتبة العضو المستهدف.";
  return null;
}

// ============================================================
// أوامر Slash الإدارية — 20 أمرًا
// ============================================================
const commands = [
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تسجيل تحذير على عضو")
    .addUserOption((o) =>
      o.setName("user").setDescription("العضو").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("السبب").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("كتم عضو لمدة محددة")
    .addUserOption((o) =>
      o.setName("user").setDescription("العضو").setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("minutes")
        .setDescription("الدقائق")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("السبب")),
  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("إلغاء كتم عضو")
    .addUserOption((o) =>
      o.setName("user").setDescription("العضو").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("حظر عضو")
    .addUserOption((o) =>
      o.setName("user").setDescription("العضو").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("السبب").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("إلغاء حظر عضو بواسطة المعرف")
    .addStringOption((o) =>
      o.setName("user_id").setDescription("معرف العضو").setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("السبب")),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("طرد عضو")
    .addUserOption((o) =>
      o.setName("user").setDescription("العضو").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("السبب").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("حذف رسائل")
    .addIntegerOption((o) =>
      o
        .setName("amount")
        .setDescription("من 1 إلى 100")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("تعيين الوضع البطيء للقناة")
    .addIntegerOption((o) =>
      o
        .setName("seconds")
        .setDescription("الثواني")
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل القناة الحالية"),
  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح القناة الحالية"),
  new SlashCommandBuilder()
    .setName("nick")
    .setDescription("تعديل لقب عضو")
    .addUserOption((o) =>
      o.setName("user").setDescription("العضو").setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("nickname")
        .setDescription("اللقب الجديد")
        .setMaxLength(32)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("إضافة رتبة لعضو")
    .addUserOption((o) =>
      o.setName("user").setDescription("العضو").setRequired(true),
    )
    .addRoleOption((o) =>
      o.setName("role").setDescription("الرتبة").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("إزالة رتبة من عضو")
    .addUserOption((o) =>
      o.setName("user").setDescription("العضو").setRequired(true),
    )
    .addRoleOption((o) =>
      o.setName("role").setDescription("الرتبة").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("إرسال إعلان منسق")
    .addStringOption((o) =>
      o.setName("title").setDescription("العنوان").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("message").setDescription("النص").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("مسح تحذيرات عضو")
    .addUserOption((o) =>
      o.setName("user").setDescription("العضو").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("إرسال لوحة التذاكر"),
  new SlashCommandBuilder()
    .setName("close")
    .setDescription("إغلاق التذكرة الحالية"),
  new SlashCommandBuilder()
    .setName("setlogs")
    .setDescription("تعيين قناة اللوجات")
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("القناة")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("setwelcome")
    .setDescription("تعيين قناة الترحيب")
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("القناة")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("setautorole")
    .setDescription("تعيين الرتبة التلقائية")
    .addRoleOption((o) =>
      o.setName("role").setDescription("الرتبة").setRequired(true),
    ),
].map((c) => c.toJSON());

async function registerCommands() {
  if (!TOKEN || !CLIENT_ID)
    return console.warn("ضع DISCORD_TOKEN و CLIENT_ID لتسجيل Slash Commands.");
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Registered ${commands.length} commands.`);
}

// ============================================================
// معالج أوامر الإدارة والصلاحيات والمنشنات
// ============================================================
async function handleCommand(i) {
  if (!i.guild)
    return i.reply({
      content: "هذا الأمر يعمل داخل السيرفر فقط.",
      ephemeral: true,
    });
  const name = i.commandName;
  if (
    [
      "warn",
      "mute",
      "unmute",
      "ban",
      "unban",
      "kick",
      "purge",
      "slowmode",
      "lock",
      "unlock",
      "nick",
      "addrole",
      "removerole",
      "announce",
      "clearwarnings",
      "ticket",
      "close",
    ].includes(name) &&
    !moderator(i)
  )
    return i.reply({
      content: "تحتاج إلى صلاحيات الإشراف لتنفيذ هذا الأمر.",
      ephemeral: true,
    });
  if (
    ["setlogs", "setwelcome", "setautorole"].includes(name) &&
    !administrator(i)
  )
    return i.reply({
      content: "تحتاج إلى Administrator لتعديل إعدادات البوت.",
      ephemeral: true,
    });
  if (name === "warn") {
    const member = await i.guild.members
      .fetch(i.options.getUser("user").id)
      .catch(() => null);
    const reason = i.options.getString("reason");
    const err = targetError(i, member);
    if (err) return i.reply({ content: err, ephemeral: true });
    const key = `${i.guild.id}:${member.id}`;
    const list = warnings.get(key) || [];
    list.push({ reason, moderator: i.user.id, at: Date.now() });
    warnings.set(key, list);
    await member
      .send({
        embeds: [
          card(
            "تحذير إداري",
            `تم تسجيل تحذير على حسابك في **${i.guild.name}**.\nالسبب: ${reason}`,
            0xf59e0b,
          ),
        ],
      })
      .catch(() => null);
    await logEvent(
      i.guild,
      "تسجيل تحذير",
      `العضو: ${mentionUser(member.user)}\nالمشرف: ${mentionUser(i.user)}\nالسبب: ${reason}`,
      0xf59e0b,
    );
    return i.reply({
      embeds: [
        card(
          "تم تسجيل التحذير",
          `${mentionUser(member.user)}\nالسبب: ${reason}`,
          0xf59e0b,
        ),
      ],
    });
  }
  if (name === "mute") {
    const member = await i.guild.members
      .fetch(i.options.getUser("user").id)
      .catch(() => null);
    const err = targetError(i, member);
    if (err) return i.reply({ content: err, ephemeral: true });
    const minutes = i.options.getInteger("minutes");
    await member.timeout(
      minutes * 60000,
      i.options.getString("reason") || "Moderation",
    );
    await logEvent(
      i.guild,
      "كتم عضو",
      `${mentionUser(member.user)} لمدة ${minutes} دقيقة بواسطة ${mentionUser(i.user)}`,
      0xef4444,
    );
    return i.reply({
      embeds: [
        card(
          "تم تنفيذ الكتم",
          `${mentionUser(member.user)} لمدة **${minutes} دقيقة**.`,
          0xef4444,
        ),
      ],
    });
  }
  if (name === "unmute") {
    const member = await i.guild.members
      .fetch(i.options.getUser("user").id)
      .catch(() => null);
    if (!member)
      return i.reply({ content: "العضو غير موجود.", ephemeral: true });
    await member.timeout(null, "Unmute");
    return i.reply({
      embeds: [card("تم إلغاء الكتم", mentionUser(member.user), 0x22c55e)],
    });
  }
  if (name === "ban" || name === "kick") {
    const member = await i.guild.members
      .fetch(i.options.getUser("user").id)
      .catch(() => null);
    const err = targetError(i, member);
    if (err) return i.reply({ content: err, ephemeral: true });
    const reason = i.options.getString("reason");
    if (name === "ban") await member.ban({ reason });
    else await member.kick(reason);
    await logEvent(
      i.guild,
      name === "ban" ? "حظر عضو" : "طرد عضو",
      `العضو: ${mentionUser(member.user)}\nالمشرف: ${mentionUser(i.user)}\nالسبب: ${reason}`,
      0xef4444,
    );
    return i.reply({
      embeds: [
        card(
          name === "ban" ? "تم حظر العضو" : "تم طرد العضو",
          `${mentionUser(member.user)}\nالسبب: ${reason}`,
          0xef4444,
        ),
      ],
    });
  }
  if (name === "unban") {
    const id = i.options.getString("user_id");
    await i.guild.bans.remove(id, i.options.getString("reason") || "Unban");
    return i.reply({
      embeds: [card("تم إلغاء الحظر", `المعرف: ${id}`, 0x22c55e)],
    });
  }
  if (name === "purge") {
    const amount = i.options.getInteger("amount");
    const deleted = await i.channel.bulkDelete(amount, true);
    await logEvent(
      i.guild,
      "تنظيف رسائل",
      `القناة: ${mentionChannel(i.channel)}\nالعدد: ${deleted.size}\nالمشرف: ${mentionUser(i.user)}`,
      0xf59e0b,
    );
    return i.reply({
      content: `تم حذف ${deleted.size} رسالة.`,
      ephemeral: true,
    });
  }
  if (name === "slowmode") {
    const seconds = i.options.getInteger("seconds");
    await i.channel.setRateLimitPerUser(seconds, `By ${i.user.tag}`);
    return i.reply({
      embeds: [
        card(
          "تم تحديث الوضع البطيء",
          `القيمة الجديدة: **${seconds} ثانية**.`,
          0x06b6d4,
        ),
      ],
    });
  }
  if (name === "lock" || name === "unlock") {
    await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, {
      SendMessages: name === "unlock",
    });
    await logEvent(
      i.guild,
      name === "lock" ? "قفل قناة" : "فتح قناة",
      `القناة: ${mentionChannel(i.channel)}\nبواسطة: ${mentionUser(i.user)}`,
      0xf59e0b,
    );
    return i.reply({
      embeds: [
        card(
          name === "lock" ? "تم قفل القناة" : "تم فتح القناة",
          mentionChannel(i.channel),
          0xf59e0b,
        ),
      ],
    });
  }
  if (name === "nick") {
    const member = await i.guild.members
      .fetch(i.options.getUser("user").id)
      .catch(() => null);
    const err = targetError(i, member);
    if (err) return i.reply({ content: err, ephemeral: true });
    await member.setNickname(i.options.getString("nickname"));
    return i.reply({
      embeds: [
        card(
          "تم تحديث اللقب",
          `${mentionUser(member.user)}\nاللقب الجديد: **${i.options.getString("nickname")}**`,
          0x06b6d4,
        ),
      ],
    });
  }
  if (name === "addrole" || name === "removerole") {
    const member = await i.guild.members
      .fetch(i.options.getUser("user").id)
      .catch(() => null);
    const role = i.options.getRole("role");
    const err = targetError(i, member);
    if (err) return i.reply({ content: err, ephemeral: true });
    if (role.position >= i.guild.members.me.roles.highest.position)
      return i.reply({
        content: "رتبة البوت يجب أن تكون أعلى من الرتبة المستهدفة.",
        ephemeral: true,
      });
    if (name === "addrole") await member.roles.add(role);
    else await member.roles.remove(role);
    return i.reply({
      embeds: [
        card(
          name === "addrole" ? "تمت إضافة الرتبة" : "تمت إزالة الرتبة",
          `${mentionUser(member.user)}\n${mentionRole(role)}`,
          0x22c55e,
        ),
      ],
    });
  }
  if (name === "announce") {
    const title = i.options.getString("title");
    const message = i.options.getString("message");
    await i.channel.send({ embeds: [card(title, message)] });
    return i.reply({ content: "تم إرسال الإعلان.", ephemeral: true });
  }
  if (name === "clearwarnings") {
    const member = i.options.getUser("user");
    warnings.delete(`${i.guild.id}:${member.id}`);
    return i.reply({
      content: `تم مسح تحذيرات ${mentionUser(member)}.`,
      ephemeral: true,
    });
  }
  if (name === "ticket") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket:create")
        .setLabel("فتح تذكرة")
        .setStyle(ButtonStyle.Primary),
    );
    return i.reply({
      embeds: [
        card("مركز الدعم", "اضغط على الزر لفتح تذكرة خاصة مع فريق الإدارة."),
      ],
      components: [row],
    });
  }
  if (name === "close") {
    if (!i.channel.name.startsWith("ticket-"))
      return i.reply({
        content: "هذا الأمر يعمل داخل قنوات التذاكر فقط.",
        ephemeral: true,
      });
    await i.reply({ content: "سيتم إغلاق التذكرة خلال ثوانٍ." });
    return setTimeout(() => i.channel.delete().catch(() => null), 3000);
  }
  if (name === "setlogs") {
    getSettings(i.guild.id).logChannelId = i.options.getChannel("channel").id;
    return i.reply({
      content: `تم تعيين قناة اللوجات: ${mentionChannel(i.options.getChannel("channel"))}`,
    });
  }
  if (name === "setwelcome") {
    getSettings(i.guild.id).welcomeChannelId =
      i.options.getChannel("channel").id;
    return i.reply({
      content: `تم تعيين قناة الترحيب: ${mentionChannel(i.options.getChannel("channel"))}`,
    });
  }
  if (name === "setautorole") {
    getSettings(i.guild.id).autoRoleId = i.options.getRole("role").id;
    return i.reply({
      content: `تم تعيين الرتبة التلقائية: ${mentionRole(i.options.getRole("role"))}`,
    });
  }
}

// ============================================================
// التذاكر والأزرار والتفاعلات
// ============================================================
client.on("interactionCreate", async (i) => {
  try {
    if (i.isChatInputCommand()) await handleCommand(i);
    if (i.isButton() && i.customId === "ticket:create") {
      const existing = i.guild.channels.cache.find(
        (c) => c.name === `ticket-${i.user.id}`,
      );
      if (existing)
        return i.reply({
          content: `لديك تذكرة مفتوحة: ${mentionChannel(existing)}`,
          ephemeral: true,
        });
      const s = getSettings(i.guild.id);
      const channel = await i.guild.channels.create({
        name: `ticket-${i.user.id}`,
        type: ChannelType.GuildText,
        parent: s.ticketCategoryId || undefined,
        permissionOverwrites: [
          {
            id: i.guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: i.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ],
      });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket:close")
          .setLabel("إغلاق التذكرة")
          .setStyle(ButtonStyle.Danger),
      );
      await channel.send({
        content: mentionUser(i.user),
        embeds: [
          card(
            "تذكرة دعم",
            "اكتب تفاصيل طلبك بوضوح، وسيقوم الفريق بالرد عليك.",
          ),
        ],
        components: [row],
      });
      return i.reply({
        content: `تم فتح التذكرة: ${mentionChannel(channel)}`,
        ephemeral: true,
      });
    }
    if (i.isButton() && i.customId === "ticket:close") {
      await i.reply({ content: "سيتم إغلاق التذكرة خلال ثوانٍ." });
      return setTimeout(() => i.channel.delete().catch(() => null), 3000);
    }
  } catch (e) {
    console.error(e);
    const response = {
      content: "تعذر تنفيذ الأمر. تحقق من صلاحيات البوت وترتيب الرتب.",
      ephemeral: true,
    };
    if (i.replied || i.deferred) await i.followUp(response).catch(() => null);
    else await i.reply(response).catch(() => null);
  }
});
// ============================================================
// الترحيب والمغادرة والرتب التلقائية
// ============================================================
client.on("guildMemberAdd", async (member) => {
  const s = getSettings(member.guild.id);
  if (s.autoRoleId) await member.roles.add(s.autoRoleId).catch(() => null);
  if (s.welcome && s.welcomeChannelId) {
    const ch = await member.guild.channels
      .fetch(s.welcomeChannelId)
      .catch(() => null);
    if (ch?.isTextBased())
      await ch
        .send({
          embeds: [
            card(
              "عضو جديد",
              `مرحبًا ${mentionUser(member.user)} في **${member.guild.name}**.`,
              0x22c55e,
            ),
          ],
        })
        .catch(() => null);
  }
  await logEvent(
    member.guild,
    "انضمام عضو",
    `العضو: ${mentionUser(member.user)}`,
    0x22c55e,
  );
});
client.on("guildMemberRemove", (member) =>
  logEvent(
    member.guild,
    "مغادرة عضو",
    `العضو: ${mentionUser(member.user)}`,
    0x64748b,
  ),
);
// ============================================================
// Anti-Spam وAnti-Link وXP
// ============================================================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  const s = getSettings(message.guild.id);
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if (s.antiLinks && /(https?:\/\/|www\.)/i.test(message.content)) {
    let allowed = false;
    try {
      const raw = message.content.match(/https?:\/\/[^\s]+|www\.[^\s]+/i)?.[0];
      const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      allowed = TRUSTED_DOMAINS.some(
        (d) => url.hostname === d || url.hostname.endsWith(`.${d}`),
      );
    } catch (_) {}
    if (!allowed) {
      await message.delete().catch(() => null);
      await logEvent(
        message.guild,
        "منع رابط غير موثوق",
        `العضو: ${mentionUser(message.author)}\nالقناة: ${mentionChannel(message.channel)}`,
        0xef4444,
      );
      return;
    }
  }
  if (s.antiSpam) {
    const recent = (spam.get(key) || []).filter((t) => now - t < 7000);
    recent.push(now);
    spam.set(key, recent);
    if (recent.length >= 6) {
      await message.member.timeout(60000, "NEXUS anti-spam").catch(() => null);
      spam.set(key, []);
      await logEvent(
        message.guild,
        "إجراء ضد السبام",
        `العضو: ${mentionUser(message.author)}\nالإجراء: كتم دقيقة`,
        0xef4444,
      );
      return;
    }
  }
  if (s.xp && now % 3 === 0) {
    const data = xp.get(key) || { level: 1, points: 0, messages: 0 };
    data.points += 5;
    data.messages += 1;
    if (data.points >= data.level * 100) {
      data.points = 0;
      data.level += 1;
      await message.channel
        .send(
          `${mentionUser(message.author)} وصلت إلى المستوى **${data.level}**.`,
        )
        .catch(() => null);
    }
    xp.set(key, data);
  }
});
// ============================================================
// Anti-Nuke ومراقبة Audit Logs
// ============================================================
client.on("guildAuditLogEntryCreate", async (entry, guild) => {
  if (
    !getSettings(guild.id).antiNuke ||
    ![
      AuditLogEvent.ChannelCreate,
      AuditLogEvent.ChannelDelete,
      AuditLogEvent.ChannelUpdate,
      AuditLogEvent.RoleCreate,
      AuditLogEvent.RoleDelete,
      AuditLogEvent.RoleUpdate,
      AuditLogEvent.MemberBanAdd,
      AuditLogEvent.MemberKick,
    ].includes(entry.action)
  )
    return;
  const id = entry.executor?.id;
  if (!id || id === client.user?.id || id === guild.ownerId) return;
  const key = `${guild.id}:${id}`;
  const records = (nuke.get(key) || []).filter((t) => Date.now() - t < 20000);
  records.push(Date.now());
  nuke.set(key, records);
  await logEvent(
    guild,
    "تنبيه Anti-Nuke",
    `المنفذ: <@${id}>\nالإجراء: ${entry.action}\nالعدد خلال 20 ثانية: ${records.length}`,
    0xef4444,
  );
  if (records.length >= 3) {
    const member = await guild.members.fetch(id).catch(() => null);
    if (member && guild.members.me) {
      const removable = member.roles.cache.filter(
        (r) =>
          !r.managed && r.position < guild.members.me.roles.highest.position,
      );
      if (removable.size)
        await member.roles
          .remove(removable, "NEXUS Anti-Nuke")
          .catch(() => null);
      await member.timeout(86400000, "NEXUS Anti-Nuke").catch(() => null);
    }
    nuke.set(key, []);
  }
});

// ============================================================
// واجهة NEXUS CONTROL المضمنة: HTML + CSS + JavaScript
// ============================================================
const dashboard = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEXUS CONTROL</title><style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');:root{font-family:'IBM Plex Sans Arabic',sans-serif;color:#f7f5ff;background:#090a12}*{box-sizing:border-box}body{margin:0;background:#090a12}button{font:inherit;cursor:pointer;border:0}.bg{position:fixed;inset:0;overflow:hidden;background:radial-gradient(circle at 75% 0,#7047c52e,transparent 32%),radial-gradient(circle at 5% 90%,#06b6d41c,transparent 30%),#090a12;z-index:-1}.bg:before{content:'';position:absolute;inset:0;opacity:.17;background-image:linear-gradient(#fff1 1px,transparent 1px),linear-gradient(90deg,#fff1 1px,transparent 1px);background-size:55px 55px;mask-image:linear-gradient(#000,transparent 80%)}.orb{position:absolute;border-radius:50%;filter:blur(5px);animation:drift 14s ease-in-out infinite alternate}.a{width:410px;height:410px;right:-120px;top:-180px;background:#8b5cf64c}.b{width:300px;height:300px;left:-120px;bottom:0;background:#06b6d42b;animation-delay:-6s}@keyframes drift{to{transform:translate(27px,20px) scale(1.08)}}.auth-head,.picker-head{display:flex;justify-content:space-between;align-items:center;padding:30px 5.5vw}.logo{display:flex;align-items:center;gap:10px;direction:ltr}.mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid #a78bfa80;border-radius:11px;background:linear-gradient(140deg,#8b5cf6,#4338ca);font:700 20px 'Space Grotesk';box-shadow:0 0 25px #7c3aed66}.logo strong,.logo span{display:block;font:700 16px 'Space Grotesk';letter-spacing:.18em}.logo span{margin-top:3px;color:#a78bfa;font-size:8px;letter-spacing:.34em}.pill{padding:8px 14px;border:1px solid #a78bfa33;border-radius:100px;color:#cbc4f6;background:#8b5cf60d;font-size:11px}.dot{display:inline-block;width:7px;height:7px;margin-left:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80}.auth{display:grid;grid-template-columns:1.15fr .85fr;gap:9vw;max-width:1180px;padding:10vh 5.5vw 8vh;margin:auto;align-items:center}.copy{animation:rise .7s both}.copy h1,.picker h1{margin:20px 0;font-size:clamp(44px,5.5vw,76px);line-height:1.05;letter-spacing:-.06em}.copy h1 em,.picker h1 em{color:#a78bfa;font-style:normal;text-shadow:0 0 30px #8b5cf655}.eyebrow{color:#a78bfa;font-size:12px}.copy p{max-width:530px;color:#9999ae;font-size:16px;line-height:2}.metrics{display:flex;gap:38px;margin-top:55px}.metrics strong,.metrics span{display:block}.metrics strong{font:700 22px 'Space Grotesk'}.metrics span{margin-top:5px;color:#77788e;font-size:10px}.card{padding:40px;border:1px solid #fff14;border-radius:25px;background:#1b1a2bd1;box-shadow:0 25px 90px #0006,inset 0 1px #fff12;backdrop-filter:blur(20px);animation:rise .7s .12s both}.lock{display:grid;place-items:center;width:49px;height:49px;border-radius:15px;color:#c4b5fd;background:#8b5cf624;border:1px solid #a78bfa44;font-size:25px}.card h2{margin:25px 0 8px;font-size:25px}.muted{color:#85869c;line-height:1.8}.card .muted{margin-bottom:28px;font-size:13px}.primary,.secondary{width:100%;padding:14px;border-radius:11px;transition:.2s}.primary{color:#fff;background:#5865f2;box-shadow:0 12px 25px #5865f238}.primary:hover{transform:translateY(-2px);background:#6875ff}.secondary{margin-top:10px;color:#b7b5c9;background:transparent;font-size:12px}.secondary:hover{color:#fff;background:#fff0a}.divider{height:1px;margin:27px 0 20px;background:#fff12;text-align:center}.divider span{position:relative;top:-10px;padding:0 12px;color:#6f7085;background:#1b1a2b;font-size:10px}.note{text-align:center;color:#74768a;font-size:10px}.foot{display:flex;justify-content:center;gap:25px;color:#66677a;font-size:10px}.picker{max-width:850px;margin:7vh auto;padding:0 25px 60px;text-align:center}.picker h1{font-size:clamp(42px,6vw,70px)}.picker .muted{margin-bottom:12px}.demo{display:inline-block;padding:7px 11px;margin-bottom:24px;border:1px solid #06b6d430;border-radius:100px;color:#72cbd8;background:#06b6d40f;font-size:10px}.servers{display:grid;gap:11px;text-align:right}.server,.add{display:flex;align-items:center;gap:15px;width:100%;padding:16px 20px;border:1px solid #fff17;border-radius:16px;color:#fff;background:#151625c7;text-align:right;transition:.2s}.server:hover{transform:translateX(-5px);border-color:#a78bfa70;background:#251f3ecc}.server .avatar,.add .avatar{width:49px;height:49px}.avatar{display:grid;place-items:center;border-radius:14px;color:#fff;background:linear-gradient(140deg,#8b5cf6,#4338ca);font:700 15px 'Space Grotesk'}.cyan{background:linear-gradient(140deg,#06b6d4,#155e75)}.amber{background:linear-gradient(140deg,#f59e0b,#b45309)}.info{flex:1}.info strong,.info span,.info small{display:block}.info strong{font:600 14px 'Space Grotesk';letter-spacing:.05em}.info span,.info small{margin-top:5px;color:#76788d;font-size:10px}.state{color:#78d995;font-size:10px}.app{display:flex;min-height:100vh}.side{display:flex;flex-direction:column;width:252px;flex-shrink:0;padding:25px 15px 15px;border-left:1px solid #fff10d;background:#0d0e19e5;backdrop-filter:blur(18px)}.side .logo{padding:0 8px 27px}.switch{display:flex;align-items:center;gap:10px;padding:9px;border:1px solid #fff114;border-radius:12px;color:#fff;background:#fff0a;text-align:right}.switch .avatar{width:32px;height:32px;border-radius:10px;font-size:10px}.switch .info{text-align:right}.switch .info strong{font-size:10px}.switch .info span{font-size:9px}.nav{flex:1;padding-top:25px}.label{padding:12px;color:#5f6074;font-size:10px}.nav button{display:flex;align-items:center;gap:11px;width:100%;padding:10px 13px;margin:2px 0;border-radius:9px;color:#85869b;background:transparent;text-align:right;font-size:11px}.nav button:hover,.nav button.active{color:#f4f1ff;background:#8b5cf617}.nav button.active{box-shadow:inset 2px 0 #a78bfa}.nav button b:first-child{width:18px;color:#aaa0d8;font:15px 'Space Grotesk'}.nav button b:last-child{margin-right:auto;padding:2px 7px;border-radius:6px;color:#decfff;background:#8b5cf640;font-size:9px}.side-bottom{display:grid;gap:12px}.upgrade{padding:14px;border:1px solid #a78bfa2e;border-radius:13px;background:#7c3aed2d}.upgrade strong,.upgrade span{display:block}.upgrade strong{font-size:11px}.upgrade span{margin-top:5px;color:#8c8ca0;font-size:9px}.profile{display:flex;align-items:center;gap:9px;padding:4px;color:#fff}.profile .info strong{font-size:11px}.profile .info span{font-size:9px}.main{flex:1;min-width:0}.topbar{display:flex;justify-content:space-between;align-items:center;height:76px;padding:0 35px;border-bottom:1px solid #fff10d;background:#090a1266;backdrop-filter:blur(16px)}.crumb{color:#77788c;font-size:10px}.search{padding:9px 12px;border:1px solid #fff114;border-radius:9px;color:#77788c;background:#fff109;font-size:10px}.content{max-width:1440px;padding:43px 35px 60px;margin:auto}.heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:28px}.heading h1{margin:8px 0 5px;font-size:29px;letter-spacing:-.05em}.heading p{margin:0;font-size:11px}.cta{padding:11px 15px;border-radius:9px;color:#fff;background:#7c3aed;box-shadow:0 7px 20px #7c3aed40;font-size:10px}.live{display:flex;align-items:center;gap:11px;padding:14px 17px;margin-bottom:14px;border:1px solid #4ade8024;border-radius:12px;background:#22c55e0d}.live strong,.live span{display:block}.live strong{color:#a8e9ba;font-size:11px}.live span{color:#6c9a78;font-size:9px}.spacer{margin-right:auto}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:14px}.stat,.panel{border:1px solid #fff10d;border-radius:14px;background:#121320b3}.stat{display:flex;gap:12px;padding:17px}.stat-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:#c4b5fd;background:#8b5cf626}.stat span,.stat strong,.stat small{display:block}.stat span{color:#85869b;font-size:9px}.stat strong{margin:5px 0 3px;font:21px 'Space Grotesk'}.stat small{color:#76d695;font:10px 'Space Grotesk'}.layout{display:grid;grid-template-columns:1.55fr 1fr;gap:14px;margin-bottom:14px}.panel{padding:20px}.panel h3{margin:0 0 4px;font-size:13px}.sub{color:#74758a;font-size:9px}.barhead{display:flex;justify-content:space-between;margin-bottom:20px}.chart{height:200px;background:repeating-linear-gradient(to bottom,transparent 0 39px,#fff10d 40px);position:relative}.line{position:absolute;inset:25px 0;background:linear-gradient(150deg,transparent 0 15%,#8b5cf630 16% 17%,transparent 18% 32%,#8b5cf630 33% 34%,transparent 35% 51%,#8b5cf630 52% 53%,transparent 54% 68%,#8b5cf630 69% 70%,transparent 71%);clip-path:polygon(0 75%,14% 63%,28% 72%,41% 30%,56% 49%,70% 18%,82% 43%,94% 12%,100% 20%,100% 100%,0 100%)}.score{display:flex;align-items:center;gap:16px;padding-bottom:20px;border-bottom:1px solid #fff10d}.ring{display:grid;place-items:center;width:90px;height:90px;border-radius:50%;background:conic-gradient(#8b5cf6 0 94%,#28253d 94%);font:22px 'Space Grotesk'}.ring small{font-size:9px;color:#77788e}.rows{padding-top:8px}.row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #fff10d;font-size:10px}.toggle{width:29px;height:17px;border-radius:20px;background:#7c3aed;padding:2px}.toggle.off{background:#3a3b4e}.toggle i{display:block;width:13px;height:13px;border-radius:50%;background:#fff;transition:.2s}.toggle.off i{transform:translateX(12px)}.activity div{padding:12px 0;border-bottom:1px solid #fff10d;color:#a5a4b7;font-size:10px}.activity small{display:block;margin-top:4px;color:#6e6f84;font-size:8px}@keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@media(max-width:900px){.auth{grid-template-columns:1fr;gap:40px}.stats{grid-template-columns:repeat(2,1fr)}.layout{grid-template-columns:1fr}.side{width:72px;padding:20px 9px}.side .logo div:last-child,.switch .info,.label,.nav button span,.nav button b:last-child,.upgrade,.profile .info{display:none}.side .logo{justify-content:center}.switch{justify-content:center}.nav button{justify-content:center}.content{padding:28px 15px}.topbar{padding:0 15px}.copy h1{font-size:48px}}
</style></head><body><div id="view"></div><script>
let selectedGuildId = null;const icon={overview:'▦',security:'◇',moderation:'◈',tickets:'□',members:'○',welcome:'✦',roles:'◌',levels:'ϟ',logs:'≡',settings:'⚙'};const names={overview:'نظرة عامة',security:'الحماية',moderation:'الإشراف',tickets:'التذاكر',members:'الأعضاء',welcome:'الترحيب والمغادرة',roles:'الرتب والقنوات',levels:'مستويات XP',logs:'السجلات',settings:'الإعدادات'};let current='overview';
function bg(){return '<div class="bg"><div class="orb a"></div><div class="orb b"></div></div>'}function logo(){return '<div class="logo"><div class="mark">⌘</div><div><strong>NEXUS</strong><span>CONTROL</span></div></div>'}function login(){return bg()+'<header class="auth-head">'+logo()+'<div class="pill"><span class="dot"></span>الأنظمة تعمل بكفاءة</div></header><main class="auth"><section class="copy"><div class="eyebrow">✦ مركز التحكم الجديد</div><h1>سيطر على سيرفرك<br><em>بشكل مختلف.</em></h1><p>إدارة ذكية، حماية متقدمة، وتجربة مصممة لتجعل كل قرار داخل سيرفرك أسرع وأوضح.</p><div class="metrics"><div><strong>99.98%</strong><span>استقرار الحماية</span></div><div><strong>24/7</strong><span>مراقبة مستمرة</span></div><div><strong>10+</strong><span>أنظمة متكاملة</span></div></div></section><section class="card"><div class="lock">⌑</div><h2>مرحبًا بك في NEXUS</h2><p class="muted">سجل دخولك للبدء بإدارة سيرفرك من مساحة واحدة.</p><button class="primary" onclick="location.href=&quot;/auth/discord&quot;">تسجيل الدخول عبر Discord</button><button class="secondary" onclick="location.href=&quot;/servers&quot;">استكشاف نسخة العرض</button><div class="divider"><span>آمن ومشفّر</span></div><div class="note">لا نطلب كلمة مرور Discord الخاصة بك</div></section></main><footer class="foot">© 2026 NEXUS CONTROL　 ·　 مركز المساعدة　 ·　 سياسة الخصوصية</footer>'}
function servers(){return bg()+'<header class="picker-head">'+logo()+'<button class="secondary" style="width:auto;margin:0" onclick="location.href="/"">العودة</button></header><main class="picker"><div class="eyebrow">▣ مساحة السيرفرات</div><h1>اختر السيرفر الذي<br><em>تريد إدارته.</em></h1><p class="muted">هذه هي السيرفرات الحقيقية التي تملكها أو تملك صلاحية إدارتها.</p><div class="demo">مرتبط بحساب Discord الحقيقي</div><div class="servers" id="serversList"><div class="muted">جارٍ جلب السيرفرات...</div></div></main>'}
function side(){return '<aside class="side">'+logo()+'<button class="switch"><div class="avatar">NC</div><div class="info"><strong>NEXUS COMMUNITY</strong><span>السيرفر الرئيسي</span></div></button><nav class="nav"><div class="label">الرئيسية</div>'+Object.keys(names).map(k=>'<button class="'+(k===current?'active':'')+'" onclick="go(&quot;'+k+'&quot;)"><b>'+icon[k]+'</b><span>'+names[k]+'</span>'+(k==='tickets'?'<b>7</b>':'')+'</button>').join('')+'</nav><div class="side-bottom"><div class="upgrade"><strong>ارفع مستوى التحكم</strong><span>فعّل أدوات أكثر لسيرفرك.</span></div><div class="profile"><div class="avatar">A</div><div class="info"><strong>Admin User</strong><span>المالك</span></div></div></div></aside>'}
function dashboard(){return bg()+'<div class="app">'+side()+'<div class="main"><header class="topbar"><div class="crumb">السيرفرات　‹　NEXUS COMMUNITY　‹　'+names[current]+'</div><button class="search">بحث سريع　⌘ K</button></header><main class="content"><div class="heading"><div><div class="eyebrow">'+icon[current]+' وحدة '+names[current]+'</div><h1>'+ (current==='overview'?'صباح الخير، Admin .':names[current])+'</h1><p class="muted">'+(current==='overview'?'هذه هي الصورة الكاملة لنشاط سيرفرك اليوم.':'تحكم بكل إعدادات هذه الوحدة من مساحة واضحة وسريعة.')+'</p></div><button class="cta" onclick="saveSetting()">+　حفظ الإعدادات</button></div>'+ (current==='overview'?overview():generic())+'</main></div></div>'}
function overview(){return '<div class="live"><span class="dot"></span><div><strong>كل الأنظمة تعمل بشكل طبيعي</strong><span>آخر فحص شامل منذ 14 ثانية</span></div><div class="spacer"></div><b>0 تهديدات نشطة　 99.9% جاهزية</b></div><div class="stats"><div class="stat"><div class="stat-icon">○</div><div><span>إجمالي الأعضاء</span><strong>24,892</strong><small>+12.4%</small></div></div><div class="stat"><div class="stat-icon">◒</div><div><span>النشاط اليومي</span><strong>8,641</strong><small>+8.2%</small></div></div><div class="stat"><div class="stat-icon">□</div><div><span>التذاكر المفتوحة</span><strong>07</strong><small>+2</small></div></div><div class="stat"><div class="stat-icon">◇</div><div><span>حالة الحماية</span><strong>محمية</strong><small>مستقرة</small></div></div></div><div class="layout"><section class="panel"><div class="barhead"><div><h3>نشاط السيرفر</h3><span class="sub">حركة الأعضاء والرسائل خلال الأسبوع</span></div><button class="search">آخر 7 أيام</button></div><div class="chart"><div class="line"></div></div></section><section class="panel"><div class="barhead"><div><h3>حالة الحماية</h3><span class="sub">التحكم السريع بالأنظمة</span></div></div><div class="score"><div class="ring">94<small>/100</small></div><div><strong>مستوى ممتاز</strong><div class="sub">سيرفرك محمي حاليًا</div></div></div><div class="rows"><div class="row">الحماية المتقدمة <button class="toggle" data-setting="antiNuke" onclick="toggleSetting(this)"><i></i></button></div><div class="row">منع الروابط <button class="toggle" data-setting="antiLinks" onclick="toggleSetting(this)"><i></i></button></div><div class="row">مكافحة السبام <button class="toggle" data-setting="antiSpam" onclick="toggleSetting(this)"><i></i></button></div></div></section></div><div class="layout"><section class="panel"><div class="barhead"><div><h3>آخر النشاطات</h3><span class="sub">كل ما حدث في سيرفرك</span></div></div><div class="activity"><div>تم حظر رابط غير موثوق<small>تمت إزالته تلقائيًا · قبل 4 دقائق</small></div><div>انضمام عضو جديد<small>@pixel_sage · قبل 12 دقيقة</small></div><div>تم إغلاق تذكرة الدعم<small>بواسطة @admin · قبل 24 دقيقة</small></div></div></section><section class="panel"><div class="barhead"><div><h3>الأعضاء الأكثر نشاطًا</h3><span class="sub">هذا الأسبوع</span></div></div><div class="activity"><div>Lunar<small>المستوى 20 · 12,480 XP</small></div><div>pixel_sage<small>المستوى 19 · 10,920 XP</small></div><div>Raven.exe<small>المستوى 18 · 9,640 XP</small></div></div></section></div>'}
function generic(){return '<div class="panel" style="min-height:480px"><div style="display:flex;align-items:center;gap:18px;padding:20px 0 28px;border-bottom:1px solid #fff10d"><div class="lock">'+icon[current]+'</div><div><h2>كل شيء تحت سيطرتك.</h2><p class="muted">هذه الوحدة جاهزة لإدارة إعدادات '+names[current]+' مع تحديثات مباشرة وسجل كامل لكل تغيير.</p></div></div><div class="rows"><div class="row">الحماية الأساسية <i class="toggle"><i></i></i></div><div class="row">إشعارات الإدارة <i class="toggle"><i></i></i></div><div class="row">صلاحيات فريق الدعم <i class="toggle"><i></i></i></div><div class="row">التنبيهات المباشرة <i class="toggle"><i></i></i></div></div></div>'}
async function loadGuilds(){const box=document.getElementById('serversList');if(!box)return;const response=await fetch('/api/guilds');if(response.status===401){box.innerHTML='<div class="card"><h2>انتهت الجلسة</h2><p class="muted">سجل دخولك عبر Discord لمشاهدة سيرفراتك الحقيقية.</p><button class="primary" onclick="location.href="/auth/discord"">تسجيل الدخول</button></div>';return}const data=await response.json();if(!data.guilds?.length){box.innerHTML='<div class="card"><h2>لا توجد سيرفرات قابلة للإدارة</h2><p class="muted">يجب أن تكون مالك السيرفر أو تملك صلاحية Manage Server.</p></div>';return}box.innerHTML=data.guilds.map(g=>'<button class="server" onclick="selectGuild(\''+g.id+'\')"><div class="avatar">'+(g.icon?'':'NC')+'</div><div class="info"><strong>'+g.name+'</strong><span>'+ (g.botInstalled?'البوت متصل':'البوت غير مضاف') +'</span></div><div class="state"><span class="dot"></span>'+(g.botInstalled?'جاهز للإدارة':'يحتاج إضافة البوت')+'</div><b>‹</b></button>').join('')}
async function loadSettings(){if(!selectedGuildId)return;try{const response=await fetch('/api/settings/'+selectedGuildId);if(response.status===401){location.href='/auth/discord';return}const data=await response.json();document.querySelectorAll('[data-setting]').forEach(el=>{el.classList.toggle('off',data[el.dataset.setting]===false)})}catch(e){console.warn('settings load failed',e)}}async function toggleSetting(el){el.classList.toggle('off');const payload={};document.querySelectorAll('[data-setting]').forEach(item=>payload[item.dataset.setting]=!item.classList.contains('off'));await fetch('/api/settings/'+selectedGuildId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>null)}async function saveSetting(){const payload={};document.querySelectorAll('[data-setting]').forEach(item=>payload[item.dataset.setting]=!item.classList.contains('off'));const response=await fetch('/api/settings/'+selectedGuildId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>null);if(response&&response.ok)alert('تم حفظ إعدادات البوت بنجاح.')}function selectGuild(id){selectedGuildId=id;history.pushState({},'', '/dashboard/'+encodeURIComponent(id)+'/overview');render()}function go(section){history.pushState({},'', '/dashboard/'+encodeURIComponent(selectedGuildId)+'/'+section);render()}function render(){const path=location.pathname;if(path==='/'||path==='/login')document.getElementById('view').innerHTML=login();else if(path==='/servers'){document.getElementById('view').innerHTML=servers();loadGuilds()}else{const match=path.match(/^\/dashboard\/([^/]+)\/([^/]+)$/);if(!match){location.href='/servers';return}selectedGuildId=decodeURIComponent(match[1]);current=names[match[2]]?match[2]:'overview';document.getElementById('view').innerHTML=dashboard();loadSettings()}}window.onpopstate=render;render();
</script></body></html>`;

// ============================================================
// API الداشبورد ومسارات Render
// ============================================================
app.use(express.json());
app.get("/", (_req, res) => res.send(dashboard));
app.get("/login", (_req, res) => res.send(dashboard));
app.get("/servers", (_req, res) => res.send(dashboard));
app.get("/auth/discord", (req, res) => {
  if (!oauthConfigured()) return res.status(500).send("Discord OAuth غير مهيأ: أضف DISCORD_CLIENT_SECRET وDISCORD_REDIRECT_URI وSESSION_SECRET.");
  const state = crypto.randomBytes(24).toString("hex");
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  setCookie(res, OAUTH_STATE_COOKIE, state, 600);
  res.redirect(oauthUrl(state));
});
app.get("/auth/discord/callback", async (req, res) => {
  try {
    const state = String(req.query.state || "");
    const expected = parseCookies(req)[OAUTH_STATE_COOKIE];
    const expiresAt = oauthStates.get(state);
    if (!state || state !== expected || !expiresAt || expiresAt < Date.now()) return res.status(400).send("OAuth state غير صالح أو منتهي.");
    oauthStates.delete(state);
    const token = await exchangeOAuthCode(String(req.query.code || ""));
    const user = await discordRequest("/users/@me", token.access_token);
    const guilds = await discordRequest("/users/@me/guilds", token.access_token);
    const sessionId = crypto.randomBytes(32).toString("hex");
    sessions.set(sessionId, { id: user.id, user, guilds, accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + (token.expires_in || 604800) * 1000 });
    setCookie(res, SESSION_COOKIE, signedSessionId(sessionId), 7 * 86400);
    clearCookie(res, OAUTH_STATE_COOKIE);
    res.redirect("/servers");
  } catch (error) {
    console.error("Discord OAuth callback failed:", error.message);
    res.status(502).send("تعذر إكمال تسجيل الدخول عبر Discord.");
  }
});
app.get("/auth/logout", (req, res) => { const id = verifiedSessionId(parseCookies(req)[SESSION_COOKIE]); if (id) sessions.delete(id); clearCookie(res, SESSION_COOKIE); res.redirect("/"); });
app.get("/api/me", (req, res) => { const session = sessionFromRequest(req); if (!session) return res.status(401).json({ authenticated: false }); res.json({ authenticated: true, user: session.user }); });
app.get("/api/guilds", (req, res) => { const session = requireSession(req, res); if (!session) return; const guilds = managedGuilds(session).map(g => ({ ...g, botInstalled: client.guilds.cache.has(g.id) })); res.json({ guilds }); });
app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    bot: client.isReady() ? "ready" : "starting",
    uptime: process.uptime(),
  }),
);
app.get("/api/status", (_req, res) =>
  res.json({
    online: client.isReady(),
    guilds: client.guilds.cache.size,
    commands: commands.length,
  }),
);
app.get("/api/settings/:guildId", (req, res) => { const session = requireSession(req, res); if (!session) return; if (!managedGuilds(session).some(g => g.id === req.params.guildId)) return res.status(403).json({ error: "forbidden" }); res.json(getSettings(req.params.guildId)); });
app.post("/api/settings/:guildId", (req, res) => { const session = requireSession(req, res); if (!session) return; if (!managedGuilds(session).some(g => g.id === req.params.guildId)) return res.status(403).json({ error: "forbidden" });
  const current = getSettings(req.params.guildId);
  const allowed = [
    "antiSpam",
    "antiLinks",
    "antiNuke",
    "xp",
    "welcome",
    "logChannelId",
    "welcomeChannelId",
    "autoRoleId",
    "ticketCategoryId",
    "mutedRoleId",
  ];
  for (const key of allowed)
    if (req.body[key] !== undefined) current[key] = req.body[key];
  res.json({ ok: true, settings: current });
});
// Regex catch-all works with Express 4 and Express 5 and supports direct dashboard reloads.
app.get(/.*/, (_req, res) => res.send(dashboard));
// ============================================================
// تشغيل Health Check والخدمات
// ============================================================
app.listen(PORT, () =>
  console.log(`Health dashboard listening on port ${PORT}`),
);
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "NEXUS CONTROL | /config", type: 3 }],
    status: "online",
  });
  await registerCommands().catch((e) =>
    console.error("Command registration failed:", e.message),
  );
});
process.on("unhandledRejection", (e) =>
  console.error("Unhandled rejection:", e),
);
process.on("uncaughtException", (e) => console.error("Uncaught exception:", e));
if (TOKEN)
  client
    .login(TOKEN)
    .catch((e) => console.error("Discord login failed:", e.message));
else console.error("Missing DISCORD_TOKEN environment variable.");
