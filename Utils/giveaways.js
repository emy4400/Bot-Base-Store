const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const { readStore, writeStore } = require("./store");
const {
  isSendableTextChannel,
  parseAnnouncementTag,
  parseDuration,
  resolveTextChannel,
} = require("./prompt");

const timers = new Map();

function getBrand(client) {
  return client.config.brand || {};
}

function getGiveawayConfig(client) {
  return client.config.giveaways || {};
}

function formatWinners(winnerIds) {
  return winnerIds.length ? winnerIds.map((id) => `<@${id}>`).join(", ") : "Sin ganadores";
}

function canManageGiveaways(member, client) {
  const config = getGiveawayConfig(client);
  const roleIds = [
    ...(Array.isArray(config.staffRoleIds) ? config.staffRoleIds : []),
    config.staffRoleId,
    ...(Array.isArray(client.config.moderation?.staffRoleIds)
      ? client.config.moderation.staffRoleIds
      : []),
  ].filter(Boolean);
  const hasStaffRole = roleIds.some((roleId) => member.roles.cache.has(roleId));
  return hasStaffRole || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

function buildGiveawayEmbed(client, giveaway) {
  const brand = getBrand(client);
  const endsAtSeconds = Math.floor(giveaway.endsAt / 1000);
  const embed = new EmbedBuilder()
    .setColor(giveaway.ended ? "#2B2D31" : brand.color || "#5865F2")
    .setTitle(giveaway.ended ? "🎉 Sorteo finalizado" : "🎉 Sorteo activo")
    .setDescription(
      [
        `# ${brand.name || "Discord Store Bot"}`,
        `## ${giveaway.prize}`,
        giveaway.ended
          ? `**Ganador(es):** ${formatWinners(giveaway.winners)}`
          : `Termina <t:${endsAtSeconds}:R>`,
        "",
        `**Participantes:** ${giveaway.participants.length}`,
        `**Ganadores:** ${giveaway.winnerCount}`,
        "",
        giveaway.ended
          ? "Gracias a todos por participar."
          : "Pulsa el botón para participar. Puedes volver a pulsarlo para salir."
      ].join("\n")
    )
    .setTimestamp(new Date(giveaway.endsAt))
    .setFooter({ text: brand.footer || brand.name || "Sistema de sorteos" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  return embed;
}

function buildGiveawayButtons(giveawayId, ended = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_join:${giveawayId}`)
        .setLabel(ended ? "Sorteo cerrado" : "Participar")
        .setEmoji("🎉")
        .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(Boolean(ended)),
      new ButtonBuilder()
        .setCustomId(`giveaway_end:${giveawayId}`)
        .setLabel(ended ? "Finalizado" : "Terminar")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(Boolean(ended))
    ),
  ];
}

function pickWinners(participants, winnerCount) {
  const pool = [...new Set(participants)];
  const winners = [];

  while (pool.length && winners.length < winnerCount) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(index, 1)[0]);
  }

  return winners;
}

async function createGiveawayWizard(message) {
  if (!canManageGiveaways(message.member, message.client)) {
    return message.reply("Necesitas permiso de administrar servidor para crear sorteos.");
  }

  const brand = getBrand(message.client);
  const embed = new EmbedBuilder()
    .setColor(brand.color || "#F54927")
    .setAuthor({ name: brand.name || "Discord Store Bot", iconURL: brand.logoUrl || undefined })
    .setTitle("Centro profesional de sorteos")
    .setDescription(
      [
        "Pulsa el boton para abrir una ventana privada de Discord.",
        "",
        "**Flujo:** premio, duracion, ganadores, canal destino y tag.",
        "El sorteo se publicara con boton de participacion y cierre automatico.",
      ].join("\n"),
    )
    .setFooter({ text: brand.footer || brand.name || "Sistema de sorteos" })
    .setTimestamp();

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);

  return message.reply({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("giveaway_open")
          .setLabel("Crear sorteo")
          .setEmoji("🎉")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

function buildGiveawayModal() {
  return new ModalBuilder()
    .setCustomId("giveaway_modal")
    .setTitle("Crear sorteo")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("prize")
          .setLabel("Premio")
          .setPlaceholder("Ej: Nitro, producto digital, descuento especial")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(256),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("duration")
          .setLabel("Duracion")
          .setPlaceholder("Ej: 30m, 2h, 1d")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("winners")
          .setLabel("Cantidad de ganadores")
          .setPlaceholder("Ej: 1")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(2),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("channel")
          .setLabel("Canal destino")
          .setPlaceholder("Opcional. Vacio = canal donde esta el panel")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(100),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("tag")
          .setLabel("Tag del anuncio")
          .setPlaceholder("@everyone, @here, mencion/ID de rol o no")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
    );
}

async function createGiveawayFromModal(interaction) {
  if (!canManageGiveaways(interaction.member, interaction.client)) {
    return interaction.reply({
      content: "Necesitas permiso de administrar servidor para crear sorteos.",
      ephemeral: true,
    });
  }

  const prize = interaction.fields.getTextInputValue("prize").trim();
  const duration = parseDuration(interaction.fields.getTextInputValue("duration"));
  const winnerCount = Number(interaction.fields.getTextInputValue("winners"));
  const channelInput = interaction.fields.getTextInputValue("channel").trim();
  const targetChannel = channelInput
    ? resolveTextChannel(interaction.guild, channelInput)
    : interaction.channel;
  const tag = parseAnnouncementTag(interaction.guild, interaction.fields.getTextInputValue("tag"));

  if (!duration) {
    return interaction.reply({
      content: "Duracion invalida. Usa formato `30m`, `2h` o `1d`.",
      ephemeral: true,
    });
  }

  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20) {
    return interaction.reply({
      content: "La cantidad de ganadores debe ser un numero entre 1 y 20.",
      ephemeral: true,
    });
  }

  if (!isSendableTextChannel(targetChannel)) {
    return interaction.reply({
      content: "No encontre un canal de texto valido para publicar el sorteo.",
      ephemeral: true,
    });
  }

  if (!tag) {
    return interaction.reply({
      content: "No encontre ese tag o rol. Usa mencion, ID, nombre del rol, `@everyone`, `@here` o `no`.",
      ephemeral: true,
    });
  }

  const sent = await createGiveawayRecord(interaction, {
    targetChannel,
    prize,
    winnerCount,
    duration,
    tag,
  });

  return interaction.reply({
    content: `Sorteo creado correctamente: ${sent.url}`,
    ephemeral: true,
  });
}

async function createGiveawayRecord(message, data) {
  const store = readStore("giveaways", { giveaways: {} });
  const actor = message.author || message.user;
  const giveawayId = `${Date.now()}-${actor.id}`;
  const giveaway = {
    id: giveawayId,
    guildId: message.guild.id,
    channelId: data.targetChannel.id,
    messageId: null,
    prize: data.prize,
    winnerCount: data.winnerCount,
    participants: [],
    winners: [],
    ended: false,
    createdBy: actor.id,
    createdAt: Date.now(),
    endsAt: Date.now() + data.duration,
    announcementTag: data.tag.content,
  };

  const sent = await data.targetChannel.send({
    content: data.tag.content,
    embeds: [buildGiveawayEmbed(message.client, giveaway)],
    components: buildGiveawayButtons(giveawayId),
    allowedMentions: data.tag.allowedMentions,
  });

  giveaway.messageId = sent.id;
  store.giveaways[giveawayId] = giveaway;
  writeStore("giveaways", store);
  scheduleGiveaway(message.client, giveawayId);

  return sent;
}

async function joinGiveaway(interaction, giveawayId) {
  const store = readStore("giveaways", { giveaways: {} });
  const giveaway = store.giveaways[giveawayId];

  if (!giveaway || giveaway.ended) {
    return interaction.reply({
      content: "Este sorteo ya no está disponible.",
      ephemeral: true,
    });
  }

  if (giveaway.participants.includes(interaction.user.id)) {
    giveaway.participants = giveaway.participants.filter((id) => id !== interaction.user.id);
  } else {
    giveaway.participants.push(interaction.user.id);
  }

  writeStore("giveaways", store);
  await interaction.update({
    embeds: [buildGiveawayEmbed(interaction.client, giveaway)],
    components: buildGiveawayButtons(giveawayId),
  });
}

async function endGiveaway(client, giveawayId, forcedBy = null) {
  const store = readStore("giveaways", { giveaways: {} });
  const giveaway = store.giveaways[giveawayId];
  if (!giveaway || giveaway.ended) return false;

  giveaway.ended = true;
  giveaway.winners = pickWinners(giveaway.participants, giveaway.winnerCount);
  giveaway.endedAt = Date.now();
  if (forcedBy) giveaway.forcedBy = forcedBy;
  writeStore("giveaways", store);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel) return false;

  const giveawayMessage = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (giveawayMessage) {
    await giveawayMessage.edit({
      embeds: [buildGiveawayEmbed(client, giveaway)],
      components: buildGiveawayButtons(giveawayId, true),
    }).catch(() => null);
  }

  await channel.send(
    giveaway.winners.length
      ? `🎉 Felicidades ${formatWinners(giveaway.winners)}. Ganaste: **${giveaway.prize}**`
      : `🎉 El sorteo de **${giveaway.prize}** terminó sin participantes suficientes.`
  ).catch(() => null);

  return true;
}

async function endGiveawayButton(interaction, giveawayId) {
  if (!canManageGiveaways(interaction.member, interaction.client)) {
    return interaction.reply({
      content: "Faltan permisos. Solo el staff autorizado puede terminar sorteos.",
      ephemeral: true,
    });
  }

  const ended = await endGiveaway(interaction.client, giveawayId, interaction.user.id);
  return interaction.reply({
    content: ended
      ? "✅ Sorteo finalizado correctamente."
      : "Este sorteo ya estaba finalizado o no existe.",
    ephemeral: true,
  });
}

function scheduleGiveaway(client, giveawayId) {
  if (timers.has(giveawayId)) clearTimeout(timers.get(giveawayId));

  const store = readStore("giveaways", { giveaways: {} });
  const giveaway = store.giveaways[giveawayId];
  if (!giveaway || giveaway.ended) return;

  const delay = Math.max(1000, giveaway.endsAt - Date.now());
  const timer = setTimeout(() => {
    timers.delete(giveawayId);
    const latest = readStore("giveaways", { giveaways: {} }).giveaways[giveawayId];
    if (latest && !latest.ended && latest.endsAt > Date.now()) {
      scheduleGiveaway(client, giveawayId);
      return;
    }
    endGiveaway(client, giveawayId).catch(() => null);
  }, Math.min(delay, 2147483647));

  timers.set(giveawayId, timer);
}

function restoreGiveawayTimers(client) {
  const store = readStore("giveaways", { giveaways: {} });
  for (const giveaway of Object.values(store.giveaways)) {
    if (!giveaway.ended) scheduleGiveaway(client, giveaway.id);
  }
}

module.exports = {
  buildGiveawayModal,
  createGiveawayFromModal,
  createGiveawayWizard,
  endGiveawayButton,
  joinGiveaway,
  restoreGiveawayTimers,
};
