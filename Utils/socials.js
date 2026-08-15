const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

function getBrand(client) {
  return client.config.brand || {};
}

function validLinks(client) {
  return (client.config.socials?.links || []).filter((item) => item.label && item.url?.startsWith("http"));
}

function buildSocialRows(client) {
  const rows = [];
  const links = validLinks(client).slice(0, 25);

  for (let index = 0; index < links.length; index += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        links.slice(index, index + 5).map((item) =>
          new ButtonBuilder()
            .setLabel(item.label.slice(0, 80))
            .setStyle(ButtonStyle.Link)
            .setURL(item.url),
        ),
      ),
    );
  }

  return rows;
}

function buildSocialEmbed(client) {
  const brand = getBrand(client);
  const socials = client.config.socials || {};
  const links = validLinks(client);
  const embed = new EmbedBuilder()
    .setColor(brand.color || "#F54927")
    .setAuthor({ name: brand.name || "Discord Store Bot", iconURL: brand.logoUrl || undefined })
    .setTitle(socials.title || "Redes oficiales")
    .setDescription(
      [
        socials.description || "Encuentra nuestras redes oficiales y canales de contacto.",
        "",
        links.length
          ? "Pulsa los botones para abrir cada red."
          : "No hay links configurados todavia. Agregalos en `config.json`.",
      ].join("\n"),
    )
    .setTimestamp()
    .setFooter({ text: brand.footer || brand.name || "Redes oficiales" });

  if (brand.logoUrl) embed.setThumbnail(brand.logoUrl);
  return embed;
}

async function sendSocialsCommand(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return message.reply("Necesitas permiso de administrar servidor para publicar las redes.");
  }

  return message.channel.send({
    embeds: [buildSocialEmbed(message.client)],
    components: buildSocialRows(message.client),
  });
}

module.exports = {
  buildSocialEmbed,
  buildSocialRows,
  sendSocialsCommand,
};
