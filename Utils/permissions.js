const { PermissionFlagsBits } = require("discord.js");

function normalizeRoleIds(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function hasAnyRole(member, roleIds) {
  const ids = normalizeRoleIds(roleIds);
  return Boolean(member && ids.some((roleId) => member.roles.cache.has(roleId)));
}

function canUseStaffSystem(member, client, section = "moderation") {
  if (!member) return false;
  const roleIds = client.config?.[section]?.staffRoleIds || client.config?.[section]?.staffRoleId;
  return (
    hasAnyRole(member, roleIds) ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

function missingRoleMessage(client, section = "moderation") {
  const roleIds = normalizeRoleIds(
    client.config?.[section]?.staffRoleIds || client.config?.[section]?.staffRoleId,
  );

  if (!roleIds.length) {
    return "Faltan permisos. Configura primero el rol autorizado en `config.json`.";
  }

  return `Faltan permisos. Necesitas uno de estos roles: ${roleIds
    .map((roleId) => `<@&${roleId}>`)
    .join(", ")}`;
}

module.exports = {
  canUseStaffSystem,
  hasAnyRole,
  missingRoleMessage,
  normalizeRoleIds,
};
