const base = require("./app.json");

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    extra: {
      ...base.expo.extra,
      apiUrl: process.env.API_URL ?? "http://localhost:8000",
    },
  },
};
