const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { readStore, writeStore } = require("./store");

const closeTimers = new Map();

const COMPLETE_CLOSE_OPTIONS = [
  { key: "now", label: "Cerrar ahora", emoji: "🔒", delayMs: 0 },
  { key: "30m", label: "Cerrar en 30m", emoji: "⏱️", delayMs: 30 * 60 * 1000 },
  { key: "1d", label: "Cerrar en 1 dia", emoji: "📅", delayMs: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "Cerrar en 7 dias", emoji: "🗓️", delayMs: 7 * 24 * 60 * 60 * 1000 },
  { key: "keep", label: "No cerrar aun", emoji: "📌", delayMs: null },
];

function getTicketConfig(client) {
  return client.config.tickets || {};
}

function getBrand(client) {
  return client.config.brand || {};
}

function getTicketStaffRoleIds(client) {
  const config = getTicketConfig(client);
  return [
    ...(Array.isArray(config.staffRoleIds) ? config.staffRoleIds : []),
    config.staffRoleId,
  ].filter(Boolean);
}

function canManageTicket(interaction) {
  const member = interaction.member;
  if (!member) return false;

  const roleIds = getTicketStaffRoleIds(interaction.client);
  return (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    roleIds.some((roleId) => member.roles.cache.has(roleId))
  );
}

function normalizeName(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

function buildTicketControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Tomar ticket")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticket_complete")
      .setLabel("Completado")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Cerrar")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );
}

function buildCompleteScheduleControls(channelId) {
  return new ActionRowBuilder().addComponents(
    COMPLETE_CLOSE_OPTIONS.map((option) =>
      new ButtonBuilder()
        .setCustomId(`ticket_complete_schedule:${channelId}:${option.key}`)
        .setLabel(option.label)
        .setEmoji(option.emoji)
        .setStyle(option.key === "keep" ? ButtonStyle.Secondary : ButtonStyle.Success)
    )
  );
}

function buildTicketPanel(client) {
  const config = getTicketConfig(client);
  const brand = getBrand(client);
  const categories = Object.entries(config.categories || {});

  const embed = new EmbedBuilder()
    .setColor(brand.color || "#5865F2")
    .setTitle(`🎫 Centro de soporte | ${brand.name || "Servidor"}`)
    .setDescription(
      [
        "Si necesitas ayuda o quieres hablar con el staff, abre un ticket usando la categoría correcta.",
        "",
        "**Categorías disponibles**",
        ...categories.map(
          ([, category]) =>
            `${category.emoji || "•"} **${category.label}**\n${category.description}`
        ),
        "",
        "> Completa el formulario con la mayor cantidad de detalles posible."
      ].join("\n")
    )
    .setFooter({ text: brand.footer || brand.name || "Sistema de tickets" });

  if (brand.ticketImage) embed.setImage(brand.ticketImage);

  const rows = [];
  for (let index = 0; index < categories.length; index += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        categories.slice(index, index + 5).map(([key, category]) =>
          new ButtonBuilder()
            .setCustomId(`ticket_open:${key}`)
            .setLabel(category.label)
            .setEmoji(category.emoji || "🎫")
            .setStyle(ButtonStyle.Secondary)
        )
      )
    );
  }

  return { embeds: [embed], components: rows };
}

async function createTicket(interaction, data) {
  const config = getTicketConfig(interaction.client);
  const brand = getBrand(interaction.client);
  const category = config.categories?.[data.categoryKey];
  const staffRoleIds = getTicketStaffRoleIds(interaction.client);

  if (!category) {
    return interaction.reply({
      content: "Esa categoría de ticket ya no existe en la configuración.",
      ephemeral: true,
    });
  }

  const store = readStore("tickets", { tickets: {} });
  const alreadyOpen = Object.values(store.tickets).find(
    (ticket) =>
      ticket.guildId === interaction.guild.id &&
      ticket.userId === interaction.user.id &&
      ticket.status === "open"
  );

  if (alreadyOpen) {
    return interaction.reply({
      content: `Ya tienes un ticket abierto: <#${alreadyOpen.channelId}>`,
      ephemeral: true,
    });
  }

  const safeUser = normalizeName(interaction.user.username);
  const channel = await interaction.guild.channels.create({
    name: `${category.channelPrefix || data.categoryKey}-${safeUser}`,
    type: ChannelType.GuildText,
    parent: config.categoryId || null,
    topic: `Ticket de ${interaction.user.tag} (${interaction.user.id}) | ${category.label}`,
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      ...staffRoleIds.map((roleId) => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      })),
    ],
  });

  const roleResult = await addTicketOpenRole(interaction, config.openRoleId);

  store.tickets[channel.id] = {
    channelId: channel.id,
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    category: data.categoryKey,
    reason: data.reason,
    details: data.details,
    assignedRoleId: roleResult.assigned ? config.openRoleId : null,
    status: "open",
    createdAt: new Date().toISOString(),
    claimedBy: null,
  };
  writeStore("tickets", store);

  const embed = new EmbedBuilder()
    .setColor(brand.color || "#5865F2")
    .setTitle(`${category.emoji || "🎫"} Ticket de ${category.label}`)
    .setDescription(
      [
        `**Usuario:** ${interaction.user}`,
        `**Motivo:** ${data.reason}`,
        "",
        "**Detalles**",
        data.details,
      ].join("\n")
    )
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Sistema de tickets" });

  await channel.send({
    content: `${interaction.user}${config.staffRoleId ? ` <@&${config.staffRoleId}>` : ""}`,
    embeds: [embed],
    components: [buildTicketControls()],
  });

  await interaction.reply({
    content: [
      `Tu ticket fue creado correctamente: ${channel}`,
      roleResult.message ? `Rol de ticket: ${roleResult.message}` : null,
    ].filter(Boolean).join("\n"),
    ephemeral: true,
  });

  await sendTicketLog(interaction.client, "Ticket creado", channel, interaction.user, [
    { name: "Categoría", value: category.label, inline: true },
    { name: "Motivo", value: data.reason.slice(0, 1024), inline: false },
  ]);
}

async function addTicketOpenRole(interaction, roleId) {
  if (!roleId) return { assigned: false, message: "" };

  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    return { assigned: false, message: "no encontre el rol configurado." };
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    return { assigned: false, message: "no pude cargar el miembro." };
  }

  if (member.roles.cache.has(roleId)) {
    return { assigned: true, message: `ya tenias ${role}.` };
  }

  await member.roles.add(role, "Rol asignado al crear ticket").catch(() => null);
  const updated = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const assigned = Boolean(updated?.roles.cache.has(roleId));

  return {
    assigned,
    message: assigned
      ? `se asigno ${role}.`
      : `no pude asignar ${role}. Revisa que el rol del bot este por encima.`,
  };
}

async function createTranscript(channel) {
  const messages = [];
  let before;

  while (messages.length < 200) {
    const fetched = await channel.messages.fetch({ limit: 100, before });
    if (!fetched.size) break;
    messages.push(...fetched.values());
    before = fetched.last().id;
  }

  return messages
    .reverse()
    .map((message) => {
      const date = message.createdAt.toISOString();
      const attachments = message.attachments.map((attachment) => attachment.url).join(" ");
      return `[${date}] ${message.author.tag}: ${message.content || ""} ${attachments}`.trim();
    })
    .join("\n");
}

function buildTranscriptAttachment(channelId, transcript) {
  return new AttachmentBuilder(Buffer.from(transcript || "Sin mensajes.", "utf8"), {
    name: `transcript-${channelId}.txt`,
  });
}

async function sendTicketClosedDm(client, ticket, channel, closedBy, transcript) {
  const brand = getBrand(client);
  const user = await client.users.fetch(ticket.userId).catch(() => null);
  if (!user) return false;

  const embed = new EmbedBuilder()
    .setColor(brand.color || "#5865F2")
    .setTitle("🔒 Tu ticket fue cerrado")
    .setDescription(
      [
        `Tu ticket en **${brand.name || "el servidor"}** fue cerrado correctamente.`,
        "",
        `**Ticket:** #${channel.name}`,
        `**Cerrado por:** ${closedBy}`,
        "",
        "Adjuntamos el transcript para que puedas conservar el historial.",
      ].join("\n")
    )
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Sistema de tickets" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);

  const sent = await user
    .send({
      embeds: [embed],
      files: [buildTranscriptAttachment(channel.id, transcript)],
    })
    .then(() => true)
    .catch(() => false);

  return sent;
}

async function closeTicketRecord(client, channel, ticket, closedBy, reason = "Ticket cerrado") {
  const store = readStore("tickets", { tickets: {} });
  const storedTicket = store.tickets[channel.id] || ticket;

  if (!storedTicket || storedTicket.status === "closed") return false;

  if (closeTimers.has(channel.id)) {
    clearTimeout(closeTimers.get(channel.id));
    closeTimers.delete(channel.id);
  }

  storedTicket.status = "closed";
  storedTicket.closedBy = closedBy.id || closedBy;
  storedTicket.closedAt = new Date().toISOString();
  storedTicket.closeReason = reason;
  delete storedTicket.scheduledCloseAt;
  delete storedTicket.scheduledCloseBy;
  store.tickets[channel.id] = storedTicket;
  writeStore("tickets", store);

  const transcript = await createTranscript(channel);
  const dmSent = await sendTicketClosedDm(client, storedTicket, channel, closedBy, transcript);

  await sendTicketLog(client, "Ticket cerrado", channel, closedBy, [
    { name: "Usuario", value: `<@${storedTicket.userId}>`, inline: true },
    { name: "Cerrado por", value: `${closedBy}`, inline: true },
    { name: "Motivo", value: reason.slice(0, 1024), inline: false },
  ], transcript);

  await channel
    .send(
      dmSent
        ? "🔒 Ticket cerrado. El transcript fue enviado al usuario por mensaje privado."
        : "🔒 Ticket cerrado. No pude enviar DM al usuario; revisa el transcript en logs."
    )
    .catch(() => null);
  setTimeout(() => channel.delete().catch(() => null), 3000);
  return true;
}

function scheduleTicketClose(client, channelId, delayMs) {
  if (closeTimers.has(channelId)) clearTimeout(closeTimers.get(channelId));
  if (!Number.isFinite(delayMs) || delayMs < 0) return;

  const timer = setTimeout(async () => {
    closeTimers.delete(channelId);
    const store = readStore("tickets", { tickets: {} });
    const ticket = store.tickets[channelId];
    if (!ticket || ticket.status === "closed") return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const actor = ticket.scheduledCloseBy
      ? await client.users.fetch(ticket.scheduledCloseBy).catch(() => null)
      : client.user;

    await closeTicketRecord(
      client,
      channel,
      ticket,
      actor || client.user,
      "Cierre automatico programado despues de completar el ticket"
    );
  }, Math.min(delayMs, 2147483647));

  closeTimers.set(channelId, timer);
}

function restoreTicketTimers(client) {
  const store = readStore("tickets", { tickets: {} });
  for (const ticket of Object.values(store.tickets || {})) {
    if (!ticket.scheduledCloseAt || ticket.status === "closed") continue;
    const remaining = Number(ticket.scheduledCloseAt) - Date.now();
    if (remaining <= 0) {
      scheduleTicketClose(client, ticket.channelId, 1000);
    } else {
      scheduleTicketClose(client, ticket.channelId, remaining);
    }
  }
}

async function closeTicket(interaction) {
  if (!canManageTicket(interaction)) {
    return interaction.reply({
      content: "Faltan permisos. Solo el staff autorizado puede cerrar tickets.",
      ephemeral: true,
    });
  }

  const store = readStore("tickets", { tickets: {} });
  const ticket = store.tickets[interaction.channel.id];

  if (!ticket || ticket.status === "closed") {
    return interaction.reply({
      content: "Este canal no parece ser un ticket abierto.",
      ephemeral: true,
    });
  }

  await interaction.reply("Cerrando ticket, generando transcript y enviándolo al usuario...");
  await closeTicketRecord(
    interaction.client,
    interaction.channel,
    ticket,
    interaction.user,
    "Cierre manual por staff"
  );
}

async function claimTicket(interaction) {
  if (!canManageTicket(interaction)) {
    return interaction.reply({
      content: "Faltan permisos. Solo el staff autorizado puede tomar tickets.",
      ephemeral: true,
    });
  }

  const store = readStore("tickets", { tickets: {} });
  const ticket = store.tickets[interaction.channel.id];

  if (!ticket || ticket.status === "closed") {
    return interaction.reply({
      content: "Este canal no parece ser un ticket abierto.",
      ephemeral: true,
    });
  }

  ticket.claimedBy = interaction.user.id;
  ticket.claimedAt = new Date().toISOString();
  writeStore("tickets", store);

  await interaction.reply(`🙋 ${interaction.user} tomó este ticket.`);
}

async function completeTicket(interaction) {
  if (!canManageTicket(interaction)) {
    return interaction.reply({
      content: "Faltan permisos. Solo el staff autorizado puede marcar tickets como completados.",
      ephemeral: true,
    });
  }

  const config = getTicketConfig(interaction.client);
  const store = readStore("tickets", { tickets: {} });
  const ticket = store.tickets[interaction.channel.id];

  if (!ticket || ticket.status === "closed") {
    return interaction.reply({
      content: "Este canal no parece ser un ticket abierto.",
      ephemeral: true,
    });
  }

  if (ticket.completedAt) {
    return interaction.reply({
      content: "Este ticket ya estaba marcado como completado.",
      ephemeral: true,
    });
  }

  return interaction.reply({
    content: [
      "Selecciona cuándo quieres cerrar este ticket después de marcarlo como completado.",
      "`No cerrar aun` solo cambia roles/nombre y deja el ticket abierto para seguimiento.",
    ].join("\n"),
    components: [buildCompleteScheduleControls(interaction.channel.id)],
    ephemeral: true,
  });
}

async function completeTicketWithSchedule(interaction, channelId, optionKey) {
  if (!canManageTicket(interaction)) {
    return interaction.reply({
      content: "Faltan permisos. Solo el staff autorizado puede marcar tickets como completados.",
      ephemeral: true,
    });
  }

  if (interaction.channel.id !== channelId) {
    return interaction.reply({
      content: "Esta opción pertenece a otro ticket.",
      ephemeral: true,
    });
  }

  const selectedOption = COMPLETE_CLOSE_OPTIONS.find((option) => option.key === optionKey);
  if (!selectedOption) {
    return interaction.reply({
      content: "Opción de cierre inválida.",
      ephemeral: true,
    });
  }

  const config = getTicketConfig(interaction.client);
  const store = readStore("tickets", { tickets: {} });
  const ticket = store.tickets[interaction.channel.id];

  if (!ticket || ticket.status === "closed") {
    return interaction.reply({
      content: "Este canal no parece ser un ticket abierto.",
      ephemeral: true,
    });
  }

  const member = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
  const openRoleId = config.openRoleId || config.clientRoleId;
  const completedRoleId = config.completedRoleId || config.familyRoleId;
  const changes = [];

  if (member && openRoleId && member.roles.cache.has(openRoleId)) {
    await member.roles.remove(openRoleId, "Ticket marcado como completado").catch(() => null);
    const updated = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
    changes.push(
      updated && !updated.roles.cache.has(openRoleId)
        ? `Rol cliente removido: <@&${openRoleId}>`
        : `No pude remover <@&${openRoleId}>. Revisa jerarquia del bot.`
    );
  }

  if (member && completedRoleId) {
    await member.roles.add(completedRoleId, "Ticket marcado como completado").catch(() => null);
    const updated = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
    changes.push(
      updated?.roles.cache.has(completedRoleId)
        ? `Rol familia agregado: <@&${completedRoleId}>`
        : `No pude agregar <@&${completedRoleId}>. Revisa jerarquia del bot.`
    );
  }

  const currentName = interaction.channel.name.replace(/^completado-/, "");
  await interaction.channel.setName(`completado-${currentName}`.slice(0, 100)).catch(() => null);

  const scheduledCloseAt =
    selectedOption.delayMs === null ? null : Date.now() + selectedOption.delayMs;

  ticket.status = "completed";
  ticket.completedBy = interaction.user.id;
  ticket.completedAt = ticket.completedAt || new Date().toISOString();
  ticket.completedRoleId = completedRoleId || null;
  ticket.scheduledCloseAt = scheduledCloseAt;
  ticket.scheduledCloseBy = interaction.user.id;
  ticket.scheduledCloseLabel = selectedOption.label;
  writeStore("tickets", store);

  if (scheduledCloseAt !== null) {
    scheduleTicketClose(interaction.client, interaction.channel.id, selectedOption.delayMs);
  } else if (closeTimers.has(interaction.channel.id)) {
    clearTimeout(closeTimers.get(interaction.channel.id));
    closeTimers.delete(interaction.channel.id);
  }

  const closeText =
    selectedOption.delayMs === 0
      ? "Se cerrará ahora y se enviará transcript al usuario."
      : selectedOption.delayMs === null
        ? "No se cerrará automáticamente."
        : `Se cerrará <t:${Math.floor(scheduledCloseAt / 1000)}:R>.`;

  await interaction.update({
    content: [
      `✅ ${interaction.user} marcó este ticket como completado.`,
      closeText,
      ...changes,
    ].join("\n"),
    components: [],
  });

  await sendTicketLog(interaction.client, "Ticket completado", interaction.channel, interaction.user, [
    { name: "Cliente", value: `<@${ticket.userId}>`, inline: true },
    { name: "Completado por", value: `${interaction.user}`, inline: true },
    { name: "Cierre", value: selectedOption.label, inline: true },
  ]);

  if (selectedOption.delayMs === 0) {
    await closeTicketRecord(
      interaction.client,
      interaction.channel,
      ticket,
      interaction.user,
      "Cierre inmediato despues de completar el ticket"
    );
  }
}

async function sendTicketLog(client, title, channel, actor, fields = [], transcript = null) {
  const config = getTicketConfig(client);
  if (!config.logChannelId) return;

  const logChannel = await client.channels.fetch(config.logChannelId).catch(() => null);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(getBrand(client).color || "#5865F2")
    .setTitle(title)
    .setDescription(`Canal: #${channel.name}\nAcción por: ${actor}`)
    .addFields(fields)
    .setTimestamp();

  const payload = { embeds: [embed] };
  if (transcript) {
    payload.files = [buildTranscriptAttachment(channel.id, transcript)];
  }

  await logChannel.send(payload).catch(() => null);
}

module.exports = {
  buildTicketPanel,
  claimTicket,
  closeTicket,
  completeTicket,
  completeTicketWithSchedule,
  createTicket,
  restoreTicketTimers,
};
