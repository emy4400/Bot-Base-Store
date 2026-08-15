const fs = require("node:fs");
const path = require("node:path");
const {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { canUseStaffSystem, missingRoleMessage } = require("./permissions");

const intervals = new Map();

function getBrand(client) {
  return client.config.brand || {};
}

function configPath() {
  return path.join(__dirname, "../config.json");
}

function saveRuntimeConfig(client) {
  fs.writeFileSync(configPath(), `${JSON.stringify(client.config, null, 2)}\n`, "utf8");
}

function getStatsConfig(client) {
  client.config.memberStats = client.config.memberStats || {};
  client.config.memberStats.channels = client.config.memberStats.channels || {};
  return client.config.memberStats;
}

async function collectStats(guild, client) {
  await guild.members.fetch().catch(() => null);
  const clientRoleId = getStatsConfig(client).clientRoleId;
  const members = guild.members.cache;

  return {
    members: members.filter((member) => !member.user.bot).size,
    active: members.filter(
      (member) => !member.user.bot && ["online", "idle", "dnd"].includes(member.presence?.status),
    ).size,
    clients: clientRoleId
      ? members.filter((member) => !member.user.bot && member.roles.cache.has(clientRoleId)).size
      : 0,
    bots: members.filter((member) => member.user.bot).size,
  };
}

async function ensureStatsCategory(guild, client) {
  const config = getStatsConfig(client);
  let category = config.categoryId
    ? guild.channels.cache.get(config.categoryId) || await guild.channels.fetch(config.categoryId).catch(() => null)
    : null;

  if (!category) {
    category = await guild.channels.create({
      name: "📊 SERVER STATS",
      type: ChannelType.GuildCategory,
      reason: "Sistema de estadisticas del servidor",
    });
    config.categoryId = category.id;
    saveRuntimeConfig(client);
  }

  return category;
}

async function ensureVoiceCounter(guild, category, key, label) {
  const existing = guild.channels.cache.find(
    (channel) =>
      channel.parentId === category.id &&
      channel.type === ChannelType.GuildVoice &&
      channel.name.startsWith(label),
  );

  if (existing) return existing;

  return guild.channels.create({
    name: `${label}: 0`,
    type: ChannelType.GuildVoice,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.Connect],
        allow: [PermissionFlagsBits.ViewChannel],
      },
    ],
    reason: `Contador ${key} del servidor`,
  });
}

async function refreshMemberStats(guild, client) {
  if (!guild?.members?.me?.permissions.has(PermissionFlagsBits.ManageChannels)) return false;

  const config = getStatsConfig(client);
  const labels = {
    members: config.channels.members || "👥 Miembros",
    active: config.channels.active || "🟢 Activos",
    clients: config.channels.clients || "💎 Clientes",
    bots: config.channels.bots || "🤖 Bots",
  };
  const stats = await collectStats(guild, client);
  const category = await ensureStatsCategory(guild, client);

  for (const [key, label] of Object.entries(labels)) {
    const channel = await ensureVoiceCounter(guild, category, key, label);
    const nextName = `${label}: ${stats[key]}`;
    if (channel.name !== nextName) {
      await channel.setName(nextName, "Actualizacion de contador del servidor").catch(() => null);
    }
  }

  return stats;
}

function startMemberStats(client) {
  if (!client.guilds.cache.size) return;

  for (const guild of client.guilds.cache.values()) {
    if (intervals.has(guild.id)) clearInterval(intervals.get(guild.id));
    refreshMemberStats(guild, client).catch(() => null);

    const minutes = Math.max(5, Number(getStatsConfig(client).refreshMinutes) || 10);
    intervals.set(
      guild.id,
      setInterval(() => refreshMemberStats(guild, client).catch(() => null), minutes * 60000),
    );
  }
}

async function memberStatsSetupCommand(message) {
  if (!canUseStaffSystem(message.member, message.client, "moderation")) {
    return message.reply(missingRoleMessage(message.client, "moderation"));
  }

  if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return message.reply("No puedo crear contadores. Me falta el permiso `Gestionar canales`.");
  }

  const stats = await refreshMemberStats(message.guild, message.client);
  const brand = getBrand(message.client);
  const embed = new EmbedBuilder()
    .setColor(brand.color || "#F54927")
    .setAuthor({ name: brand.name || "Discord Store Bot", iconURL: brand.logoUrl || undefined })
    .setTitle("Estadisticas del servidor activadas")
    .setDescription("La categoria de voz con contadores fue creada o actualizada correctamente.")
    .addFields(
      { name: "Miembros", value: String(stats.members), inline: true },
      { name: "Activos", value: String(stats.active), inline: true },
      { name: "Clientes", value: String(stats.clients), inline: true },
      { name: "Bots", value: String(stats.bots), inline: true },
      { name: "Actualizacion", value: `Cada ${getStatsConfig(message.client).refreshMinutes || 10} minutos`, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Member stats" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  return message.reply({ embeds: [embed] });
}

async function memberStatsRefreshCommand(message) {
  if (!canUseStaffSystem(message.member, message.client, "moderation")) {
    return message.reply(missingRoleMessage(message.client, "moderation"));
  }

  const stats = await refreshMemberStats(message.guild, message.client);
  return message.reply(
    `Contadores actualizados: miembros ${stats.members}, activos ${stats.active}, clientes ${stats.clients}, bots ${stats.bots}.`,
  );
}

module.exports = {
  memberStatsRefreshCommand,
  memberStatsSetupCommand,
  refreshMemberStats,
  startMemberStats,
};
