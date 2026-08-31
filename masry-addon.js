const {
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  AuditLogEvent
} = require('discord.js');

module.exports = function installMasryAddon({ app, client, mongoose, checkAuth, ui, commands }) {
  const Schema = mongoose.Schema;
  const BoostConfig = mongoose.models.MasryBoostConfig || mongoose.model('MasryBoostConfig', new Schema({
    guildId: { type: String, unique: true },
    enabled: { type: Boolean, default: false },
    channelId: String,
    color: { type: String, default: '#8b5cf6' },
    emoji: { type: String, default: '💜' },
    title: { type: String, default: 'شكراً على دعمك لسيرفرنا' },
    description: { type: String, default: 'شكراً {user} على دعمك لـ {server}! وجودك معنا يعني الكثير.' },
    footer: { type: String, default: 'بدعمكم نكبر ونستمر' },
    imageUrl: String,
    sendDm: { type: Boolean, default: false }
  }, { timestamps: true }));

  const LogConfig = mongoose.models.MasryLogConfig || mongoose.model('MasryLogConfig', new Schema({
    guildId: { type: String, unique: true },
    enabled: { type: Boolean, default: true },
    channelId: String,
    includeContent: { type: Boolean, default: true },
    batchDeletes: { type: Boolean, default: true },
    categories: { type: Map, of: Boolean, default: {} }
  }, { timestamps: true }));

  const LanguageConfig = mongoose.models.MasryLanguageConfig || mongoose.model('MasryLanguageConfig', new Schema({
    guildId: { type: String, unique: true },
    locale: { type: String, default: 'ar' }
  }));

  const dictionaries = {
    ar: { boostTitle: 'شكراً على دعمك لسيرفرنا', boostBody: 'شكراً {user} على دعمك لـ {server}! وجودك معنا يعني الكثير.', boostField: 'الدعم', boostValue: 'Boost جديد', level: 'مستوى السيرفر', thanks: 'بدعمكم نكبر ونستمر', saved: 'تم حفظ الإعدادات بنجاح.', noConfig: 'لم يتم إعداد هذا النظام بعد.', onlyAdmin: 'هذا الأمر مخصص للإدارة فقط.' },
    en: { boostTitle: 'Thank you for supporting our server', boostBody: 'Thank you {user} for boosting {server}! Your support means a lot.', boostField: 'Support', boostValue: 'New Boost', level: 'Server level', thanks: 'We grow with your support', saved: 'Settings saved successfully.', noConfig: 'This system has not been configured yet.', onlyAdmin: 'This command is for server staff only.' },
    fr: { boostTitle: 'Merci de soutenir notre serveur', boostBody: 'Merci {user} pour le boost de {server} ! Votre soutien compte beaucoup.', boostField: 'Soutien', boostValue: 'Nouveau boost', level: 'Niveau du serveur', thanks: 'Nous grandissons grâce à vous', saved: 'Paramètres enregistrés.', noConfig: 'Ce système n’est pas encore configuré.', onlyAdmin: 'Cette commande est réservée au staff.' },
    es: { boostTitle: 'Gracias por apoyar nuestro servidor', boostBody: 'Gracias {user} por mejorar {server}. ¡Tu apoyo significa mucho!', boostField: 'Apoyo', boostValue: 'Nuevo boost', level: 'Nivel del servidor', thanks: 'Crecemos con vuestro apoyo', saved: 'Configuración guardada.', noConfig: 'Este sistema aún no está configurado.', onlyAdmin: 'Este comando es solo para el equipo.' },
    de: { boostTitle: 'Danke für deine Unterstützung', boostBody: 'Danke {user} für den Boost von {server}! Deine Unterstützung bedeutet uns viel.', boostField: 'Unterstützung', boostValue: 'Neuer Boost', level: 'Server-Level', thanks: 'Wir wachsen mit eurer Unterstützung', saved: 'Einstellungen gespeichert.', noConfig: 'Dieses System wurde noch nicht eingerichtet.', onlyAdmin: 'Dieser Befehl ist nur für das Team.' },
    tr: { boostTitle: 'Sunucumuzu desteklediğin için teşekkürler', boostBody: '{server} sunucusuna boost attığın için teşekkürler {user}!', boostField: 'Destek', boostValue: 'Yeni Boost', level: 'Sunucu seviyesi', thanks: 'Desteğinizle büyüyoruz', saved: 'Ayarlar kaydedildi.', noConfig: 'Bu sistem henüz ayarlanmadı.', onlyAdmin: 'Bu komut sadece yetkililer içindir.' }
  };
  const flags = { ar: '🇸🇦', en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸', de: '🇩🇪', tr: '🇹🇷' };
  const localeName = { ar: 'العربية', en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch', tr: 'Türkçe' };
  const getLocale = async guildId => (await LanguageConfig.findOne({ guildId }))?.locale || 'ar';
  const translate = (locale, key) => (dictionaries[locale] || dictionaries.ar)[key] || dictionaries.ar[key] || key;
  const replaceVars = (text, guild, user) => String(text || '').replaceAll('{user}', `<@${user.id}>`).replaceAll('{username}', user.username).replaceAll('{server}', guild.name).replaceAll('{boosts}', String(guild.premiumSubscriptionCount || 0)).replaceAll('{total_boosts}', String(guild.premiumSubscriptionCount || 0)).replaceAll('{level}', String(guild.premiumTier || 0)).replaceAll('{member_count}', String(guild.memberCount || 0));
  const colorInt = hex => parseInt(String(hex || '#8b5cf6').replace('#', ''), 16) || 0x8b5cf6;

  const safe = value => String(value ?? 'غير متوفر').slice(0, 1024);
  async function findExecutor(guild, type, targetId) {
    try {
      const logs = await guild.fetchAuditLogs({ type, limit: 5 });
      const entry = logs.entries.find(e => !targetId || e.target?.id === targetId);
      return entry?.executor ? `<@${entry.executor.id}>` : 'غير معروف';
    } catch { return 'غير معروف'; }
  }

  async function enhancedLog(guild, category, title, color, fields, options = {}) {
    if (!guild) return;
    const cfg = await LogConfig.findOne({ guildId: guild.id });
    if (!cfg?.enabled || !cfg.channelId) return;
    if (cfg.categories?.get && cfg.categories.get(category) === false) return;
    const channel = guild.channels.cache.get(cfg.channelId) || await guild.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const id = `LOG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const embed = new EmbedBuilder().setTitle(`${options.icon || '◈'} ${title}`).setColor(color).setDescription(`معرّف الحدث: \`${id}\``).addFields(fields.map(f => ({ name: String(f.name).slice(0, 256), value: safe(f.value), inline: !!f.inline }))).setFooter({ text: 'مصري بوت • سجل تدقيق متقدم' }).setTimestamp();
    if (options.url) embed.setURL(options.url);
    await channel.send({ embeds: [embed] }).catch(() => null);
  }

  async function sendBoostThankYou(guild, member) {
    const cfg = await BoostConfig.findOne({ guildId: guild.id });
    if (!cfg?.enabled || !cfg.channelId) return;
    const locale = await getLocale(guild.id);
    const channel = guild.channels.cache.get(cfg.channelId) || await guild.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const title = cfg.title || translate(locale, 'boostTitle');
    const description = cfg.description || translate(locale, 'boostBody');
    const embed = new EmbedBuilder().setColor(colorInt(cfg.color)).setTitle(`${cfg.emoji || '💜'} ${replaceVars(title, guild, member.user)}`).setDescription(replaceVars(description, guild, member.user)).addFields({ name: translate(locale, 'boostField'), value: translate(locale, 'boostValue'), inline: true }, { name: translate(locale, 'level'), value: `Level ${guild.premiumTier || 0}`, inline: true }).setFooter({ text: cfg.footer || translate(locale, 'thanks') }).setTimestamp();
    if (cfg.imageUrl) embed.setImage(cfg.imageUrl);
    else if (member.user.displayAvatarURL) embed.setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
    await channel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => null);
    if (cfg.sendDm) member.send({ embeds: [embed] }).catch(() => null);
    await enhancedLog(guild, 'boost', 'دعم جديد للسيرفر', 0x8b5cf6, [{ name: 'الداعم', value: `<@${member.id}>`, inline: true }, { name: 'إجمالي البوستات', value: String(guild.premiumSubscriptionCount || 0), inline: true }], { icon: '💜' });
  }

  const newCommands = [
    new SlashCommandBuilder().setName('boost').setDescription('إدارة رسائل شكر دعم السيرفر').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addSubcommand(s => s.setName('setup').setDescription('إعداد نظام الشكر').addChannelOption(o => o.setName('channel').setDescription('قناة الشكر').addChannelTypes(ChannelType.GuildText).setRequired(true)).addStringOption(o => o.setName('emoji').setDescription('الإيموجي المستخدم')).addStringOption(o => o.setName('color').setDescription('لون بصيغة HEX')).addStringOption(o => o.setName('title').setDescription('عنوان الرسالة'))).addSubcommand(s => s.setName('test').setDescription('إرسال رسالة اختبار')).addSubcommand(s => s.setName('disable').setDescription('تعطيل النظام')).addSubcommand(s => s.setName('stats').setDescription('عرض إحصائيات الدعم')),
    new SlashCommandBuilder().setName('logs').setDescription('إدارة السجلات المتقدمة').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addSubcommand(s => s.setName('setup').setDescription('تحديد قناة اللوق').addChannelOption(o => o.setName('channel').setDescription('قناة السجلات').addChannelTypes(ChannelType.GuildText).setRequired(true))).addSubcommand(s => s.setName('test').setDescription('اختبار اللوق')),
    new SlashCommandBuilder().setName('language').setDescription('اختيار لغة البوت').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addStringOption(o => o.setName('locale').setDescription('اللغة').setRequired(true).addChoices(...Object.entries(localeName).map(([value, name]) => ({ name: `${flags[value]} ${name}`, value })))),
    new SlashCommandBuilder().setName('server-info').setDescription('عرض معلومات السيرفر'),
    new SlashCommandBuilder().setName('user-history').setDescription('عرض سجل عضو').addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
  ];
  newCommands.forEach(c => commands.push(c.toJSON()));

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if ((newMember.premiumSince && !oldMember.premiumSince) || (!oldMember.premiumSince && newMember.premiumSince)) await sendBoostThankYou(newMember.guild, newMember);
    if (oldMember.nickname !== newMember.nickname) await enhancedLog(newMember.guild, 'members', 'تغيير اسم عضو', 0x38bdf8, [{ name: 'العضو', value: `<@${newMember.id}>`, inline: true }, { name: 'قبل', value: oldMember.nickname || oldMember.user.username, inline: true }, { name: 'بعد', value: newMember.nickname || newMember.user.username, inline: true }], { icon: '✎' });
    const oldRoles = new Set(oldMember.roles.cache.keys()); const newRoles = new Set(newMember.roles.cache.keys());
    const added = [...newRoles].filter(id => !oldRoles.has(id) && id !== newMember.guild.id); const removed = [...oldRoles].filter(id => !newRoles.has(id) && id !== newMember.guild.id);
    if (added.length || removed.length) await enhancedLog(newMember.guild, 'roles', 'تغيير رتب عضو', 0xf59e0b, [{ name: 'العضو', value: `<@${newMember.id}>` }, { name: 'تمت الإضافة', value: added.map(id => `<@&${id}>`).join(', ') || 'لا يوجد', inline: true }, { name: 'تمت الإزالة', value: removed.map(id => `<@&${id}>`).join(', ') || 'لا يوجد', inline: true }], { icon: '◆' });
  });

  client.on('messageDelete', async message => {
    if (!message.guild || message.author?.bot) return;
    const cfg = await LogConfig.findOne({ guildId: message.guild.id });
    if (cfg?.includeContent === false) return enhancedLog(message.guild, 'messages', 'حذف رسالة', 0xef4444, [{ name: 'الكاتب', value: message.author ? `<@${message.author.id}>` : 'غير معروف' }, { name: 'القناة', value: `<#${message.channel.id}>` }, { name: 'المحتوى', value: 'مخفي حسب إعدادات الخصوصية' }], { icon: '🗑️' });
    await enhancedLog(message.guild, 'messages', 'حذف رسالة', 0xef4444, [{ name: 'الكاتب', value: message.author ? `<@${message.author.id}>` : 'غير معروف' }, { name: 'القناة', value: `<#${message.channel.id}>` }, { name: 'المحتوى', value: message.content || 'لا يوجد محتوى محفوظ' }, { name: 'المرفقات', value: String(message.attachments?.size || 0) }], { icon: '🗑️' });
  });
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!newMessage.guild || oldMessage.content === newMessage.content || newMessage.author?.bot) return;
    await enhancedLog(newMessage.guild, 'messages', 'تعديل رسالة', 0xf59e0b, [{ name: 'الكاتب', value: newMessage.author ? `<@${newMessage.author.id}>` : 'غير معروف' }, { name: 'القناة', value: `<#${newMessage.channel.id}>` }, { name: 'قبل التعديل', value: oldMessage.content || 'فارغ' }, { name: 'بعد التعديل', value: newMessage.content || 'فارغ' }], { icon: '✎', url: newMessage.url });
  });
  client.on('guildMemberAdd', async member => enhancedLog(member.guild, 'members', 'دخول عضو', 0x22c55e, [{ name: 'العضو', value: `<@${member.id}>`, inline: true }, { name: 'عمر الحساب', value: ``, inline: true }], { icon: '↗' }));
  client.on('guildMemberRemove', async member => enhancedLog(member.guild, 'members', 'خروج عضو', 0xf97316, [{ name: 'العضو', value: `${member.user?.tag || member.id}` }, { name: 'الرتب السابقة', value: member.roles?.cache?.filter(r => r.id !== member.guild.id).map(r => r.name).join(', ') || 'لا يوجد' }], { icon: '↙' }));
  client.on('channelCreate', async channel => channel.guild && enhancedLog(channel.guild, 'channels', 'إنشاء قناة', 0x22c55e, [{ name: 'القناة', value: `<#${channel.id}>` }, { name: 'النوع', value: String(channel.type) }], { icon: '＋' }));
  client.on('channelDelete', async channel => channel.guild && enhancedLog(channel.guild, 'channels', 'حذف قناة', 0xef4444, [{ name: 'اسم القناة', value: channel.name }, { name: 'المعرّف', value: channel.id }], { icon: '−' }));
  client.on('roleCreate', async role => enhancedLog(role.guild, 'roles', 'إنشاء رتبة', 0x22c55e, [{ name: 'الرتبة', value: `<@&${role.id}>` }, { name: 'اللون', value: role.hexColor }], { icon: '◆' }));
  client.on('roleDelete', async role => enhancedLog(role.guild, 'roles', 'حذف رتبة', 0xef4444, [{ name: 'اسم الرتبة', value: role.name }, { name: 'المعرّف', value: role.id }], { icon: '◇' }));
  client.on('voiceStateUpdate', async (oldState, newState) => { if (oldState.channelId === newState.channelId) return; await enhancedLog(newState.guild, 'voice', 'تغيير حالة صوتية', 0x06b6d4, [{ name: 'العضو', value: `<@${newState.id}>` }, { name: 'قبل', value: oldState.channelId ? `<#${oldState.channelId}>` : 'خارج الصوتي' }, { name: 'بعد', value: newState.channelId ? `<#${newState.channelId}>` : 'خرج من الصوتي' }], { icon: '◉' }); });

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const locale = await getLocale(interaction.guild.id);
    const staff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (['boost', 'logs', 'language'].includes(interaction.commandName) && !staff) return interaction.reply({ content: translate(locale, 'onlyAdmin'), ephemeral: true });
    if (interaction.commandName === 'boost') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'setup') {
        const data = { guildId: interaction.guild.id, enabled: true, channelId: interaction.options.getChannel('channel').id, emoji: interaction.options.getString('emoji') || '💜', color: interaction.options.getString('color') || '#8b5cf6', title: interaction.options.getString('title') || translate(locale, 'boostTitle') };
        await BoostConfig.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: data }, { upsert: true });
        return interaction.reply({ content: translate(locale, 'saved'), ephemeral: true });
      }
      if (sub === 'disable') { await BoostConfig.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: { enabled: false } }, { upsert: true }); return interaction.reply({ content: 'تم تعطيل نظام شكر الـ Boost.', ephemeral: true }); }
      if (sub === 'test') { const member = await interaction.guild.members.fetch(interaction.user.id); await sendBoostThankYou(interaction.guild, member); return interaction.reply({ content: 'تم إرسال معاينة الشكر في القناة المحددة.', ephemeral: true }); }
      if (sub === 'stats') return interaction.reply({ embeds: [new EmbedBuilder().setTitle('إحصائيات دعم السيرفر').setColor(0x8b5cf6).setDescription(`إجمالي البوستات الحالية: **${interaction.guild.premiumSubscriptionCount || 0}**\nمستوى السيرفر: **${interaction.guild.premiumTier || 0}**`).setTimestamp()], ephemeral: true });
    }
    if (interaction.commandName === 'logs') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'setup') { await LogConfig.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: { enabled: true, channelId: interaction.options.getChannel('channel').id } }, { upsert: true }); return interaction.reply({ content: 'تم تفعيل اللوق المتطور وتحديد القناة.', ephemeral: true }); }
      if (sub === 'test') { await enhancedLog(interaction.guild, 'system', 'اختبار اللوق المتطور', 0x8b5cf6, [{ name: 'المنفذ', value: `<@${interaction.user.id}>` }, { name: 'النتيجة', value: 'النظام يعمل بنجاح' }], { icon: '✓' }); return interaction.reply({ content: 'تم إرسال اختبار اللوق.', ephemeral: true }); }
    }
    if (interaction.commandName === 'language') { const localeValue = interaction.options.getString('locale'); await LanguageConfig.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: { locale: localeValue } }, { upsert: true }); return interaction.reply({ content: `${flags[localeValue]} تم تغيير لغة البوت إلى **${localeName[localeValue]}**.`, ephemeral: true }); }
    if (interaction.commandName === 'server-info') { return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`معلومات ${interaction.guild.name}`).setColor(0x38bdf8).setThumbnail(interaction.guild.iconURL({ extension: 'png' })).addFields({ name: 'الأعضاء', value: String(interaction.guild.memberCount), inline: true }, { name: 'القنوات', value: String(interaction.guild.channels.cache.size), inline: true }, { name: 'الرتب', value: String(interaction.guild.roles.cache.size), inline: true }, { name: 'البوستات', value: String(interaction.guild.premiumSubscriptionCount || 0), inline: true }).setTimestamp()] }); }
    if (interaction.commandName === 'user-history') { const user = interaction.options.getUser('user'); const warns = await mongoose.models.Warn?.find({ guildId: interaction.guild.id, userId: user.id }).sort({ createdAt: -1 }).limit(10) || []; return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`السجل الإداري • ${user.tag}`).setColor(warns.length ? 0xef4444 : 0x22c55e).setDescription(warns.length ? warns.map((w, i) => `${i + 1}. ${w.reason || 'بدون سبب'} — `).join('\n') : 'لا توجد تحذيرات مسجلة.').setTimestamp()], ephemeral: true }); }
  });

  // Dashboard: Boost settings.
  app.get('/manage/:guildId/boost', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId); if (!guild) return res.redirect('/dashboard');
    const cfg = await BoostConfig.findOne({ guildId: guild.id }) || {};
    const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => `#${c.name}`).join('');
    const content = `
💜 MASRY BOOST
الشكر والتقدير
صمّم رسالة احترافية تظهر تلقائياً لكل شخص يدعم السيرفر.
إعدادات رسالة الـ Boost
قناة الشكر${channels}الإيموجي${cfg.emoji || '💜'} لون الرسالة${cfg.color || '#8b5cf6'} العنوان${cfg.title || ''} النص${cfg.description || ''}التذييل${cfg.footer || ''} حفظ وتفعيل النظام
`;
    res.send(ui(guild, 'boost', content));
  });
  app.post('/save/:guildId/boost', checkAuth, async (req, res) => { const guild = client.guilds.cache.get(req.params.guildId); if (!guild) return res.redirect('/dashboard'); await BoostConfig.findOneAndUpdate({ guildId: guild.id }, { $set: { guildId: guild.id, enabled: true, channelId: req.body.channelId, emoji: req.body.emoji || '💜', color: req.body.color || '#8b5cf6', title: req.body.title || '', description: req.body.description || '', footer: req.body.footer || '' } }, { upsert: true }); res.redirect(`/manage/${guild.id}/boost?saved=1`); });

  app.get('/manage/:guildId/language', checkAuth, async (req, res) => { const guild = client.guilds.cache.get(req.params.guildId); if (!guild) return res.redirect('/dashboard'); const current = await getLocale(guild.id); const options = Object.entries(localeName).map(([id, name]) => `${flags[id]} ${name}`).join(''); const content = `
🌐 MASRY LANGUAGE
لغة البوت
اختر اللغة التي تظهر بها رسائل البوت واللوحات داخل السيرفر.
اختيار اللغة
${options}حفظ اللغة
`; res.send(ui(guild, 'language', content)); });
  app.post('/save/:guildId/language', checkAuth, async (req, res) => { const guild = client.guilds.cache.get(req.params.guildId); if (!guild) return res.redirect('/dashboard'); const locale = dictionaries[req.body.locale] ? req.body.locale : 'ar'; await LanguageConfig.findOneAndUpdate({ guildId: guild.id }, { $set: { guildId: guild.id, locale } }, { upsert: true }); res.redirect(`/manage/${guild.id}/language?saved=1`); });

  app.get('/manage/:guildId/log-center', checkAuth, async (req, res) => { const guild = client.guilds.cache.get(req.params.guildId); if (!guild) return res.redirect('/dashboard'); const cfg = await LogConfig.findOne({ guildId: guild.id }) || {}; const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => `#${c.name}`).join(''); const content = `
◈ MASRY AUDIT CORE
مركز السجلات
كل تعديل، حذف، رتبة، قناة، عضو، دعم، وتغيير صوتي في مكان واحد.
إعدادات السجل المتقدم
قناة السجلات${channels}
إظهار محتوى الرسائل 
تجميع عمليات الحذف المتكررة 
حفظ إعدادات السجل
`; res.send(ui(guild, 'log-center', content)); });
  app.post('/save/:guildId/log-center', checkAuth, async (req, res) => { const guild = client.guilds.cache.get(req.params.guildId); if (!guild) return res.redirect('/dashboard'); await LogConfig.findOneAndUpdate({ guildId: guild.id }, { $set: { guildId: guild.id, enabled: true, channelId: req.body.channelId, includeContent: req.body.includeContent === 'on', batchDeletes: req.body.batchDeletes === 'on' } }, { upsert: true }); res.redirect(`/manage/${guild.id}/log-center?saved=1`); });

  console.log('[Masry Bot] Enhanced addon loaded: boost, i18n, slash, audit logs.');
};
