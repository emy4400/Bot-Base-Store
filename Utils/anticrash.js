const { EmbedBuilder } = require("discord.js");

let installed = false;
let lastReports = new Map();

function cleanText(value, max = 1000) {
  return String(value || "No disponible").slice(0, max);
}

function getBrand(client) {
  return client.config.brand || {};
}

async function sendCrashReport(client, type, reason, origin = null) {
  const channelId = client.config.anticrash?.logChannelId;
  if (!channelId) return;

  const fingerprint = `${type}:${cleanText(reason?.message || reason, 160)}`;
  const now = Date.now();
  if (lastReports.get(fingerprint) && now - lastReports.get(fingerprint) < 15000) return;
  lastReports.set(fingerprint, now);

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const brand = getBrand(client);
  const includeStack = client.config.anticrash?.includeStack !== false;
  const stack = reason?.stack || reason;
  const embed = new EmbedBuilder()
    .setColor("#ED4245")
    .setAuthor({ name: brand.name || "Discord Store Bot", iconURL: brand.logoUrl || undefined })
    .setTitle("Reporte anticrash")
    .setDescription("Se detecto un error y el bot lo contuvo para seguir activo.")
    .addFields(
      { name: "Tipo", value: cleanText(type, 256), inline: true },
      { name: "Origin / Promise", value: cleanText(origin || "No disponible", 256), inline: true },
      { name: "Reason", value: cleanText(reason?.message || reason, 1000), inline: false },
      {
        name: "Stack",
        value: includeStack ? `\`\`\`js\n${cleanText(stack, 900)}\n\`\`\`` : "Oculto por configuracion.",
        inline: false,
      },
    )
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Anticrash" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  await channel.send({ embeds: [embed] }).catch(() => null);
}

function installAnticrash(client) {
  if (installed) return;
  installed = true;

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[ANTICRASH] Unhandled Rejection:", reason);
    sendCrashReport(client, "unhandledRejection", reason, promise).catch(() => null);
  });

  process.on("uncaughtException", (error, origin) => {
    console.error("[ANTICRASH] Uncaught Exception:", error);
    sendCrashReport(client, "uncaughtException", error, origin).catch(() => null);
  });

  process.on("uncaughtExceptionMonitor", (error, origin) => {
    console.error("[ANTICRASH MONITOR]", error);
    sendCrashReport(client, "uncaughtExceptionMonitor", error, origin).catch(() => null);
  });

  process.on("warning", (warning) => {
    console.warn("[ANTICRASH WARNING]", warning);
    sendCrashReport(client, "processWarning", warning, "warning").catch(() => null);
  });
}

module.exports = {
  installAnticrash,
  sendCrashReport,
};
