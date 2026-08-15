const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const { readStore, writeStore } = require("./store");

function getBrand(client) {
  return client.config.brand || {};
}

function getSuggestionConfig(client) {
  return client.config.suggestions || {};
}

function buildSuggestionPanel(client) {
  const brand = getBrand(client);
  const embed = new EmbedBuilder()
    .setColor(brand.color || "#5865F2")
    .setTitle("💡 Sistema de sugerencias")
    .setDescription(
      [
        "Comparte ideas para mejorar el servidor, la tienda, el soporte o la comunidad.",
        "",
        "Las sugerencias se publican con votación y pueden ser aprobadas o rechazadas por el staff.",
      ].join("\n")
    )
    .setFooter({ text: brand.footer || brand.name || "Sugerencias" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("suggestion_open")
      .setLabel("Enviar sugerencia")
      .setEmoji("💡")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function buildSuggestionEmbed(client, suggestion) {
  const brand = getBrand(client);
  return new EmbedBuilder()
    .setColor(suggestion.statusColor || brand.color || "#5865F2")
    .setTitle(`💡 Sugerencia #${suggestion.number}`)
    .setDescription(suggestion.text)
    .addFields(
      { name: "Autor", value: `<@${suggestion.userId}>`, inline: true },
      { name: "Estado", value: suggestion.status || "Pendiente", inline: true },
      {
        name: "Votos",
        value: `✅ ${suggestion.upvotes.length}  |  ❌ ${suggestion.downvotes.length}`,
        inline: true,
      }
    )
    .setTimestamp(new Date(suggestion.createdAt))
    .setFooter({ text: brand.footer || brand.name || "Sistema de sugerencias" });
}

function buildSuggestionButtons(suggestionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`suggestion_vote:${suggestionId}:up`)
        .setEmoji("✅")
        .setLabel("Votar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`suggestion_vote:${suggestionId}:down`)
        .setEmoji("❌")
        .setLabel("Votar")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`suggestion_approve:${suggestionId}`)
        .setEmoji("🟢")
        .setLabel("Aprobar")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`suggestion_reject:${suggestionId}`)
        .setEmoji("🔴")
        .setLabel("Rechazar")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

async function createSuggestion(interaction, text) {
  const config = getSuggestionConfig(interaction.client);
  const targetChannelId = config.channelId || interaction.channel.id;
  const channel = await interaction.client.channels.fetch(targetChannelId).catch(() => null);

  if (!channel) {
    return interaction.reply({
      content: "No pude encontrar el canal de sugerencias configurado.",
      ephemeral: true,
    });
  }

  const store = readStore("suggestions", { nextNumber: 1, suggestions: {} });
  const suggestionId = `${Date.now()}-${interaction.user.id}`;
  const suggestion = {
    id: suggestionId,
    number: store.nextNumber++,
    guildId: interaction.guild.id,
    channelId: channel.id,
    messageId: null,
    userId: interaction.user.id,
    text,
    status: "Pendiente",
    statusColor: null,
    upvotes: [],
    downvotes: [],
    createdAt: new Date().toISOString(),
  };

  const message = await channel.send({
    embeds: [buildSuggestionEmbed(interaction.client, suggestion)],
    components: buildSuggestionButtons(suggestionId),
  });

  suggestion.messageId = message.id;
  store.suggestions[suggestionId] = suggestion;
  writeStore("suggestions", store);

  await interaction.reply({
    content: `Tu sugerencia fue publicada correctamente: ${message.url}`,
    ephemeral: true,
  });
}

async function voteSuggestion(interaction, suggestionId, vote) {
  const store = readStore("suggestions", { nextNumber: 1, suggestions: {} });
  const suggestion = store.suggestions[suggestionId];

  if (!suggestion) {
    return interaction.reply({
      content: "No encontré esa sugerencia en la base local.",
      ephemeral: true,
    });
  }

  suggestion.upvotes = suggestion.upvotes.filter((id) => id !== interaction.user.id);
  suggestion.downvotes = suggestion.downvotes.filter((id) => id !== interaction.user.id);

  if (vote === "up") suggestion.upvotes.push(interaction.user.id);
  if (vote === "down") suggestion.downvotes.push(interaction.user.id);

  writeStore("suggestions", store);
  await interaction.update({
    embeds: [buildSuggestionEmbed(interaction.client, suggestion)],
    components: buildSuggestionButtons(suggestionId),
  });
}

async function moderateSuggestion(interaction, suggestionId, status) {
  const config = getSuggestionConfig(interaction.client);
  const hasStaffRole = config.staffRoleId && interaction.member.roles.cache.has(config.staffRoleId);
  const canManage = interaction.member.permissions.has("ManageGuild");

  if (!hasStaffRole && !canManage) {
    return interaction.reply({
      content: "Solo el staff puede aprobar o rechazar sugerencias.",
      ephemeral: true,
    });
  }

  const store = readStore("suggestions", { nextNumber: 1, suggestions: {} });
  const suggestion = store.suggestions[suggestionId];

  if (!suggestion) {
    return interaction.reply({
      content: "No encontré esa sugerencia en la base local.",
      ephemeral: true,
    });
  }

  suggestion.status = status === "approved" ? "Aprobada" : "Rechazada";
  suggestion.statusColor = status === "approved" ? "#57F287" : "#ED4245";
  suggestion.reviewedBy = interaction.user.id;
  suggestion.reviewedAt = new Date().toISOString();
  writeStore("suggestions", store);

  await interaction.update({
    embeds: [buildSuggestionEmbed(interaction.client, suggestion)],
    components: buildSuggestionButtons(suggestionId),
  });
}

module.exports = {
  buildSuggestionPanel,
  createSuggestion,
  moderateSuggestion,
  voteSuggestion,
};
