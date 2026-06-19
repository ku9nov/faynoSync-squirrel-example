const { existsSync } = require('node:fs');
const { execFileSync } = require('node:child_process');

exports.default = async function afterAllArtifactBuild(context) {
  const artifactPaths = Array.isArray(context?.artifactPaths)
    ? context.artifactPaths
    : [];
  const dmgPaths = artifactPaths.filter((artifactPath) =>
    artifactPath.toLowerCase().endsWith('.dmg')
  );
  if (dmgPaths.length === 0) return;

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log(
      '[notarize-artifacts] Skipping DMG notarization: Apple credentials are not set'
    );
    return;
  }

  const { notarize } = require('@electron/notarize');
  for (const dmgPath of dmgPaths) {
    if (!existsSync(dmgPath)) {
      throw new Error(`[notarize-artifacts] DMG file not found: ${dmgPath}`);
    }
    await notarize({
      tool: 'notarytool',
      appPath: dmgPath,
      appleId: APPLE_ID,
      appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
      teamId: APPLE_TEAM_ID,
    });
    execFileSync('xcrun', ['stapler', 'staple', dmgPath], { stdio: 'inherit' });
  }
};
