const { ChannelType } = require("discord.js");

const QUESTION_TIMEOUT = 120000;

async function askQuestion(message, question, validate = null) {
  await message.channel.send(question);

  const collected = await message.channel.awaitMessages({
    filter: (reply) => reply.author.id === message.author.id && !reply.author.bot,
    max: 1,
    time: QUESTION_TIMEOUT,
  });

  const reply = collected.first();
  if (!reply) {
    throw new Error("Tiempo agotado. Vuelve a ejecutar el comando cuando estes listo.");
  }

  const value = reply.content.trim();
  if (validate) {
    const result = validate(value, reply);
    if (result !== true) throw new Error(result);
  }

  return { value, message: reply };
}

function resolveTextChannel(guild, value) {
  const clean = String(value || "").replace(/[<#>]/g, "").trim();
  if (!clean) return null;

  return (
    guild.channels.cache.get(clean) ||
    guild.channels.cache.find(
      (channel) =>
        channel.name?.toLowerCase() === clean.toLowerCase() &&
        channel.isTextBased(),
    ) ||
    null
  );
}

function parseDuration(value) {
  const match = String(value || "").trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return amount * multipliers[unit];
}

function parseAnnouncementTag(guild, value) {
  const clean = String(value || "").trim();
  const lower = clean.toLowerCase();

  if (["no", "ninguno", "sin tag", "sin"].includes(lower)) {
    return { content: "", allowedMentions: { parse: [] } };
  }

  if (["@everyone", "everyone"].includes(lower)) {
    return { content: "@everyone", allowedMentions: { parse: ["everyone"] } };
  }

  if (["@here", "here"].includes(lower)) {
    return { content: "@here", allowedMentions: { parse: ["everyone"] } };
  }

  const roleId = clean.replace(/[<@&>]/g, "");
  const role = guild.roles.cache.get(roleId) ||
    guild.roles.cache.find((item) => item.name.toLowerCase() === lower);

  if (!role) return null;

  return {
    content: `<@&${role.id}>`,
    allowedMentions: { roles: [role.id] },
  };
}

function isSendableTextChannel(channel) {
  return Boolean(
    channel &&
      channel.isTextBased() &&
      [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
      ].includes(channel.type),
  );
}

module.exports = {
  askQuestion,
  isSendableTextChannel,
  parseAnnouncementTag,
  parseDuration,
  resolveTextChannel,
};
