const { PermissionFlagsBits } = require("discord.js");
const { buildAutorolesPanel } = require("../../Utils/autoroles");
const { createCustomEmbedWizard } = require("../../Utils/customEmbeds");
const {
  createGiveawayWizard,
  endGiveawayCommand,
} = require("../../Utils/giveaways");
const { buildReviewsPanel } = require("../../Utils/reviews");
const {
  banCommand,
  clearCommand,
  kickCommand,
  timeoutCommand,
} = require("../../Utils/moderation");
const {
  memberStatsRefreshCommand,
  memberStatsSetupCommand,
} = require("../../Utils/memberStats");
const { sendInviteCommand } = require("../../Utils/invite");
const { reloadMasterCommand } = require("../../Utils/reload");
const { serverSetupCommand } = require("../../Utils/serverSetup");
const { sendSocialsCommand } = require("../../Utils/socials");
const { sendBotStatus } = require("../../Utils/status");
const { buildSuggestionPanel } = require("../../Utils/suggestions");
const { buildTicketPanel } = require("../../Utils/tickets");

function canManageServer(message) {
  return message.member?.permissions.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
  name: "messageCreate",
  once: false,
  async execute(message, client) {
    if (message.author.bot) return;

    const prefix = client.config.prefix || "!";
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/\s+/);
      const command = args.shift()?.toLowerCase();
      if (!command) return;

      if (["embed-crear", "crear-embed", "custom-embed"].includes(command)) {
        return createCustomEmbedWizard(message);
      }

      if (["ticket-panel", "tickets"].includes(command)) {
        if (!canManageServer(message)) {
          return message.reply("Necesitas permiso de administrar servidor para usar este comando.");
        }

        await message.channel.send(buildTicketPanel(client));
        return message.reply("Panel de tickets publicado.");
      }

      if (["sugerencias-panel", "suggestions-panel"].includes(command)) {
        if (!canManageServer(message)) {
          return message.reply("Necesitas permiso de administrar servidor para usar este comando.");
        }

        await message.channel.send(buildSuggestionPanel(client));
        return message.reply("Panel de sugerencias publicado.");
      }

      if (["autoroles-panel", "roles-panel"].includes(command)) {
        if (!canManageServer(message)) {
          return message.reply("Necesitas permiso de administrar servidor para usar este comando.");
        }

        await message.channel.send(buildAutorolesPanel(client));
        return message.reply("Panel de autoroles publicado.");
      }

      if (["reseñas-panel", "resenas-panel", "reviews-panel"].includes(command)) {
        if (!canManageServer(message)) {
          return message.reply("Necesitas permiso de administrar servidor para usar este comando.");
        }

        await message.channel.send(buildReviewsPanel(client));
        return message.reply("Panel de reseñas publicado.");
      }

      if (command === "sorteo") {
        return createGiveawayWizard(message);
      }

      if (["giveaway-end", "sorteo-finalizar"].includes(command)) {
        return endGiveawayCommand(message, args);
      }

      if (["bot-status", "estado-bot", "status-bot"].includes(command)) {
        return sendBotStatus(message);
      }

      if (command === "clear") return clearCommand(message, args);
      if (command === "ban") return banCommand(message, args);
      if (command === "kick") return kickCommand(message, args);
      if (["timeout", "time-out"].includes(command)) return timeoutCommand(message, args);

      if (["reload", "reload-master", "reload-events", "reload-commands"].includes(command)) {
        return reloadMasterCommand(message);
      }

      if (["stats-setup", "memberstats-setup", "contador-miembros"].includes(command)) {
        return memberStatsSetupCommand(message);
      }

      if (["stats-refresh", "memberstats-refresh", "recargar-contadores"].includes(command)) {
        return memberStatsRefreshCommand(message);
      }

      if (["redes", "redes-sociales", "socials"].includes(command)) {
        return sendSocialsCommand(message);
      }

      if (["invitacion", "invite", "server-invite"].includes(command)) {
        return sendInviteCommand(message);
      }

      if (["setup-servidor", "servidor-setup", "server-setup"].includes(command)) {
        return serverSetupCommand(message);
      }

      if (command === "ayuda") {
        return message.reply(
          [
            "**Comandos disponibles**",
            "`!ticket-panel` - publica el panel avanzado de tickets.",
            "`!sugerencias-panel` - publica el panel avanzado de sugerencias.",
            "`!autoroles-panel` - publica el panel de autoroles.",
            "`!reseñas-panel` - publica el panel avanzado de reseñas.",
            "`!embed-crear` - crea un embed personalizado con cuestionario.",
            "`!sorteo` - crea un sorteo guiado por cuestionario.",
            "`!giveaway-end <id_del_mensaje>` - finaliza un sorteo manualmente.",
            "`!bot-status` - muestra estado tecnico y configuracion importante.",
            "`!clear 10|50|100` - limpia mensajes del canal.",
            "`!ban @usuario razon` - banea usuarios.",
            "`!kick @usuario razon` - expulsa usuarios.",
            "`!timeout @usuario 10m razon` - aplica timeout.",
            "`!reload` - recarga eventos y handler principal.",
            "`!stats-setup` - crea la categoria de contadores.",
            "`!stats-refresh` - actualiza los contadores manualmente.",
            "`!redes` - publica redes sociales con botones.",
            "`!invitacion` - publica la invitacion oficial del servidor.",
            "`!setup-servidor` - crea roles, categorias y canales base.",
          ].join("\n")
        );
      }
    }

    if (message.content === "hola") return message.reply("Hola, ¿cómo estás?");
    if (message.content === "adiós")
      return message.reply("Adiós, ¡que tengas un buen día!");
    if (message.content === "gracias") return message.reply("¡De nada!");
  },
};
