const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

function getBrand(client) {
  return client.config.brand || {};
}

function formatUptime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function buildBotStatusEmbed(client, message) {
  const brand = getBrand(client);
  const config = client.config || {};
  const tickets = config.tickets || {};
  const suggestions = config.suggestions || {};
  const reviews = config.reviews || {};
  const giveaways = config.giveaways || {};
  const moderation = config.moderation || {};
  const anticrash = config.anticrash || {};
  const memberStats = config.memberStats || {};
  const socials = config.socials || {};
  const serverInvite = config.serverInvite || {};
  const serverSetup = config.serverSetup || {};
  const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const guild = message.guild;
  const status = (value) => (value ? "Configurado" : "Pendiente");
  const countLinks = (socials.links || []).filter((item) => item.url).length;

  const embed = new EmbedBuilder()
    .setColor(brand.color || "#F54927")
    .setTitle(`${brand.name || "Discord Store Bot"} | Estado del bot`)
    .setDescription(
      [
        "Panel general del bot, servidor y configuracion principal.",
        "",
        "Usa este comando para revisar rapidamente si los sistemas de la tienda estan listos.",
      ].join("\n"),
    )
    .addFields(
      {
        name: "🤖 Bot",
        value: [
          `**Usuario:** ${client.user?.tag || "Conectado"}`,
          `**Ping:** ${Math.round(client.ws.ping)} ms`,
          `**Activo:** ${formatUptime(process.uptime())}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "⚙️ Sistema",
        value: [
          `**Node.js:** ${process.version}`,
          `**Discord.js:** ${require("discord.js").version}`,
          `**Memoria:** ${memoryMb} MB`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "🏠 Servidor",
        value: guild
          ? [
              `**Nombre:** ${guild.name}`,
              `**Miembros:** ${guild.memberCount || "?"}`,
              `**Canales:** ${guild.channels.cache.size}`,
            ].join("\n")
          : "No disponible",
        inline: true,
      },
      {
        name: "🎫 Tickets",
        value: [
          `**Categoria:** ${status(tickets.categoryId)}`,
          `**Logs:** ${status(tickets.logChannelId)}`,
          `**Rol al crear ticket:** ${status(tickets.openRoleId)}`,
          `**Staff:** ${status(tickets.staffRoleId)}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "📌 Sistemas",
        value: [
          `**Sugerencias:** ${status(suggestions.channelId)}`,
          `**Resenas:** ${status(reviews.channelId)}`,
          `**Sorteos staff:** ${status(giveaways.staffRoleId)}`,
          `**Bienvenida:** ${status(config.welcome?.welcomeChannelId)}`,
          `**Despedida:** ${status(config.welcome?.farewellChannelId)}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "🛡️ Moderacion",
        value: [
          `**Roles staff:** ${status((moderation.staffRoleIds || []).length)}`,
          `**Logs:** ${status(moderation.logChannelId)}`,
          `**Clear:** ${(moderation.clearAmounts || [10, 50, 100]).join(", ")}`,
          `**Anticrash:** ${status(anticrash.logChannelId)}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "📊 Contadores",
        value: [
          `**Categoria:** ${status(memberStats.categoryId)}`,
          `**Rol clientes:** ${status(memberStats.clientRoleId)}`,
          `**Recarga:** cada ${memberStats.refreshMinutes || 10} min`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "🔗 Redes",
        value: [
          `**Links activos:** ${countLinks}`,
          `**Comando:** \`${config.prefix || "!"}redes\``,
        ].join("\n"),
        inline: true,
      },
      {
        name: "🏗️ Setup V8",
        value: [
          `**Invitacion:** ${serverInvite.url ? "URL fija" : serverInvite.channelId ? "Canal configurado" : "Auto"}`,
          `**Roles base:** ${(serverSetup.roles || []).length}`,
          `**Categorias base:** ${(serverSetup.categories || []).length}`,
          `**Staff setup:** ${status((serverSetup.staffRoleIds || []).length)}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "🎨 Marca",
        value: [
          `**Nombre:** ${brand.name || "Discord Store Bot"}`,
          `**Color:** ${brand.color || "Pendiente"}`,
          `**Logo:** ${status(brand.logoUrl)}`,
        ].join("\n"),
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Estado del bot" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  return embed;
}

function canViewStatus(message) {
  return message.member?.permissions.has(PermissionFlagsBits.ManageGuild);
}

async function sendBotStatus(message) {
  if (!canViewStatus(message)) {
    return message.reply("Necesitas permiso de administrar servidor para ver el estado del bot.");
  }
  return message.reply({ embeds: [buildBotStatusEmbed(message.client, message)] });
}

module.exports = {
  buildBotStatusEmbed,
  sendBotStatus,
};
