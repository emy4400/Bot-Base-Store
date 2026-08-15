const {
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { canUseStaffSystem, missingRoleMessage } = require("./permissions");
const { parseDuration } = require("./prompt");

function getBrand(client) {
  return client.config.brand || {};
}

function buildModerationEmbed(client, data) {
  const brand = getBrand(client);
  const embed = new EmbedBuilder()
    .setColor(brand.color || "#F54927")
    .setAuthor({ name: brand.name || "Discord Store Bot", iconURL: brand.logoUrl || undefined })
    .setTitle(data.title)
    .setDescription(data.description)
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Moderacion" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  if (data.fields?.length) embed.addFields(data.fields);
  return embed;
}

async function sendModerationLog(message, data) {
  const channelId = message.client.config.moderation?.logChannelId;
  if (!channelId) return;

  const channel = await message.client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({ embeds: [buildModerationEmbed(message.client, data)] }).catch(() => null);
}

function ensureModerationAccess(message) {
  if (!canUseStaffSystem(message.member, message.client, "moderation")) {
    message.reply(missingRoleMessage(message.client, "moderation"));
    return false;
  }
  return true;
}

function resolveMember(message, raw) {
  const clean = String(raw || "").replace(/[<@!>]/g, "");
  return message.guild.members.cache.get(clean) || null;
}

async function clearCommand(message, args) {
  if (!ensureModerationAccess(message)) return;

  const allowed = message.client.config.moderation?.clearAmounts || [10, 50, 100];
  const amount = Number(args[0]);
  if (!allowed.includes(amount)) {
    return message.reply(`Uso correcto: \`${message.client.config.prefix || "!"}clear ${allowed.join("|")}\``);
  }

  if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return message.reply("No puedo eliminar mensajes. Me falta el permiso `Gestionar mensajes`.");
  }

  const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
  if (!deleted) {
    return message.reply("No pude eliminar mensajes. Discord no permite borrar mensajes muy antiguos.");
  }

  const confirmation = await message.channel.send({
    embeds: [
      buildModerationEmbed(message.client, {
        title: "Limpieza completada",
        description: `Se eliminaron **${deleted.size}** mensajes de este canal.`,
        fields: [
          { name: "Moderador", value: `${message.author}`, inline: true },
          { name: "Canal", value: `${message.channel}`, inline: true },
        ],
      }),
    ],
  });

  setTimeout(() => confirmation.delete().catch(() => null), 8000);
  await sendModerationLog(message, {
    title: "Clear ejecutado",
    description: `${message.author} elimino ${deleted.size} mensajes en ${message.channel}.`,
  });
}

async function banCommand(message, args) {
  if (!ensureModerationAccess(message)) return;

  const member = resolveMember(message, args[0]);
  const reason = args.slice(1).join(" ") || "Sin razon especificada";
  if (!member) return message.reply(`Uso correcto: \`${message.client.config.prefix || "!"}ban @usuario razon\``);
  if (!member.bannable) return message.reply("No puedo banear a ese usuario. Revisa jerarquia de roles y permisos del bot.");

  await member.ban({ reason: `${reason} | Moderador: ${message.author.tag}` });
  await message.reply({
    embeds: [
      buildModerationEmbed(message.client, {
        title: "Usuario baneado",
        description: `${member.user.tag} fue baneado correctamente.`,
        fields: [
          { name: "Moderador", value: `${message.author}`, inline: true },
          { name: "Razon", value: reason, inline: false },
        ],
      }),
    ],
  });
  await sendModerationLog(message, {
    title: "Ban ejecutado",
    description: `${message.author} baneo a **${member.user.tag}**.`,
    fields: [{ name: "Razon", value: reason }],
  });
}

async function kickCommand(message, args) {
  if (!ensureModerationAccess(message)) return;

  const member = resolveMember(message, args[0]);
  const reason = args.slice(1).join(" ") || "Sin razon especificada";
  if (!member) return message.reply(`Uso correcto: \`${message.client.config.prefix || "!"}kick @usuario razon\``);
  if (!member.kickable) return message.reply("No puedo expulsar a ese usuario. Revisa jerarquia de roles y permisos del bot.");

  await member.kick(`${reason} | Moderador: ${message.author.tag}`);
  await message.reply({
    embeds: [
      buildModerationEmbed(message.client, {
        title: "Usuario expulsado",
        description: `${member.user.tag} fue expulsado correctamente.`,
        fields: [
          { name: "Moderador", value: `${message.author}`, inline: true },
          { name: "Razon", value: reason, inline: false },
        ],
      }),
    ],
  });
  await sendModerationLog(message, {
    title: "Kick ejecutado",
    description: `${message.author} expulso a **${member.user.tag}**.`,
    fields: [{ name: "Razon", value: reason }],
  });
}

async function timeoutCommand(message, args) {
  if (!ensureModerationAccess(message)) return;

  const member = resolveMember(message, args[0]);
  const duration = parseDuration(args[1]);
  const reason = args.slice(2).join(" ") || "Sin razon especificada";
  if (!member || !duration) {
    return message.reply(`Uso correcto: \`${message.client.config.prefix || "!"}timeout @usuario 10m razon\``);
  }
  if (!member.moderatable) return message.reply("No puedo aplicar timeout a ese usuario. Revisa jerarquia de roles y permisos del bot.");

  await member.timeout(duration, `${reason} | Moderador: ${message.author.tag}`);
  await message.reply({
    embeds: [
      buildModerationEmbed(message.client, {
        title: "Timeout aplicado",
        description: `${member.user.tag} recibio timeout correctamente.`,
        fields: [
          { name: "Duracion", value: args[1], inline: true },
          { name: "Moderador", value: `${message.author}`, inline: true },
          { name: "Razon", value: reason, inline: false },
        ],
      }),
    ],
  });
  await sendModerationLog(message, {
    title: "Timeout ejecutado",
    description: `${message.author} aplico timeout a **${member.user.tag}** por **${args[1]}**.`,
    fields: [{ name: "Razon", value: reason }],
  });
}

module.exports = {
  banCommand,
  clearCommand,
  kickCommand,
  timeoutCommand,
};
