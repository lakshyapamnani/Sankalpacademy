import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

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

// SQLite Setup using sql.js (pure WebAssembly - works on every PC without native compilation)
let db: any = null;
let dbPath: string;

function getWasmPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sql-wasm.wasm');
  }
  const devPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  if (fs.existsSync(devPath)) return devPath;
  return path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
}

async function initDatabase() {
  try {
    dbPath = path.join(app.getPath('userData'), 'sankalpacademy_fees.db');
    console.log('Database path:', dbPath);

    // Migrate from old DB names if the new one doesn't exist
    if (!fs.existsSync(dbPath)) {
      const oldNames = ['sankalp_fees.db', 'smartclass_fees.db'];
      for (const oldName of oldNames) {
        const oldPath = path.join(app.getPath('userData'), oldName);
        if (fs.existsSync(oldPath)) {
          try {
            fs.copyFileSync(oldPath, dbPath);
            console.log(`Migrated old database ${oldName} -> sankalpacademy_fees.db`);
          } catch (e) {
            console.error(`Failed to migrate ${oldName}:`, e);
          }
          break;
        }
      }
    }

    const wasmPath = getWasmPath();
    console.log('Resolved WASM path:', wasmPath);

    let SQL: any;
    if (fs.existsSync(wasmPath)) {
      const wasmBinary = fs.readFileSync(wasmPath);
      SQL = await initSqlJs({ wasmBinary });
    } else {
      SQL = await initSqlJs();
    }

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    // Initialize SQLite Table for Fees
    db.run(`
      CREATE TABLE IF NOT EXISTS fees (
        studentId TEXT PRIMARY KEY,
        totalFees REAL,
        emiMonths INTEGER,
        payments TEXT
      )
    `);

    // Persist DB to disk after every write
    saveDatabase();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
}

function saveDatabase() {
  if (db && dbPath) {
    try {
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    } catch (err) {
      console.error('Failed to save database:', err);
    }
  }
}

// IPC Handlers for Fees
ipcMain.handle('get-fee-records', () => {
  if (!db) return [];
  try {
    const stmt = db.prepare('SELECT * FROM fees');
    const records: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      records.push({
        ...row,
        payments: JSON.parse((row.payments as string) || '[]')
      });
    }
    stmt.free();
    return records;
  } catch (err) {
    console.error('SQLite getFeeRecords failed', err);
    return [];
  }
});

ipcMain.handle('get-fee-record', (_, studentId: string) => {
  if (!db) return null;
  try {
    const stmt = db.prepare('SELECT * FROM fees WHERE studentId = ?');
    stmt.bind([studentId]);
    if (stmt.step()) {
      const record = stmt.getAsObject();
      stmt.free();
      return {
        ...record,
        payments: JSON.parse((record.payments as string) || '[]')
      };
    }
    stmt.free();
    return null;
  } catch (err) {
    console.error('SQLite getFeeRecord failed', err);
    return null;
  }
});

ipcMain.handle('update-fee-record', (_, feeRecord: any) => {
  if (!db) return false;
  try {
    const { studentId, totalFees, emiMonths, payments } = feeRecord || {};
    const paymentsStr = JSON.stringify(payments || []);
    db.run(`
      INSERT INTO fees (studentId, totalFees, emiMonths, payments)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(studentId) DO UPDATE SET
        totalFees = excluded.totalFees,
        emiMonths = excluded.emiMonths,
        payments = excluded.payments
    `, [studentId, Number(totalFees) || 0, Number(emiMonths) || 1, paymentsStr]);
    saveDatabase();
    return true;
  } catch (err) {
    console.error('SQLite updateFeeRecord failed', err);
    return false;
  }
});

// Search payments by receipt number across all students
ipcMain.handle('search-fee-by-receipt', (_, receiptNo: string) => {
  if (!db || !receiptNo) return null;
  try {
    const searchTerm = receiptNo.trim().toLowerCase();
    const stmt = db.prepare('SELECT * FROM fees');
    const results: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const payments = JSON.parse((row.payments as string) || '[]');
      for (const payment of payments) {
        if (payment.receiptNo && payment.receiptNo.toLowerCase() === searchTerm) {
          results.push({
            studentId: row.studentId,
            totalFees: row.totalFees,
            emiMonths: row.emiMonths,
            payments,
            matchedPayment: payment
          });
          break;
        }
      }
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error('SQLite searchFeeByReceipt failed', err);
    return null;
  }
});

ipcMain.handle('download-receipt-pdf', async (_, filename: string) => {
  if (!win) return false;
  try {
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Save Fee Receipt PDF',
      defaultPath: filename || 'Receipt.pdf',
      filters: [{ name: 'PDF Files (*.pdf)', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return false;

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' }
    });

    fs.writeFileSync(filePath, pdfBuffer);
    return true;
  } catch (err) {
    console.error('download-receipt-pdf failed:', err);
    return false;
  }
});

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icons', 'sankalp.ico'),
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
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    saveDatabase(); // Ensure DB is saved before exit
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  try {
    await initDatabase();
  } catch (err) {
    console.error('Startup database init error:', err);
  }
  createWindow();
});
