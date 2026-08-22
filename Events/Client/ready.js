const { restoreGiveawayTimers } = require("../../Utils/giveaways");
const { startMemberStats } = require("../../Utils/memberStats");
const { printStartupReport } = require("../../Utils/startupReport");
const { restoreTicketTimers } = require("../../Utils/tickets");

module.exports = {
  name: "clientReady",
  once: true,
  async execute(client) {
    restoreGiveawayTimers(client);
    restoreTicketTimers(client);
    startMemberStats(client);
    printStartupReport(client);
  },
};
