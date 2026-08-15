const { sendMemberLog } = require("../../Utils/welcome");

module.exports = {
  name: "guildMemberAdd",
  once: false,
  async execute(member) {
    return sendMemberLog(member, "welcome");
  },
};
