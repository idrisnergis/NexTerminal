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

// One canonical, writable directory shared by dev, BAT and packaged EXE builds.
function getDataDir(): string {
  return app.getPath('userData');
}

export class SettingsStore {
  private filePath: string;
  private settings: AppSettings;

  constructor() {
    const dataDir = getDataDir();
    this.filePath = path.join(dataDir, 'settings.json');
    this.migrateFromLegacyLocations();
    this.settings = this.load();
  }

  // One-time migration from every location used by older builds.
  private migrateFromLegacyLocations(): void {
    if (fs.existsSync(this.filePath)) return;
    try {
      const projectDataPath = path.resolve(__dirname, '..', '..', 'data', 'settings.json');
      const executableDataPath = path.join(path.dirname(app.getPath('exe')), 'data', 'settings.json');
      const possiblePaths = [
        projectDataPath,
        executableDataPath,
        path.join(app.getPath('appData'), 'Electron', 'settings.json'),
        path.join(app.getPath('appData'), 'nexterm', 'settings.json'),
      ];
      for (const oldPath of possiblePaths) {
        if (oldPath !== this.filePath && fs.existsSync(oldPath)) {
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
