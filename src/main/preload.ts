import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // SSH
  sshConnect: (connection: any) => ipcRenderer.invoke('ssh:connect', connection),
  sshDisconnect: (sessionId: string) => ipcRenderer.invoke('ssh:disconnect', sessionId),
  sshWrite: (sessionId: string, data: string) => ipcRenderer.invoke('ssh:write', sessionId, data),
  sshResize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke('ssh:resize', sessionId, cols, rows),
  sshExec: (sessionId: string, command: string) => ipcRenderer.invoke('ssh:exec', sessionId, command),
  onSSHData: (callback: (sessionId: string, data: string) => void) => {
    ipcRenderer.on('ssh:data', (_event, sessionId, data) => callback(sessionId, data));
  },
  onSSHClosed: (callback: (sessionId: string) => void) => {
    ipcRenderer.on('ssh:closed', (_event, sessionId) => callback(sessionId));
  },
  onSSHError: (callback: (sessionId: string, error: string) => void) => {
    ipcRenderer.on('ssh:error', (_event, sessionId, error) => callback(sessionId, error));
  },
  onSSHAuthPrompt: (callback: (sessionId: string, prompts: any[]) => void) => {
    ipcRenderer.on('ssh:auth-prompt', (_event, sessionId, prompts) => callback(sessionId, prompts));
  },
  sendAuthResponse: (sessionId: string, responses: string[]) => {
    ipcRenderer.send(`ssh:auth-response:${sessionId}`, responses);
  },
  removeSSHListeners: () => {
    ipcRenderer.removeAllListeners('ssh:data');
    ipcRenderer.removeAllListeners('ssh:closed');
    ipcRenderer.removeAllListeners('ssh:error');
    ipcRenderer.removeAllListeners('ssh:auth-prompt');
  },

  // Connections
  getConnections: () => ipcRenderer.invoke('connections:getAll'),
  saveConnection: (connection: any) => ipcRenderer.invoke('connections:save', connection),
  deleteConnection: (id: string) => ipcRenderer.invoke('connections:delete', id),

  // SFTP
  sftpConnect: (sessionId: string) => ipcRenderer.invoke('sftp:connect', sessionId),
  sftpList: (sessionId: string, path: string) => ipcRenderer.invoke('sftp:list', sessionId, path),
  sftpDownload: (sessionId: string, remotePath: string) => ipcRenderer.invoke('sftp:download', sessionId, remotePath),
  sftpUpload: (sessionId: string, remotePath: string) => ipcRenderer.invoke('sftp:upload', sessionId, remotePath),
  sftpMkdir: (sessionId: string, remotePath: string) => ipcRenderer.invoke('sftp:mkdir', sessionId, remotePath),
  sftpRename: (sessionId: string, oldPath: string, newPath: string) => ipcRenderer.invoke('sftp:rename', sessionId, oldPath, newPath),
  sftpDelete: (sessionId: string, remotePath: string) => ipcRenderer.invoke('sftp:delete', sessionId, remotePath),
  sftpRmdir: (sessionId: string, remotePath: string) => ipcRenderer.invoke('sftp:rmdir', sessionId, remotePath),
  sftpChmod: (sessionId: string, remotePath: string, mode: number) => ipcRenderer.invoke('sftp:chmod', sessionId, remotePath, mode),
  sftpReadFile: (sessionId: string, remotePath: string) => ipcRenderer.invoke('sftp:readFile', sessionId, remotePath),
  sftpWriteFile: (sessionId: string, remotePath: string, content: string) => ipcRenderer.invoke('sftp:writeFile', sessionId, remotePath, content),

  // Dialog
  openFileDialog: (options?: { title?: string; filters?: any[] }) =>
    ipcRenderer.invoke('dialog:openFile', options || {}),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial: any) => ipcRenderer.invoke('settings:update', partial),

  // Import
  importSessions: () => ipcRenderer.invoke('import:sessions'),

  // Local terminal
  localStart: () => ipcRenderer.invoke('local:start'),
  localWrite: (sessionId: string, data: string) => ipcRenderer.invoke('local:write', sessionId, data),
  localKill: (sessionId: string) => ipcRenderer.invoke('local:kill', sessionId),
});
