const { restoreGiveawayTimers } = require("../../Utils/giveaways");
const { startMemberStats } = require("../../Utils/memberStats");
const { printStartupReport } = require("../../Utils/startupReport");

module.exports = {
  name: "clientReady",
  once: true,
  async execute(client) {
    restoreGiveawayTimers(client);
    startMemberStats(client);
    printStartupReport(client);
  },
};
