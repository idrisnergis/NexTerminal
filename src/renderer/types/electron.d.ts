export interface ElectronAPI {
  // Window
  minimize: () => void;
  maximize: () => void;
  close: () => void;

  // SSH
  sshConnect: (connection: any) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  sshDisconnect: (sessionId: string) => Promise<{ success: boolean }>;
  sshWrite: (sessionId: string, data: string) => Promise<{ success: boolean }>;
  sshResize: (sessionId: string, cols: number, rows: number) => Promise<{ success: boolean }>;
  onSSHData: (callback: (sessionId: string, data: string) => void) => void;
  onSSHClosed: (callback: (sessionId: string) => void) => void;
  onSSHError: (callback: (sessionId: string, error: string) => void) => void;
  onSSHAuthPrompt: (callback: (sessionId: string, prompts: any[]) => void) => void;
  sendAuthResponse: (sessionId: string, responses: string[]) => void;
  removeSSHListeners: () => void;

  // Connections
  getConnections: () => Promise<SavedConnection[]>;
  saveConnection: (connection: SavedConnection) => Promise<{ success: boolean }>;
  deleteConnection: (id: string) => Promise<{ success: boolean }>;

  // SFTP
  sftpConnect: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  sftpList: (sessionId: string, path: string) => Promise<{ success: boolean; files?: RemoteFile[]; error?: string }>;
  sftpDownload: (sessionId: string, remotePath: string) => Promise<{ success: boolean; error?: string }>;
  sftpUpload: (sessionId: string, remotePath: string) => Promise<{ success: boolean; error?: string }>;
  sftpMkdir: (sessionId: string, remotePath: string) => Promise<{ success: boolean; error?: string }>;
  sftpRename: (sessionId: string, oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
  sftpDelete: (sessionId: string, remotePath: string) => Promise<{ success: boolean; error?: string }>;
  sftpRmdir: (sessionId: string, remotePath: string) => Promise<{ success: boolean; error?: string }>;
  sftpChmod: (sessionId: string, remotePath: string, mode: number) => Promise<{ success: boolean; error?: string }>;
  sftpReadFile: (sessionId: string, remotePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  sftpWriteFile: (sessionId: string, remotePath: string, content: string) => Promise<{ success: boolean; error?: string }>;

  // Dialog
  openFileDialog: (options?: { title?: string; filters?: any[] }) => Promise<{ success: boolean; path?: string }>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<{ success: boolean }>;

  // Import
  importSessions: () => Promise<{ success: boolean; count?: number; error?: string }>;

  // Local terminal
  localStart: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  localWrite: (sessionId: string, data: string) => Promise<{ success: boolean }>;
  localKill: (sessionId: string) => Promise<{ success: boolean }>;
}

export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  group?: string;
  lastConnected?: string;
}

export interface RemoteFile {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifyTime: number;
  permissions: string;
  owner: number;
  group: number;
}

export interface TerminalTab {
  id: string;
  sessionId: string;
  connectionName: string;
  host: string;
  isConnected: boolean;
}

export interface AppSettings {
  defaultSSHKeyPath: string;
  defaultSSHKeyPassphrase: string;
  defaultUsername: string;
  defaultPort: number;
  useDefaultKeyForAll: boolean;
  sidebarFontSize: number;
  terminalFontSize: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
