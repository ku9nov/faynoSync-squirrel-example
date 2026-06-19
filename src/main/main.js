const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { version, app_name } = require('./config.js');
const { checkForUpdates, openUpdateChoice } = require('./updater.js');
const { startReporting } = require('./reports.js');

let deviceId;
function getDeviceId() {
  if (deviceId) return deviceId;
  const deviceIdPath = path.join(app.getPath('userData'), 'device-id');
  try {
    const stored = fs.readFileSync(deviceIdPath, 'utf8').trim();
    if (stored) {
      deviceId = stored;
      return deviceId;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error reading device id:', err);
    }
  }
  deviceId = crypto.randomUUID();
  try {
    fs.writeFileSync(deviceIdPath, deviceId);
  } catch (err) {
    console.error('Error persisting device id:', err);
  }
  return deviceId;
}

function getLinuxDistributionFamily() {
  let distroFamily = 'Linux';
  try {
    const releaseInfo = fs.readFileSync('/etc/os-release', 'utf8');
    const match = releaseInfo.match(/^ID(?:_LIKE)?=(.*)$/m);
    if (match) {
      const idLike = match[1].trim().toLowerCase();
      if (idLike.includes('rhel') || idLike.includes('fedora') || idLike.includes('centos')) {
        distroFamily = 'RHEL';
      } else if (idLike.includes('debian') || idLike.includes('ubuntu') || idLike.includes('kali')) {
        distroFamily = 'Debian';
      }
    }
  } catch (err) {
    console.error('Error getting Linux distribution family:', err);
  }
  return distroFamily;
}

function createWindow() {
  let osName = os.platform();
  let pcArch = os.arch();
  if (osName === 'linux') {
    osName = getLinuxDistributionFamily();
  }
  const title = `${app_name} - v${version} (${osName}-${pcArch})`;

  let win = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setTitle(title);

  // Update the path to the renderer files
  const indexPath = path.join(__dirname, '../renderer/index.html');
  win.loadFile(indexPath);

  // Pass version to renderer
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      window.version = "${version}";
      document.getElementById('version').textContent = 'v${version}';
    `);
    // Check for updates after window is loaded
    checkForUpdates(getDeviceId());
  });

  win.on('closed', () => {
    win = null;
  });

  // Handle IPC events
  ipcMain.on('check-updates', () => {
    checkForUpdates(getDeviceId());
  });

  ipcMain.on('update-now', () => {
    openUpdateChoice();
  });

  ipcMain.on('open-settings', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Settings',
      message: 'This is a Hello World example application — what did you expect to see here?',
      buttons: ['OK']
    });
  });
}

app.whenReady().then(() => {
  createWindow();
  startReporting(getDeviceId());
});
