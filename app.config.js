// app.config.js — dynamic config so EAS secrets can be injected at build time.
// The static app.json is still read by Expo; this file augments/overrides it.
// GOOGLE_SERVICES_JSON is set as an EAS File Secret and resolves to the
// absolute path of the injected google-services.json during the build.

const base = require('./app.json')

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    android: {
      ...base.expo.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  },
}
