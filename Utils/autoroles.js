const {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

function getBrand(client) {
  return client.config.brand || {};
}

function getAutoroles(client) {
  return client.config.autoroles?.roles || [];
}

function buildAutorolesPanel(client) {
  const brand = getBrand(client);
  const roles = getAutoroles(client).filter((role) => role.id);

  const embed = new EmbedBuilder()
    .setColor(brand.color || "#5865F2")
    .setTitle("🎭 Autoroles")
    .setDescription(
      roles.length
        ? "Selecciona tus roles para activarlos o quitarlos de tu perfil."
        : "Configura roles en config.json antes de publicar este panel."
    )
    .setFooter({ text: brand.footer || brand.name || "Autoroles" });

  if (!roles.length) return { embeds: [embed], components: [] };

  const menu = new StringSelectMenuBuilder()
    .setCustomId("autorole_toggle")
    .setPlaceholder("Selecciona roles")
    .setMinValues(1)
    .setMaxValues(Math.min(roles.length, 25))
    .addOptions(
      roles.slice(0, 25).map((role) => ({
        label: role.label,
        value: role.id,
        description: role.description || `Activar o quitar ${role.label}`,
        emoji: role.emoji || undefined,
      }))
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
  };
}

async function toggleAutoroles(interaction) {
  const allowedRoles = new Set(getAutoroles(interaction.client).map((role) => role.id));
  const selectedRoles = interaction.values.filter((roleId) => allowedRoles.has(roleId));
  const added = [];
  const removed = [];

  for (const roleId of selectedRoles) {
    if (interaction.member.roles.cache.has(roleId)) {
      await interaction.member.roles.remove(roleId).catch(() => null);
      removed.push(`<@&${roleId}>`);
    } else {
      await interaction.member.roles.add(roleId).catch(() => null);
      added.push(`<@&${roleId}>`);
    }
  }

  const lines = [];
  if (added.length) lines.push(`Añadidos: ${added.join(", ")}`);
  if (removed.length) lines.push(`Quitados: ${removed.join(", ")}`);

  await interaction.reply({
    content: lines.length ? lines.join("\n") : "No pude modificar esos roles.",
    ephemeral: true,
  });
}

module.exports = { buildAutorolesPanel, toggleAutoroles };
