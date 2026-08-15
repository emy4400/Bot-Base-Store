function yesNo(value) {
  return value ? "OK" : "PENDIENTE";
}

function commandRows(client) {
  const config = client.config || {};
  return [
    ["!ticket-panel", "Tickets", yesNo(config.tickets?.categoryId)],
    ["!sugerencias-panel", "Sugerencias", yesNo(config.suggestions?.channelId)],
    ["!autoroles-panel", "Autoroles", "OK"],
    ["!reseñas-panel", "Reseñas", yesNo(config.reviews?.channelId)],
    ["!embed-crear", "Embed personalizado con modal", "OK"],
    ["!sorteo", "Sorteos con modal", yesNo(config.giveaways?.staffRoleId)],
    ["!bot-status", "Estado + configuracion", "OK"],
    ["!clear 10/50/100", "Moderacion: limpiar chat", yesNo(config.moderation?.staffRoleIds?.length)],
    ["!ban / !kick / !timeout", "Moderacion de usuarios", yesNo(config.moderation?.staffRoleIds?.length)],
    ["!reload", "Reload master", yesNo(config.moderation?.staffRoleIds?.length)],
    ["!stats-setup", "Contadores de servidor", yesNo(config.memberStats?.clientRoleId)],
    ["!stats-refresh", "Recargar contadores", "OK"],
    ["!redes", "Redes sociales con botones", yesNo((config.socials?.links || []).some((item) => item.url))],
    ["!invitacion", "Invitacion oficial del servidor", config.serverInvite?.url || config.serverInvite?.channelId ? "OK" : "AUTO"],
    ["!setup-servidor", "Roles, categorias y canales base", yesNo(config.serverSetup?.staffRoleIds?.length)],
    ["!ayuda", "Menu de ayuda", "OK"],
  ].map(([command, system, status]) => ({ command, system, status }));
}

function configRows(client) {
  const config = client.config || {};
  return [
    { item: "Bot", value: client.user?.tag || "Conectado", status: "OK" },
    { item: "Prefix", value: config.prefix || "!", status: "OK" },
    { item: "Brand", value: config.brand?.name || "Discord Store Bot", status: "OK" },
    { item: "Color", value: config.brand?.color || "Sin color", status: yesNo(config.brand?.color) },
    { item: "Logo", value: config.brand?.logoUrl ? "Configurado" : "No configurado", status: yesNo(config.brand?.logoUrl) },
    { item: "Tickets staffRoleId", value: config.tickets?.staffRoleId || "Pendiente", status: yesNo(config.tickets?.staffRoleId) },
    { item: "Tickets openRoleId", value: config.tickets?.openRoleId || "Opcional sin configurar", status: config.tickets?.openRoleId ? "OK" : "OPCIONAL" },
    { item: "Welcome channel", value: config.welcome?.welcomeChannelId || "Pendiente", status: yesNo(config.welcome?.welcomeChannelId) },
    { item: "Farewell channel", value: config.welcome?.farewellChannelId || "Pendiente", status: yesNo(config.welcome?.farewellChannelId) },
    { item: "Moderation roles", value: (config.moderation?.staffRoleIds || []).join(", ") || "Pendiente", status: yesNo(config.moderation?.staffRoleIds?.length) },
    { item: "Moderation logs", value: config.moderation?.logChannelId || "Opcional sin configurar", status: config.moderation?.logChannelId ? "OK" : "OPCIONAL" },
    { item: "Anticrash logs", value: config.anticrash?.logChannelId || "Pendiente", status: yesNo(config.anticrash?.logChannelId) },
    { item: "Stats category", value: config.memberStats?.categoryId || "Se crea con !stats-setup", status: config.memberStats?.categoryId ? "OK" : "PENDIENTE" },
    { item: "Stats client role", value: config.memberStats?.clientRoleId || "Pendiente", status: yesNo(config.memberStats?.clientRoleId) },
    { item: "Social links", value: `${(config.socials?.links || []).filter((item) => item.url).length} configurados`, status: yesNo((config.socials?.links || []).some((item) => item.url)) },
    { item: "Server invite", value: config.serverInvite?.url || config.serverInvite?.channelId || "Auto en el canal del comando", status: config.serverInvite?.url || config.serverInvite?.channelId ? "OK" : "AUTO" },
    { item: "Server setup roles", value: `${(config.serverSetup?.roles || []).length} roles base`, status: yesNo(config.serverSetup?.roles?.length) },
    { item: "Server setup categories", value: `${(config.serverSetup?.categories || []).length} categorias base`, status: yesNo(config.serverSetup?.categories?.length) },
    { item: "Server setup staff", value: (config.serverSetup?.staffRoleIds || []).join(", ") || "Pendiente", status: yesNo(config.serverSetup?.staffRoleIds?.length) },
    { item: "Node.js", value: process.version, status: "OK" },
    { item: "Discord.js", value: require("discord.js").version, status: "OK" },
  ];
}

function printStartupReport(client) {
  const line = "=".repeat(72);
  console.log(line);
  console.log(`${client.config?.brand?.name || "DISCORD STORE BOT"} | STARTUP REPORT`);
  console.log(line);
  console.table(configRows(client));
  console.log("COMMAND HEALTH CHECK");
  console.table(commandRows(client));
  console.log("Resultado: si un comando aparece OK, el handler existe y el sistema base cargo.");
  console.log("Nota: IDs marcados como PENDIENTE/OPCIONAL se configuran en config.json.");
  console.log(line);
}

module.exports = {
  commandRows,
  configRows,
  printStartupReport,
};
