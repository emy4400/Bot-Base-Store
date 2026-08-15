const { sendMemberLog } = require("../../Utils/welcome");

module.exports = {
  name: "guildMemberRemove",
  once: false,
  async execute(member) {
    return sendMemberLog(member, "farewell");
  },
};
