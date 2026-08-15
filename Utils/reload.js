const { EmbedBuilder } = require("discord.js");
const { loadEvents } = require("../Handlers/eventHandler");
const { canUseStaffSystem, missingRoleMessage } = require("./permissions");

function getBrand(client) {
  return client.config.brand || {};
}

async function reloadMasterCommand(message) {
  if (!canUseStaffSystem(message.member, message.client, "moderation")) {
    return message.reply(missingRoleMessage(message.client, "moderation"));
  }

  const started = Date.now();
  const reply = await message.reply("Recargando sistemas...");
  const results = [];

  try {
    const files = await loadEvents(message.client, { reload: true });
    results.push({ name: "Eventos", value: `${files.length} archivos`, inline: true });
    results.push({ name: "Comandos", value: "Handler de mensajes activo", inline: true });
    results.push({ name: "Utilidades", value: "Cache recargada", inline: true });
  } catch (error) {
    results.push({ name: "Error", value: `\`\`\`js\n${String(error.stack || error).slice(0, 900)}\n\`\`\`` });
  }

  const brand = getBrand(message.client);
  const hasError = results.some((item) => item.name === "Error");
  const embed = new EmbedBuilder()
    .setColor(hasError ? "#ED4245" : "#57F287")
    .setAuthor({ name: brand.name || "Discord Store Bot", iconURL: brand.logoUrl || undefined })
    .setTitle(hasError ? "Reload con errores" : "Reload master completado")
    .setDescription(
      hasError
        ? "Se intento recargar el bot, pero una parte fallo. Revisa el detalle."
        : "Todos los sistemas principales quedaron en verde.",
    )
    .addFields(
      ...results,
      { name: "Tiempo", value: `${Date.now() - started} ms`, inline: true },
      { name: "Ejecutado por", value: `${message.author}`, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Reload" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  return reply.edit({ content: "", embeds: [embed] });
}

module.exports = {
  reloadMasterCommand,
};
