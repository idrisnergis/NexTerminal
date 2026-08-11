import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { SSHManager } from './ssh-manager';
import { ConnectionStore } from './connection-store';
import { SFTPManager } from './sftp-manager';
import { SettingsStore } from './settings-store';
import { parseSessionFile } from './session-importer';

// Keep the app identity and data path identical in development and packaged builds.
app.setName('NexTerm');
app.setPath('userData', path.join(app.getPath('appData'), 'NexTerm'));

// Let Chromium use the operating system's native DPI scale. Forcing a 1x scale
// causes pointer coordinates to drift after resize/maximize on scaled displays.

// Logger — portable, cross-platform, size-limited
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_OLD_LOGS = 2; // Keep 2 rotated files

// Use a writable per-user path on every platform:
// Windows: %APPDATA%/NexTerm/logs
// macOS: ~/Library/Application Support/NexTerm/logs
// Linux: ~/.config/NexTerm/logs (or XDG_CONFIG_HOME)
const logDir = path.join(app.getPath('userData'), 'logs');
const logFile = path.join(logDir, 'nexterm.log');

function rotateLogIfNeeded() {
  try {
    if (!fs.existsSync(logFile)) return;
    const stat = fs.statSync(logFile);
    if (stat.size < MAX_LOG_SIZE) return;

    // Rotate: nexterm.log → nexterm.1.log, nexterm.1.log → nexterm.2.log
    for (let i = MAX_OLD_LOGS - 1; i >= 1; i--) {
      const older = path.join(logDir, `nexterm.${i}.log`);
      const newer = path.join(logDir, `nexterm.${i - 1}.log`);
      if (fs.existsSync(newer)) {
        if (fs.existsSync(older)) fs.unlinkSync(older);
        fs.renameSync(newer, older);
      }
    }
    // Current → .0.log
    const first = path.join(logDir, 'nexterm.0.log');
    if (fs.existsSync(first)) fs.unlinkSync(first);
    fs.renameSync(logFile, first);
  } catch {
    // Ignore rotation errors
  }
}

function log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(line);
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    rotateLogIfNeeded();
    fs.appendFileSync(logFile, line + '\n');
  } catch {
    // Ignore write errors
  }
}

log('INFO', `NexTerm v${app.getVersion()} starting`);
log('INFO', `Platform: ${process.platform}, Arch: ${process.arch}`);
log('INFO', `Log path: ${logFile}`);

let mainWindow: BrowserWindow | null = null;
const sshManager = new SSHManager();
const connectionStore = new ConnectionStore();
const sftpManager = new SFTPManager();
const settingsStore = new SettingsStore();
const localTerminals: Map<string, ChildProcess> = new Map();

function createWindow() {
  const isWindows = process.platform === 'win32';
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: 'NexTerm',
    frame: !isWindows,
    resizable: true,
    ...(isWindows ? { thickFrame: true } : {}),
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1.0,
    },
  });

  // Ensure zoom stays at 1.0 (prevents accidental Ctrl+scroll zoom)
  mainWindow.webContents.setZoomFactor(1.0);
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  sshManager.disconnectAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

// File picker
ipcMain.handle('dialog:openFile', async (_event, options: { title?: string; filters?: any[] }) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: options.title || 'Select File',
    properties: ['openFile'],
    filters: options.filters || [
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }
  return { success: true, path: result.filePaths[0] };
});

// SSH Connection handlers
ipcMain.handle('ssh:connect', async (_event, connection) => {
  log('INFO', `SSH connecting to ${connection.host}:${connection.port} as ${connection.username}`);
  try {
    const settings = settingsStore.getAll();

    // If no credentials at all, apply default key from settings
    const hasPassword = connection.password && connection.password.trim().length > 0;
    const hasKey = connection.privateKeyPath && connection.privateKeyPath.trim().length > 0;
    const hasDefaultKey = settings.defaultSSHKeyPath && settings.defaultSSHKeyPath.trim().length > 0;

    if (!hasPassword && !hasKey && hasDefaultKey) {
      connection.authType = 'key';
      connection.privateKeyPath = settings.defaultSSHKeyPath;
      connection.passphrase = settings.defaultSSHKeyPassphrase || '';
    }

    if (settings.useDefaultKeyForAll && hasDefaultKey) {
      connection.authType = 'key';
      connection.privateKeyPath = settings.defaultSSHKeyPath;
      connection.passphrase = settings.defaultSSHKeyPassphrase || '';
    }

    const sessionId = await sshManager.connect(connection);
    log('INFO', `SSH connected: sessionId=${sessionId}`);
    return { success: true, sessionId };
  } catch (error: any) {
    log('ERROR', `SSH connect failed: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ssh:disconnect', async (_event, sessionId: string) => {
  if (localTerminals.has(sessionId)) {
    const proc = localTerminals.get(sessionId);
    proc?.kill();
    localTerminals.delete(sessionId);
    return { success: true };
  }
  sshManager.disconnect(sessionId);
  return { success: true };
});

ipcMain.handle('ssh:write', async (_event, sessionId: string, data: string) => {
  // Check if it's a local terminal
  if (localTerminals.has(sessionId)) {
    const proc = localTerminals.get(sessionId);
    proc?.stdin?.write(data);
    return { success: true };
  }
  sshManager.write(sessionId, data);
  return { success: true };
});

ipcMain.handle('ssh:resize', async (_event, sessionId: string, cols: number, rows: number) => {
  sshManager.resize(sessionId, cols, rows);
  return { success: true };
});

ipcMain.handle('ssh:exec', async (_event, sessionId: string, command: string) => {
  try {
    const output = await sshManager.exec(sessionId, command);
    return { success: true, output };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// SSH data event forwarding
sshManager.on('data', (sessionId: string, data: string) => {
  mainWindow?.webContents.send('ssh:data', sessionId, data);
});

sshManager.on('close', (sessionId: string) => {
  mainWindow?.webContents.send('ssh:closed', sessionId);
});

sshManager.on('error', (sessionId: string, error: string) => {
  mainWindow?.webContents.send('ssh:error', sessionId, error);
});

// Keyboard-interactive auth: forward prompts to renderer
sshManager.on('keyboard-interactive', (sessionId: string, prompts: any[], finish: (responses: string[]) => void) => {
  // Send prompts to renderer
  const promptTexts = prompts.map((p: any) => ({ prompt: p.prompt, echo: p.echo }));
  mainWindow?.webContents.send('ssh:auth-prompt', sessionId, promptTexts);

  // Wait for response from renderer
  ipcMain.once(`ssh:auth-response:${sessionId}`, (_event, responses: string[]) => {
    finish(responses);
  });
});

// Connection store handlers
ipcMain.handle('connections:getAll', async () => {
  return connectionStore.getAll();
});

ipcMain.handle('connections:save', async (_event, connection) => {
  connectionStore.save(connection);
  return { success: true };
});

ipcMain.handle('connections:delete', async (_event, id: string) => {
  connectionStore.delete(id);
  return { success: true };
});

// SFTP handlers
ipcMain.handle('sftp:connect', async (_event, sessionId: string) => {
  try {
    if (!sftpManager.has(sessionId)) {
      await sftpManager.connect(sshManager.getClient(sessionId), sessionId);
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sftp:list', async (_event, sessionId: string, remotePath: string) => {
  try {
    if (!sftpManager.has(sessionId)) {
      await sftpManager.connect(sshManager.getClient(sessionId), sessionId);
    }
    const files = await sftpManager.list(sessionId, remotePath);
    return { success: true, files };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sftp:download', async (_event, sessionId: string, remotePath: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Download File',
    defaultPath: path.basename(remotePath),
    buttonLabel: 'Download',
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };

  try {
    if (!sftpManager.has(sessionId)) {
      await sftpManager.connect(sshManager.getClient(sessionId), sessionId);
    }
    const fileName = path.basename(remotePath);
    await sftpManager.download(sessionId, remotePath, result.filePath, (transferred, total) => {
      mainWindow?.webContents.send(`sftp:progress:${sessionId}`, {
        direction: 'download',
        fileName,
        transferred,
        total,
        currentFile: 1,
        fileCount: 1,
        percent: total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0,
      });
    });
    return { success: true };
  } catch (error: any) {
    log('ERROR', `SFTP download failed (${remotePath}): ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sftp:upload', async (_event, sessionId: string, remotePath: string) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: `Upload to ${remotePath}`,
    buttonLabel: 'Upload',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'All Files', extensions: ['*'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

  try {
    if (!sftpManager.has(sessionId)) {
      await sftpManager.connect(sshManager.getClient(sessionId), sessionId);
    }
    const normalizedRemotePath = remotePath === '/' ? '' : remotePath.replace(/\/$/, '');
    for (let index = 0; index < result.filePaths.length; index++) {
      const localPath = result.filePaths[index];
      const fileName = path.basename(localPath);
      const remoteFilePath = `${normalizedRemotePath}/${fileName}`;
      await sftpManager.upload(sessionId, localPath, remoteFilePath, (transferred, total) => {
        mainWindow?.webContents.send(`sftp:progress:${sessionId}`, {
          direction: 'upload',
          fileName,
          transferred,
          total,
          currentFile: index + 1,
          fileCount: result.filePaths.length,
          percent: total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0,
        });
      });
    }
    return { success: true };
  } catch (error: any) {
    log('ERROR', `SFTP upload failed (${remotePath}): ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sftp:mkdir', async (_event, sessionId: string, remotePath: string) => {
  try {
    await sftpManager.mkdir(sessionId, remotePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sftp:rename', async (_event, sessionId: string, oldPath: string, newPath: string) => {
  try {
    await sftpManager.rename(sessionId, oldPath, newPath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sftp:delete', async (_event, sessionId: string, remotePath: string) => {
  try {
    await sftpManager.delete(sessionId, remotePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sftp:rmdir', async (_event, sessionId: string, remotePath: string) => {
  try {
    await sftpManager.rmdir(sessionId, remotePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sftp:chmod', async (_event, sessionId: string, remotePath: string, mode: number) => {
  try {
    await sftpManager.chmod(sessionId, remotePath, mode);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sftp:readFile', async (_event, sessionId: string, remotePath: string) => {
  try {
    const content = await sftpManager.readFile(sessionId, remotePath);
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sftp:writeFile', async (_event, sessionId: string, remotePath: string, content: string) => {
  try {
    await sftpManager.writeFile(sessionId, remotePath, content);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Log path handler
ipcMain.handle('app:getLogPath', async () => {
  return logFile;
});

// Settings handlers
ipcMain.handle('settings:get', async () => {
  return settingsStore.getAll();
});

ipcMain.handle('settings:update', async (_event, partial: any) => {
  settingsStore.update(partial);
  return { success: true };
});

// Session Import handler
ipcMain.handle('import:sessions', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import Sessions',
    properties: ['openFile'],
    filters: [
      { name: 'Session Files', extensions: ['ini', 'mxtsessions'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }

  try {
    const filePath = result.filePaths[0];
    const connections = parseSessionFile(filePath);

    if (connections.length === 0) {
      return { success: false, error: 'No SSH sessions found in the file' };
    }

    // Save all imported connections
    let imported = 0;
    for (const conn of connections) {
      connectionStore.save({
        id: conn.id,
        name: conn.name,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        authType: conn.authType,
        privateKeyPath: conn.privateKeyPath,
        group: conn.group,
      });
      imported++;
    }

    return { success: true, count: imported };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Export connections as JSON
ipcMain.handle('export:connections', async () => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Connections',
    defaultPath: 'nexterm-connections.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
    ],
  });
  if (result.canceled || !result.filePath) return { success: false };

  try {
    const connections = connectionStore.getAll();
    fs.writeFileSync(result.filePath, JSON.stringify(connections, null, 2), 'utf-8');
    log('INFO', `Exported ${connections.length} connections to ${result.filePath}`);
    return { success: true };
  } catch (error: any) {
    log('ERROR', `Export failed: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Import connections from JSON
ipcMain.handle('import:connectionsJson', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import Connections',
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false };

  try {
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath, 'utf-8');
    const connections = JSON.parse(data);

    if (!Array.isArray(connections)) {
      return { success: false, error: 'Invalid file format — expected an array of connections' };
    }

    let imported = 0;
    for (const conn of connections) {
      if (conn.host && conn.name) {
        connectionStore.save({
          id: conn.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          name: conn.name,
          host: conn.host,
          port: conn.port || 22,
          username: conn.username || '',
          authType: conn.authType || 'password',
          privateKeyPath: conn.privateKeyPath || '',
          group: conn.group || '',
        });
        imported++;
      }
    }

    log('INFO', `Imported ${imported} connections from ${filePath}`);
    return { success: true, count: imported };
  } catch (error: any) {
    log('ERROR', `Import JSON failed: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Local terminal handlers
ipcMain.handle('local:start', async () => {
  try {
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    const platform = process.platform;
    const shell = platform === 'win32'
      ? (process.env.COMSPEC || 'powershell.exe')
      : (process.env.SHELL || (platform === 'darwin' ? '/bin/zsh' : '/bin/bash'));
    const shellArgs = platform === 'win32'
      ? (shell.toLowerCase().includes('powershell') ? ['-NoLogo'] : [])
      : ['-i'];
    const shellEnv = {
      ...process.env,
      ...(platform === 'win32' ? {} : { TERM: process.env.TERM || 'xterm-256color' }),
    };

    const proc = spawn(shell, shellArgs, {
      env: shellEnv,
      cwd: os.homedir(),
      shell: false,
      windowsHide: true,
    });

    localTerminals.set(sessionId, proc);

    proc.stdout?.on('data', (data: Buffer) => {
      mainWindow?.webContents.send('ssh:data', sessionId, data.toString('utf-8'));
    });

    proc.stderr?.on('data', (data: Buffer) => {
      mainWindow?.webContents.send('ssh:data', sessionId, data.toString('utf-8'));
    });

    proc.on('close', () => {
      mainWindow?.webContents.send('ssh:closed', sessionId);
      localTerminals.delete(sessionId);
    });

    proc.on('error', (err) => {
      mainWindow?.webContents.send('ssh:error', sessionId, err.message);
      localTerminals.delete(sessionId);
    });

    return { success: true, sessionId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('local:write', async (_event, sessionId: string, data: string) => {
  const proc = localTerminals.get(sessionId);
  if (proc?.stdin) {
    proc.stdin.write(data);
  }
  return { success: true };
});

ipcMain.handle('local:kill', async (_event, sessionId: string) => {
  const proc = localTerminals.get(sessionId);
  if (proc) {
    proc.kill();
    localTerminals.delete(sessionId);
  }
  return { success: true };
});
