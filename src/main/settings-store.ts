import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface AppSettings {
  defaultSSHKeyPath: string;
  defaultSSHKeyPassphrase: string;
  defaultUsername: string;
  defaultPort: number;
  useDefaultKeyForAll: boolean;
  sidebarFontSize: number;
  terminalFontSize: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultSSHKeyPath: '',
  defaultSSHKeyPassphrase: '',
  defaultUsername: '',
  defaultPort: 22,
  useDefaultKeyForAll: false,
  sidebarFontSize: 11,
  terminalFontSize: 14,
};

// Portable data directory — next to the app itself
function getPortableDataDir(): string {
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath('exe')), 'data');
  } else {
    return path.join(path.dirname(__dirname), '..', 'data');
  }
}

export class SettingsStore {
  private filePath: string;
  private settings: AppSettings;

  constructor() {
    const dataDir = getPortableDataDir();
    this.filePath = path.join(dataDir, 'settings.json');
    this.migrateFromUserData();
    this.settings = this.load();
  }

  // One-time migration from old userData location
  private migrateFromUserData(): void {
    if (fs.existsSync(this.filePath)) return;
    try {
      const possiblePaths = [
        path.join(app.getPath('userData'), 'settings.json'),
        path.join(app.getPath('appData'), 'Electron', 'settings.json'),
        path.join(app.getPath('appData'), 'nexterm', 'settings.json'),
        path.join(app.getPath('appData'), 'NexTerm', 'settings.json'),
      ];
      for (const oldPath of possiblePaths) {
        if (fs.existsSync(oldPath)) {
          const dir = path.dirname(this.filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(oldPath, this.filePath);
          break;
        }
      }
    } catch {
      // Ignore migration errors
    }
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_SETTINGS };
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  getAll(): AppSettings {
    return { ...this.settings };
  }

  update(partial: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.persist();
  }
}
