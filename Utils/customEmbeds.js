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
const {
  isSendableTextChannel,
  parseAnnouncementTag,
  resolveTextChannel,
} = require("./prompt");

function getBrand(client) {
  return client.config.brand || {};
}

function canCreateEmbed(member, client) {
  const staffRoleId = client.config.customEmbeds?.staffRoleId || client.config.moderation?.staffRoleIds?.[0];
  const hasStaffRole = staffRoleId && member.roles.cache.has(staffRoleId);
  return hasStaffRole || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

function buildCustomEmbed(client, data) {
  const brand = getBrand(client);
  const embed = new EmbedBuilder()
    .setColor(brand.color || "#F54927")
    .setAuthor({
      name: brand.name || "Discord Store Bot",
      iconURL: brand.logoUrl || undefined,
    })
    .setTitle(data.title)
    .setDescription(data.description)
    .setFooter({
      text: data.footer || brand.footer || brand.name || "Discord Store Bot",
    })
    .setTimestamp();

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  return embed;
}

function buildCustomEmbedModal(userId) {
  return new ModalBuilder()
    .setCustomId(`custom_embed_modal:${userId}`)
    .setTitle("Crear embed profesional")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Titulo")
          .setPlaceholder("Ej: Promocion de fin de semana")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(256),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("description")
          .setLabel("Contenido")
          .setPlaceholder("Escribe el mensaje completo. Puedes usar saltos de linea.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(4000),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("tag")
          .setLabel("Tag")
          .setPlaceholder("@everyone, @here, mencion/ID de rol o no")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("channel")
          .setLabel("Canal destino")
          .setPlaceholder("Menciona el canal, pega su ID o escribe su nombre")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("footer")
          .setLabel("Pie de mensaje")
          .setPlaceholder("default para usar el footer configurado")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(256),
      ),
    );
}

async function createCustomEmbedWizard(message) {
  if (!canCreateEmbed(message.member, message.client)) {
    return message.reply("Necesitas permiso de administrar servidor para crear embeds.");
  }

  const brand = getBrand(message.client);
  const embed = new EmbedBuilder()
    .setColor(brand.color || "#F54927")
    .setAuthor({ name: brand.name || "Discord Store Bot", iconURL: brand.logoUrl || undefined })
    .setTitle("Centro profesional de anuncios")
    .setDescription(
      [
        "Pulsa el boton para abrir una ventana privada de Discord.",
        "",
        "**Flujo:** titulo, contenido, tag, canal destino y footer.",
        "El mensaje final se publica con el color y logo configurados del servidor.",
      ].join("\n"),
    )
    .setFooter({ text: brand.footer || brand.name || "Discord Store Bot" })
    .setTimestamp();

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);

  return message.reply({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`custom_embed_open:${message.author.id}`)
          .setLabel("Crear anuncio")
          .setEmoji("📝")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

async function sendCustomEmbedFromModal(interaction, ownerId) {
  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      content: "Este formulario pertenece a otro usuario.",
      ephemeral: true,
    });
  }

  if (!canCreateEmbed(interaction.member, interaction.client)) {
    return interaction.reply({
      content: "Necesitas permiso de administrar servidor para crear embeds.",
      ephemeral: true,
    });
  }

  const title = interaction.fields.getTextInputValue("title").trim();
  const description = interaction.fields.getTextInputValue("description").trim();
  const tag = parseAnnouncementTag(interaction.guild, interaction.fields.getTextInputValue("tag"));
  const targetChannel = resolveTextChannel(
    interaction.guild,
    interaction.fields.getTextInputValue("channel"),
  );
  const footerInput = interaction.fields.getTextInputValue("footer").trim();

  if (!tag) {
    return interaction.reply({
      content: "No encontre ese rol/tag. Usa mencion, ID, nombre del rol, `@everyone`, `@here` o `no`.",
      ephemeral: true,
    });
  }

  if (!isSendableTextChannel(targetChannel)) {
    return interaction.reply({
      content: "No encontre un canal de texto valido para enviar el embed.",
      ephemeral: true,
    });
  }

  const sent = await targetChannel.send({
    content: tag.content,
    embeds: [
      buildCustomEmbed(interaction.client, {
        title,
        description,
        footer: footerInput.toLowerCase() === "default" ? "" : footerInput,
      }),
    ],
    allowedMentions: tag.allowedMentions,
  });

  return interaction.reply({
    content: `Embed enviado correctamente: ${sent.url}`,
    ephemeral: true,
  });
}

module.exports = {
  buildCustomEmbedModal,
  createCustomEmbedWizard,
  sendCustomEmbedFromModal,
};
