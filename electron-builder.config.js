require('dotenv').config();

const hasAppleCreds = Boolean(
  process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID
);

module.exports = {
  appId: 'com.faynosync.squirrelexample',
  productName: 'FaynoSync-squirrel',
  files: ['src/**/*', 'main.js', 'package.json'],
  extraMetadata: {
    faynosync: {
      appName: process.env.APP_NAME,
      version: process.env.VERSION,
      channel: process.env.CHANNEL,
      owner: process.env.OWNER,
      baseURL: process.env.BASE_URL,
      edgeURL: process.env.EDGE_URL,
      reportKey: process.env.REPORT_KEY,
      autoDownload: process.env.AUTO_DOWNLOAD,
    },
  },
  directories: {
    buildResources: 'assets',
  },
  afterAllArtifactBuild: 'scripts/notarize-artifacts.cjs',
  mac: {
    target: ['dmg', 'zip'],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    notarize: hasAppleCreds ? { teamId: process.env.APPLE_TEAM_ID } : false,
  },
  dmg: {
    sign: true,
  },
  win: {
    target: [{ target: 'squirrel', arch: ['x64'] }],
  },
  squirrelWindows: {
    artifactName: '${productName}-Setup-${version}.${ext}',
  },
  linux: {
    target: ['AppImage', 'deb'],
  },
};
