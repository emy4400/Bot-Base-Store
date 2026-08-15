const fs = require("node:fs");
const path = require("node:path");

function getEventFiles(dirpath) {
  const entries = fs.readdirSync(dirpath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirpath, entry.name);

    if (entry.isDirectory()) {
      files.push(...getEventFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function clearEventCache() {
  const root = path.join(__dirname, "..");
  for (const key of Object.keys(require.cache)) {
    if (
      key.startsWith(path.join(root, "Events")) ||
      key.startsWith(path.join(root, "Utils")) ||
      key.startsWith(path.join(root, "Handlers"))
    ) {
      delete require.cache[key];
    }
  }
}

async function unloadEvents(client) {
  if (!client.loadedEvents) return;

  for (const loaded of client.loadedEvents) {
    client.off(loaded.name, loaded.listener);
  }

  client.loadedEvents = [];
}

async function loadEvents(client, options = {}) {
  if (options.reload) {
    await unloadEvents(client);
    clearEventCache();
  }

  const eventspath = path.join(__dirname, "../Events");
  const eventfiles = getEventFiles(eventspath);
  client.loadedEvents = client.loadedEvents || [];

  for (const file of eventfiles) {
    const event = require(file);
    const listener = async (...args) => {
      try {
        await event.execute(...args, client);
      } catch (error) {
        console.error(`[EVENT ERROR] ${event.name}`, error);
        const anticrash = require("../Utils/anticrash");
        anticrash.sendCrashReport(client, `event:${event.name}`, error, file).catch(() => null);
      }
    };

    if (event.once) {
      client.once(event.name, listener);
    } else {
      client.on(event.name, listener);
    }
    client.loadedEvents.push({ name: event.name, listener, file });
  }

  console.log(`EVENTOS CARGADOS CORRECTAMENTE ✅`);
  return eventfiles;
}

module.exports = { clearEventCache, loadEvents, unloadEvents };
