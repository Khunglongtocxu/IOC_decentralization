const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

function sendUpdate(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', status);
  }
}

/* ══════════════ Auto-update từ GitHub Releases ══════════════ */
// Người dùng chủ động bấm tải → không tự động download
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

autoUpdater.on('checking-for-update', () => sendUpdate({ event: 'checking' }));
autoUpdater.on('update-available', (info) =>
  sendUpdate({ event: 'available', version: info?.version })
);
autoUpdater.on('update-not-available', () => sendUpdate({ event: 'not-available' }));
autoUpdater.on('download-progress', (progress) =>
  sendUpdate({
    event: 'downloading',
    percent: progress?.percent ?? 0,
    transferred: progress?.transferred,
    total: progress?.total,
  })
);
autoUpdater.on('update-downloaded', (info) =>
  sendUpdate({ event: 'downloaded', version: info?.version })
);
autoUpdater.on('error', (err) =>
  sendUpdate({ event: 'error', message: err?.message ?? String(err) })
);

ipcMain.handle('updates:check', async () => {
  if (!app.isPackaged) {
    sendUpdate({ event: 'not-available' });
    return { ok: false, reason: 'Chế độ dev không kiểm tra cập nhật' };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message ?? String(err) };
  }
});

ipcMain.handle('updates:download', () => autoUpdater.downloadUpdate());
ipcMain.handle('updates:install', () => autoUpdater.quitAndInstall());
ipcMain.handle('app-info', () => ({
  version: app.getVersion(),
  packaged: app.isPackaged,
}));
ipcMain.handle('system:hostname', () => os.hostname());

/* ══════════════ Tải module zip cho App FPT-IS (dist/modules/ sinh lúc build) ══════════════ */
// file:// không tải bằng thẻ <a download> được → đọc file trong gói app rồi ghi ra nơi người dùng chọn
ipcMain.handle('modules:save', async (_event, fileName) => {
  // Chỉ nhận đúng tên file module → không đọc được file khác trong gói app
  if (typeof fileName !== 'string' || !/^[a-z0-9-]+-\d+\.\d+\.\d+\.zip$/.test(fileName)) {
    return { ok: false, reason: 'Tên file module không hợp lệ.' };
  }
  let data;
  try {
    data = await fs.promises.readFile(path.join(__dirname, '..', 'dist', 'modules', fileName));
  } catch {
    return { ok: false, reason: 'Bản cài này chưa kèm file module.' };
  }
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Lưu module App FPT-IS',
    defaultPath: path.join(app.getPath('downloads'), fileName),
    filters: [{ name: 'Zip', extensions: ['zip'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  await fs.promises.writeFile(filePath, data);
  shell.showItemInFolder(filePath);
  return { ok: true, filePath };
});

/* ══════════════ Cửa sổ ứng dụng ══════════════ */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    title: 'IOC decentralization',
    icon: path.join(__dirname, 'src/assets/icon.ico')
  });

  mainWindow.setMenuBarVisibility(false);

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Tự động kiểm tra cập nhật khi mở app (bản đã đóng gói)
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 4000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
