import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In ESM mode, __dirname and __filename are not defined by default
// Polyfill them for compatibility with commonjs libraries
Object.defineProperty(globalThis, '__filename', { value: __filename });
Object.defineProperty(globalThis, '__dirname', { value: __dirname });

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

let win: BrowserWindow | null;

// SQLite Setup
let db: any;
try {
  const dbPath = path.join(app.getPath('userData'), 'smartclass_fees.db');
  console.log('Database path:', dbPath);
  db = new Database(dbPath);

  // Initialize SQLite Table for Fees
  db.exec(`
    CREATE TABLE IF NOT EXISTS fees (
      studentId TEXT PRIMARY KEY,
      totalFees REAL,
      emiMonths INTEGER,
      payments TEXT
    )
  `);
} catch (err) {
  console.error('Failed to initialize database:', err);
}

// IPC Handlers for Fees
ipcMain.handle('get-fee-records', () => {
  const records = db.prepare('SELECT * FROM fees').all();
  return records.map((r: any) => ({
    ...r,
    payments: JSON.parse(r.payments || '[]')
  }));
});

ipcMain.handle('get-fee-record', (_, studentId: string) => {
  const record: any = db.prepare('SELECT * FROM fees WHERE studentId = ?').get(studentId);
  if (!record) return null;
  return {
    ...record,
    payments: JSON.parse(record.payments || '[]')
  };
});

ipcMain.handle('update-fee-record', (_, feeRecord: any) => {
  const { studentId, totalFees, emiMonths, payments } = feeRecord;
  const paymentsStr = JSON.stringify(payments);
  
  const stmt = db.prepare(`
    INSERT INTO fees (studentId, totalFees, emiMonths, payments)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(studentId) DO UPDATE SET
      totalFees = excluded.totalFees,
      emiMonths = excluded.emiMonths,
      payments = excluded.payments
  `);
  stmt.run(studentId, totalFees, emiMonths, paymentsStr);
  return true;
});

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
