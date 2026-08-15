const {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { canUseStaffSystem, missingRoleMessage } = require("./permissions");

function getBrand(client) {
  return client.config.brand || {};
}

function getSetupConfig(client) {
  client.config.serverSetup = client.config.serverSetup || {};
  client.config.serverSetup.roles = client.config.serverSetup.roles || [];
  client.config.serverSetup.categories = client.config.serverSetup.categories || [];
  return client.config.serverSetup;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function parseColor(color) {
  if (!color || typeof color !== "string") return undefined;
  return color.startsWith("#") ? color : `#${color}`;
}

function channelTypeFromConfig(type) {
  if (type === "voice") return ChannelType.GuildVoice;
  if (type === "announcement") return ChannelType.GuildAnnouncement;
  return ChannelType.GuildText;
}

function formatCreatedList(items) {
  if (!items.length) return "Nada nuevo. Ya existia o fue reutilizado.";
  return items.map((item) => `• ${item}`).join("\n").slice(0, 1024);
}

function findRoleByName(guild, name) {
  const target = normalizeName(name);
  return guild.roles.cache.find((role) => normalizeName(role.name) === target) || null;
}

function findChannelByName(guild, name, parentId, type) {
  const target = normalizeName(name);
  return guild.channels.cache.find(
    (channel) =>
      normalizeName(channel.name) === target &&
      channel.type === type &&
      (!parentId || channel.parentId === parentId),
  ) || null;
}

async function ensureRole(guild, roleConfig) {
  const existing = findRoleByName(guild, roleConfig.name);
  if (existing) return { role: existing, created: false };

  const role = await guild.roles.create({
    name: roleConfig.name,
    color: parseColor(roleConfig.color),
    hoist: Boolean(roleConfig.hoist),
    mentionable: Boolean(roleConfig.mentionable),
    reason: "Setup automatico del servidor",
  });

  return { role, created: true };
}

function buildOverwrites(guild, setupConfig, channelConfig) {
  if (!channelConfig.private) return undefined;

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
  ];

  const staffNames = setupConfig.staffRoleNames || [];
  for (const roleName of staffNames) {
    const role = findRoleByName(guild, roleName);
    if (!role) continue;
    overwrites.push({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  return overwrites;
}

async function ensureCategory(guild, categoryConfig) {
  const existing = findChannelByName(guild, categoryConfig.name, null, ChannelType.GuildCategory);
  if (existing) return { category: existing, created: false };

  const category = await guild.channels.create({
    name: categoryConfig.name,
    type: ChannelType.GuildCategory,
    reason: "Setup automatico del servidor",
  });

  return { category, created: true };
}

async function ensureChannel(guild, category, setupConfig, channelConfig) {
  const type = channelTypeFromConfig(channelConfig.type);
  const existing = findChannelByName(guild, channelConfig.name, category.id, type);
  if (existing) return { channel: existing, created: false };

  const channel = await guild.channels.create({
    name: channelConfig.name,
    type,
    parent: category.id,
    topic: type === ChannelType.GuildText ? channelConfig.topic || undefined : undefined,
    permissionOverwrites: buildOverwrites(guild, setupConfig, channelConfig),
    reason: "Setup automatico del servidor",
  });

  return { channel, created: true };
}

function buildSetupEmbed(client, result) {
  const brand = getBrand(client);
  const embed = new EmbedBuilder()
    .setColor(brand.color || "#F54927")
    .setAuthor({ name: brand.name || "Discord Store Bot", iconURL: brand.logoUrl || undefined })
    .setTitle("Setup del servidor completado")
    .setDescription(
      [
        "La estructura base fue creada o verificada correctamente.",
        "Los elementos existentes fueron reutilizados para evitar duplicados.",
      ].join("\n"),
    )
    .addFields(
      { name: "Roles creados", value: formatCreatedList(result.rolesCreated), inline: false },
      { name: "Categorias creadas", value: formatCreatedList(result.categoriesCreated), inline: false },
      { name: "Canales creados", value: formatCreatedList(result.channelsCreated), inline: false },
      {
        name: "Resumen",
        value: [
          `**Roles revisados:** ${result.rolesChecked}`,
          `**Categorias revisadas:** ${result.categoriesChecked}`,
          `**Canales revisados:** ${result.channelsChecked}`,
        ].join("\n"),
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Setup del servidor" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  return embed;
}

async function serverSetupCommand(message) {
  if (!canUseStaffSystem(message.member, message.client, "serverSetup")) {
    return message.reply(missingRoleMessage(message.client, "serverSetup"));
  }

  const me = message.guild.members.me;
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return message.reply("No puedo crear canales. Me falta el permiso `Gestionar canales`.");
  }
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply("No puedo crear roles. Me falta el permiso `Gestionar roles`.");
  }

  const setupConfig = getSetupConfig(message.client);
  const result = {
    rolesChecked: 0,
    categoriesChecked: 0,
    channelsChecked: 0,
    rolesCreated: [],
    categoriesCreated: [],
    channelsCreated: [],
  };

  const progress = await message.reply("Ejecutando setup del servidor...");

  for (const roleConfig of setupConfig.roles) {
    if (!roleConfig.name) continue;
    result.rolesChecked += 1;
    const { role, created } = await ensureRole(message.guild, roleConfig);
    if (created) result.rolesCreated.push(role.name);
  }

  for (const categoryConfig of setupConfig.categories) {
    if (!categoryConfig.name) continue;
    result.categoriesChecked += 1;
    const { category, created } = await ensureCategory(message.guild, categoryConfig);
    if (created) result.categoriesCreated.push(category.name);

    for (const channelConfig of categoryConfig.channels || []) {
      if (!channelConfig.name) continue;
      result.channelsChecked += 1;
      const { channel, created: channelCreated } = await ensureChannel(
        message.guild,
        category,
        setupConfig,
        channelConfig,
      );
      if (channelCreated) result.channelsCreated.push(`#${channel.name}`);
    }
  }

  return progress.edit({ content: "", embeds: [buildSetupEmbed(message.client, result)] });
}

module.exports = {
  buildSetupEmbed,
  serverSetupCommand,
};
