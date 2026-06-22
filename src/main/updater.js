const { app, BrowserWindow, ipcMain, shell, autoUpdater } = require('electron');
const fetch = require('node-fetch');
const { Client, systemPlatform, systemArch } = require('@faynosync/sdk-js');
const { version, app_name, channel, owner, baseURL, edgeURL, autoDownload } = require('./config.js');

function logFlow(stage, data) {
  if (data === undefined) console.log(`[update-flow] ${stage}`);
  else console.log(`[update-flow] ${stage}:`, data);
}

// Squirrel.Windows takes the feed base URL, appends /RELEASES, then downloads the
// .nupkg referenced inside it. The 401 surfaces here, deep in native code, so we
// fetch RELEASES ourselves first and log exactly which package URLs Squirrel will
// hit — that's where an unexpected 401/403 actually comes from.
async function logWindowsReleases(feedURL) {
  const base = feedURL.replace(/\/+$/, '');
  const releasesURL = `${base}/RELEASES`;
  logFlow('Squirrel.Windows RELEASES URL', releasesURL);
  try {
    const res = await fetch(releasesURL, { headers: { 'User-Agent': 'faynosync-squirrel-example' } });
    logFlow('RELEASES response status', `${res.status} ${res.statusText}`);
    const body = await res.text();
    logFlow('RELEASES body', `\n${body}`);
    for (const line of body.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1]) {
        const pkg = parts[1];
        const pkgURL = /^https?:\/\//i.test(pkg) ? pkg : `${base}/${pkg}`;
        logFlow('nupkg URL Squirrel will download', pkgURL);
      }
    }
  } catch (err) {
    console.error('[update-flow] Failed to fetch RELEASES for logging:', err);
  }
}

let client;
function getClient() {
  if (!client) {
    client = new Client({ baseURL, edgeURL: edgeURL || undefined });
  }
  return client;
}

let lastResult = null;
let wired = false;
let currentMeta = null;
let currentFeedURL = null;

function send(channel, payload) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// macOS  -> Squirrel.Mac reads the JSON feed at /checkVersion (updater=squirrel_darwin),
//           which returns { "url": "<zip>" } (200) or 204 No Content.
// Windows -> Squirrel.Windows appends /RELEASES to this base URL, matching the
//            /update/:owner/:app/:channel/:platform/:arch/:version/RELEASES route.
// resolveNativeFeed asks the SDK to resolve the feed edge-first (falling back to the
// API): when an edge response exists, the returned feedURL points at the CDN so
// Squirrel reads it directly and the API is never hit.
function nativeFeedOptions() {
  const platform = systemPlatform();
  return {
    owner,
    appName: app_name,
    version,
    channel,
    platform,
    arch: systemArch(),
    updater: platform === 'darwin' ? 'squirrel_darwin' : 'squirrel_windows',
  };
}

function wire() {
  if (wired) return;
  wired = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update via native Squirrel...');
  });

  autoUpdater.on('update-available', () => {
    send('update:meta', { ...currentMeta, fromVersion: version });
  });

  autoUpdater.on('update-not-available', () => {
    send('update:error', { message: 'No matching update found in Squirrel feed.' });
  });

  autoUpdater.on('update-downloaded', () => {
    send('update:ready');
  });

  autoUpdater.on('error', (err) => {
    console.error('autoUpdater error:', err);
    logFlow('autoUpdater error context', { feedURL: currentFeedURL, source: currentMeta && currentMeta.source });
    send('update:error', { message: String((err && err.message) || err) });
  });

  ipcMain.on('update:restart', () => autoUpdater.quitAndInstall());
  ipcMain.on('update:manual', () => {
    if (lastResult && lastResult.updateUrl) shell.openExternal(lastResult.updateUrl);
  });
}

// Configures the native Electron autoUpdater (Squirrel) against the faynoSync feed
// and triggers a background download. Returns false when the native updater cannot
// run (dev mode, unsupported platform), so the caller can fall back to a manual flow.
async function startNativeUpdate(resp) {
  if (!app.isPackaged) {
    console.log('Skipping native update: app is not packaged (dev mode).');
    return false;
  }
  const platform = systemPlatform();
  if (platform !== 'darwin' && platform !== 'win32') {
    console.log('Native Squirrel updater is not supported on this platform.');
    return false;
  }
  currentMeta = {
    changelog: resp.changelog || '',
    critical: Boolean(resp.critical),
    source: resp.source || '',
    fromVersion: version,
  };
  const feedOpts = nativeFeedOptions();
  logFlow('native feed options', feedOpts);
  let feed;
  try {
    feed = await getClient().resolveNativeFeed(feedOpts);
  } catch (err) {
    console.error('Failed to resolve native feed:', err);
    return false;
  }
  logFlow('resolved native feed', feed);
  if (!feed.updateAvailable) {
    console.log('Native feed reports no update available.');
    return false;
  }
  console.log(`Native feed resolved from ${feed.source}: ${feed.feedURL}`);
  if (platform === 'win32') await logWindowsReleases(feed.feedURL);
  wire();
  currentFeedURL = feed.feedURL;
  logFlow('setFeedURL', feed.feedURL);
  try {
    autoUpdater.setFeedURL({ url: feed.feedURL });
  } catch (err) {
    console.error('Failed to set feed URL:', err);
    return false;
  }
  if (autoDownload) send('update:meta', currentMeta);
  autoUpdater.checkForUpdates();
  return true;
}

async function checkForUpdates(deviceId) {
  try {
    const resp = await getClient().checkForUpdates({
      owner,
      appName: app_name,
      version,
      channel,
      platform: systemPlatform(),
      arch: systemArch(),
      deviceId,
    });
    console.log(resp);
    logFlow('checkForUpdates result', {
      source: resp.source,
      updateAvailable: resp.updateAvailable,
      critical: resp.critical,
      updateUrl: resp.updateUrl,
      packageUrls: resp.packageUrls,
    });
    lastResult = resp;

    if (resp.updateAvailable) {
      if (!autoDownload) {
        send('update-available');
        return resp;
      }
      const started = await startNativeUpdate(resp);
      if (!started) {
        send('update-available');
      }
    } else {
      send('update-not-available');
    }
    return resp;
  } catch (err) {
    console.error('Update check failed:', err);
    return null;
  }
}

async function openUpdateChoice() {
  if (!lastResult || !lastResult.updateAvailable) return;
  const started = await startNativeUpdate(lastResult);
  if (!started && lastResult.updateUrl) {
    shell.openExternal(lastResult.updateUrl);
  }
}

module.exports = { checkForUpdates, openUpdateChoice, getClient };
