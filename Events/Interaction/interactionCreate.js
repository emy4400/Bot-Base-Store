const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const { toggleAutoroles } = require("../../Utils/autoroles");
const {
  buildCustomEmbedModal,
  sendCustomEmbedFromModal,
} = require("../../Utils/customEmbeds");
const {
  buildGiveawayModal,
  createGiveawayFromModal,
  endGiveawayButton,
  joinGiveaway,
} = require("../../Utils/giveaways");
const {
  createReview,
  markReviewHelpful,
} = require("../../Utils/reviews");
const {
  createSuggestion,
  moderateSuggestion,
  voteSuggestion,
} = require("../../Utils/suggestions");
const {
  claimTicket,
  closeTicket,
  completeTicket,
  completeTicketWithSchedule,
  createTicket,
} = require("../../Utils/tickets");

function buildTicketModal(categoryKey) {
  return new ModalBuilder()
    .setCustomId(`ticket_modal:${categoryKey}`)
    .setTitle("Crear ticket")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Motivo")
          .setPlaceholder("Ej: compra pendiente, garantía, problema técnico...")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("details")
          .setLabel("Detalles")
          .setPlaceholder("Explica qué necesitas, incluye pruebas, ID de compra o contexto.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
}

function buildSuggestionModal() {
  return new ModalBuilder()
    .setCustomId("suggestion_modal")
    .setTitle("Enviar sugerencia")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("suggestion")
          .setLabel("Tu sugerencia")
          .setPlaceholder("Describe tu idea con claridad.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1500)
      )
    );
}

function buildReviewModal() {
  return new ModalBuilder()
    .setCustomId("review_modal")
    .setTitle("Dejar reseña")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("service")
          .setLabel("Servicio recibido")
          .setPlaceholder("Ej: Producto, Servicio, Soporte, Garantia...")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("rating")
          .setLabel("Puntuación del 1 al 5")
          .setPlaceholder("Ej: 5")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(1)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("comment")
          .setLabel("Tu reseña")
          .setPlaceholder("Cuenta cómo fue tu experiencia con el servicio.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1200)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("imageUrl")
          .setLabel("Foto opcional")
          .setPlaceholder("Pega URL de imagen o deja vacio")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(500)
      )
    );
}

module.exports = {
  name: "interactionCreate",
  once: false,
  async execute(interaction) {
    if (interaction.isButton()) {
      const [action, value, extra] = interaction.customId.split(":");

      if (action === "ticket_open") {
        return interaction.showModal(buildTicketModal(value));
      }

      if (interaction.customId === "ticket_close") return closeTicket(interaction);
      if (interaction.customId === "ticket_claim") return claimTicket(interaction);
      if (interaction.customId === "ticket_complete") return completeTicket(interaction);
      if (action === "ticket_complete_schedule") {
        return completeTicketWithSchedule(interaction, value, extra);
      }
      if (interaction.customId === "suggestion_open") {
        return interaction.showModal(buildSuggestionModal());
      }
      if (interaction.customId === "review_open") {
        return interaction.showModal(buildReviewModal());
      }

      if (action === "custom_embed_open") {
        return interaction.showModal(buildCustomEmbedModal());
      }

      if (action === "giveaway_open") {
        return interaction.showModal(buildGiveawayModal());
      }

      if (action === "suggestion_vote") return voteSuggestion(interaction, value, extra);
      if (action === "suggestion_approve") {
        return moderateSuggestion(interaction, value, "approved");
      }
      if (action === "suggestion_reject") {
        return moderateSuggestion(interaction, value, "rejected");
      }
      if (action === "review_helpful") return markReviewHelpful(interaction, value);
      if (action === "giveaway_join") return joinGiveaway(interaction, value);
      if (action === "giveaway_end") return endGiveawayButton(interaction, value);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "autorole_toggle") {
      return toggleAutoroles(interaction);
    }

    if (interaction.isModalSubmit()) {
      const [modal, categoryKey] = interaction.customId.split(":");

      if (modal === "ticket_modal") {
        return createTicket(interaction, {
          categoryKey,
          reason: interaction.fields.getTextInputValue("reason"),
          details: interaction.fields.getTextInputValue("details"),
        });
      }

      if (interaction.customId === "suggestion_modal") {
        return createSuggestion(
          interaction,
          interaction.fields.getTextInputValue("suggestion")
        );
      }

      if (interaction.customId === "review_modal") {
        return createReview(interaction, {
          service: interaction.fields.getTextInputValue("service"),
          rating: interaction.fields.getTextInputValue("rating"),
          comment: interaction.fields.getTextInputValue("comment"),
          imageUrl: interaction.fields.getTextInputValue("imageUrl"),
        });
      }

      if (modal === "custom_embed_modal") {
        return sendCustomEmbedFromModal(interaction);
      }

      if (modal === "giveaway_modal") {
        return createGiveawayFromModal(interaction);
      }
    }
  },
};
