const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

function getBrand(client) {
  return client.config.brand || {};
}

function getInviteConfig(client) {
  client.config.serverInvite = client.config.serverInvite || {};
  return client.config.serverInvite;
}

async function resolveInviteUrl(message) {
  const config = getInviteConfig(message.client);
  if (config.url?.startsWith("http")) return config.url;

  if (!message.guild.members.me.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
    return null;
  }

  const channelId = config.channelId || message.channel.id;
  const channel = await message.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.createInvite) return null;

  const invite = await channel.createInvite({
    maxAge: 0,
    maxUses: 0,
    unique: false,
    reason: `Invitacion publicada por ${message.author.tag}`,
  }).catch(() => null);

  return invite?.url || null;
}

function buildInviteEmbed(client, inviteUrl) {
  const brand = getBrand(client);
  const config = getInviteConfig(client);
  const embed = new EmbedBuilder()
    .setColor(brand.color || "#F54927")
    .setAuthor({ name: brand.name || "Discord Store Bot", iconURL: brand.logoUrl || undefined })
    .setTitle(config.title || "Invitacion oficial")
    .setDescription(
      [
        config.description || "Unete a nuestro servidor oficial y mantente al tanto de servicios, soporte, sorteos y novedades.",
        "",
        inviteUrl
          ? "Pulsa el boton para entrar al servidor."
          : "No hay una invitacion configurada. Agrega una URL en `config.json` o da permiso al bot para crear invitaciones.",
      ].join("\n"),
    )
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Invitacion oficial" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  return embed;
}

function buildInviteRows(inviteUrl) {
  if (!inviteUrl) return [];

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Entrar al servidor")
        .setStyle(ButtonStyle.Link)
        .setURL(inviteUrl),
    ),
  ];
}

async function sendInviteCommand(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return message.reply("Necesitas permiso de administrar servidor para publicar la invitacion.");
  }

  const inviteUrl = await resolveInviteUrl(message);
  return message.channel.send({
    embeds: [buildInviteEmbed(message.client, inviteUrl)],
    components: buildInviteRows(inviteUrl),
  });
}

module.exports = {
  buildInviteEmbed,
  buildInviteRows,
  sendInviteCommand,
};
