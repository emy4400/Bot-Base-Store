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

function getReviewConfig(client) {
  return client.config.reviews || {};
}

function getStars(rating) {
  const value = Math.max(1, Math.min(5, Number(rating) || 5));
  return "⭐".repeat(value) + "☆".repeat(5 - value);
}

function buildReviewsPanel(client) {
  const brand = getBrand(client);
  const embed = new EmbedBuilder()
    .setColor(brand.color || "#5865F2")
    .setTitle("⭐ Reseñas de clientes")
    .setDescription(
      [
        "Comparte tu experiencia con nuestro servicio.",
        "",
        "Tu reseña ayuda a otros clientes a conocer la calidad del servicio."
      ].join("\n")
    )
    .setFooter({ text: brand.footer || brand.name || "Sistema de reseñas" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("review_open")
      .setLabel("Dejar reseña")
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function buildReviewEmbed(client, review) {
  const brand = getBrand(client);
  const rating = Math.max(1, Math.min(5, Number(review.rating) || 5));
  const embed = new EmbedBuilder()
    .setColor(rating >= 4 ? "#F1C40F" : rating === 3 ? "#FAA61A" : "#ED4245")
    .setTitle(`⭐ Reseña #${review.number}`)
    .setDescription(review.comment)
    .addFields(
      { name: "Cliente", value: `<@${review.userId}>`, inline: true },
      { name: "Servicio", value: review.service, inline: true },
      { name: "Puntuación", value: `${getStars(rating)}\n**${rating}/5**`, inline: true },
      { name: "Útil para otros", value: `👍 ${review.helpful.length}`, inline: true }
    )
    .setTimestamp(new Date(review.createdAt))
    .setFooter({ text: brand.footer || brand.name || "Reseñas verificadas" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  return embed;
}

function buildReviewButtons(reviewId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`review_helpful:${reviewId}`)
        .setLabel("Me fue útil")
        .setEmoji("👍")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

async function createReview(interaction, data) {
  const config = getReviewConfig(interaction.client);
  const channelId = config.channelId || interaction.channel.id;
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    return interaction.reply({
      content: "No pude encontrar el canal de reseñas configurado.",
      ephemeral: true,
    });
  }

  const rating = Number(data.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return interaction.reply({
      content: "La puntuación debe ser un número del 1 al 5.",
      ephemeral: true,
    });
  }

  const store = readStore("reviews", { nextNumber: 1, reviews: {} });
  const reviewId = `${Date.now()}-${interaction.user.id}`;
  const review = {
    id: reviewId,
    number: store.nextNumber++,
    guildId: interaction.guild.id,
    channelId: channel.id,
    messageId: null,
    userId: interaction.user.id,
    service: data.service,
    rating,
    comment: data.comment,
    helpful: [],
    createdAt: new Date().toISOString(),
  };

  const message = await channel.send({
    embeds: [buildReviewEmbed(interaction.client, review)],
    components: buildReviewButtons(reviewId),
  });

  review.messageId = message.id;
  store.reviews[reviewId] = review;
  writeStore("reviews", store);

  await interaction.reply({
    content: `Tu reseña fue publicada correctamente: ${message.url}`,
    ephemeral: true,
  });
}

async function markReviewHelpful(interaction, reviewId) {
  const store = readStore("reviews", { nextNumber: 1, reviews: {} });
  const review = store.reviews[reviewId];

  if (!review) {
    return interaction.reply({
      content: "No encontré esa reseña en la base local.",
      ephemeral: true,
    });
  }

  if (review.helpful.includes(interaction.user.id)) {
    review.helpful = review.helpful.filter((id) => id !== interaction.user.id);
  } else {
    review.helpful.push(interaction.user.id);
  }

  writeStore("reviews", store);
  await interaction.update({
    embeds: [buildReviewEmbed(interaction.client, review)],
    components: buildReviewButtons(reviewId),
  });
}

module.exports = {
  buildReviewsPanel,
  createReview,
  markReviewHelpful,
};
