const { Client, Collection, Partials } = require("discord.js");
const config = require("./config.json");
const { loadEvents } = require("./Handlers/eventHandler");
const { installAnticrash } = require("./Utils/anticrash");

const token = process.env.DISCORD_TOKEN || config.token;

if (!token) {
  console.error(
    "Falta el token del bot. Configura DISCORD_TOKEN o agrega un token local en config.json.",
  );
  process.exit(1);
}

const client = new Client({
  intents: [53608447],
  partials: [Partials.Message, Partials.Channel, Partials.User],
});

client.events = new Collection();
client.config = config;
installAnticrash(client);
loadEvents(client);

client.login(token);
