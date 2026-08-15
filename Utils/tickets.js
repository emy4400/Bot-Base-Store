const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { readStore, writeStore } = require("./store");

function getTicketConfig(client) {
  return client.config.tickets || {};
}

function getBrand(client) {
  return client.config.brand || {};
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
      .setCustomId("ticket_close")
      .setLabel("Cerrar")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
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
      ...(config.staffRoleId
        ? [
            {
              id: config.staffRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
              ],
            },
          ]
        : []),
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

async function closeTicket(interaction) {
  const store = readStore("tickets", { tickets: {} });
  const ticket = store.tickets[interaction.channel.id];

  if (!ticket || ticket.status !== "open") {
    return interaction.reply({
      content: "Este canal no parece ser un ticket abierto.",
      ephemeral: true,
    });
  }

  ticket.status = "closed";
  ticket.closedBy = interaction.user.id;
  ticket.closedAt = new Date().toISOString();
  writeStore("tickets", store);

  await interaction.reply("Cerrando ticket y generando transcript...");

  const transcript = await createTranscript(interaction.channel);
  await sendTicketLog(interaction.client, "Ticket cerrado", interaction.channel, interaction.user, [
    { name: "Usuario", value: `<@${ticket.userId}>`, inline: true },
    { name: "Cerrado por", value: `${interaction.user}`, inline: true },
  ], transcript);

  setTimeout(() => interaction.channel.delete().catch(() => null), 3000);
}

async function claimTicket(interaction) {
  const store = readStore("tickets", { tickets: {} });
  const ticket = store.tickets[interaction.channel.id];

  if (!ticket || ticket.status !== "open") {
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
    payload.files = [
      {
        attachment: Buffer.from(transcript || "Sin mensajes.", "utf8"),
        name: `transcript-${channel.id}.txt`,
      },
    ];
  }

  await logChannel.send(payload).catch(() => null);
}

module.exports = {
  buildTicketPanel,
  claimTicket,
  closeTicket,
  createTicket,
};
