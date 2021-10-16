import { app, BrowserWindow, ipcMain } from 'electron';
import pie from 'puppeteer-in-electron';
import puppeteer from 'puppeteer-core';

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;

pie.initialize(app);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit();
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.webContents.openDevTools();
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('get-response', async (event, args: string) => {
  const browser = await pie.connect(app, puppeteer);
  const window = new BrowserWindow();
  window.maximize();
  const url = 'https://google.com';
  await window.loadURL(url);

  const page = await pie.getPage(browser, window);

  const coords = {
    acceptCookies: {
      x: 951,
      y: 828,
    },
  };

  try {
    const modal = await page.$('[aria-modal=true]');
    if (modal) {
      await page.mouse.click(coords.acceptCookies.x, coords.acceptCookies.y);
    }
  } catch {}

  const searchInput = await page.waitForSelector('[aria-label="Suche"]');
  searchInput.focus();
  await page.keyboard.type(args, { delay: 50 });
  await page.keyboard.press('Enter');

  return '';
});
