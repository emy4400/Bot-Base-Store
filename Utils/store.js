const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "../data");

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function readStore(name, fallback = {}) {
  ensureDataDir();
  const filePath = path.join(dataDir, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeStore(name, data) {
  ensureDataDir();
  const filePath = path.join(dataDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { readStore, writeStore };
