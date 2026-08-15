const { EmbedBuilder } = require("discord.js");

function getBrand(client) {
  return client.config.brand || {};
}

function getWelcomeConfig(client) {
  return client.config.welcome || {};
}

function replaceTokens(template, member) {
  return String(template || "")
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{tag}", member.user.tag)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{memberCount}", `${member.guild.memberCount || "?"}`);
}

function buildMemberEmbed(member, type) {
  const brand = getBrand(member.client);
  const config = getWelcomeConfig(member.client);
  const isWelcome = type === "welcome";
  const title = isWelcome
    ? config.welcomeTitle || "Bienvenido al servidor"
    : config.farewellTitle || "Un miembro salio del servidor";
  const description = isWelcome
    ? config.welcomeMessage ||
      "Hola {user}, bienvenido a **{server}**. Abre un ticket si necesitas comprar, soporte o garantia."
    : config.farewellMessage ||
      "**{tag}** salio de **{server}**. Ahora somos **{memberCount}** miembros.";

  const embed = new EmbedBuilder()
    .setColor(isWelcome ? brand.color || "#F54927" : "#2B2D31")
    .setAuthor({
      name: brand.name || "Discord Store Bot",
      iconURL: brand.logoUrl || undefined,
    })
    .setTitle(replaceTokens(title, member))
    .setDescription(replaceTokens(description, member))
    .addFields(
      {
        name: isWelcome ? "Cliente" : "Usuario",
        value: `${member.user.tag}\nID: ${member.id}`,
        inline: true,
      },
      {
        name: "Miembros",
        value: `${member.guild.memberCount || "?"}`,
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Discord Store Bot" });

  if (member.user.displayAvatarURL) {
    embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
  } else if (brand.logoUrl) {
    embed.setThumbnail(brand.logoUrl);
  }

  if (config.imageUrl) embed.setImage(config.imageUrl);
  return embed;
}

async function sendMemberLog(member, type) {
  const config = getWelcomeConfig(member.client);
  const enabledKey = type === "welcome" ? "welcomeEnabled" : "farewellEnabled";
  const channelKey = type === "welcome" ? "welcomeChannelId" : "farewellChannelId";

  if (config[enabledKey] === false) return;
  if (!config[channelKey]) return;

  const channel = await member.client.channels.fetch(config[channelKey]).catch(() => null);
  if (!channel?.isTextBased()) return;

  await channel.send({
    content: type === "welcome" ? replaceTokens(config.welcomePing || "", member) : "",
    embeds: [buildMemberEmbed(member, type)],
    allowedMentions: config.welcomePing ? { users: [member.id] } : { parse: [] },
  }).catch(() => null);
}

module.exports = {
  sendMemberLog,
};
