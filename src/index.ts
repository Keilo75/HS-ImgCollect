import { app, BrowserWindow, dialog, ipcMain } from "electron";
import pie from "puppeteer-in-electron";
import puppeteer from "puppeteer-core";
import { CrawlOptions, Image } from "./models";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

pie.initialize(app);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
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

  if (!app.isPackaged) mainWindow.webContents.openDevTools();
  mainWindow.maximize();
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("get-response", async (event, args: CrawlOptions) => {
  const browser = await pie.connect(app, puppeteer);
  const pipWindow = new BrowserWindow();
  pipWindow.maximize();

  if (args.engine === "google") {
    const url = `https://www.google.de/search?q=${args.searchTerm}&tbm=isch`;
    await pipWindow.loadURL(url);
    pipWindow.webContents.openDevTools();

    const page = await pie.getPage(browser, pipWindow);

    const coords = {
      acceptCookies: {
        x: 951,
        y: 828,
      },
    };

    try {
      const modal = await page.$("[aria-modal=true]");

      if (modal) {
        await page.mouse.click(coords.acceptCookies.x, coords.acceptCookies.y);
      }
    } catch {
      // Do Nothing
    }

    const images: Image[] = await page.evaluate(
      (args) => {
        const ms = Date.now();
        function isRectEmpty(rect: DOMRect) {
          return (
            rect.top === 0 &&
            rect.right === 0 &&
            rect.bottom === 0 &&
            rect.left === 0 &&
            rect.width === 0 &&
            rect.height === 0 &&
            rect.x === 0 &&
            rect.y === 0
          );
        }

        function scrollToBottom(): Promise<void> {
          return new Promise((resolve) => {
            const endElement = document.querySelector("input[type=button]");
            const interval = setInterval(() => {
              window.scrollTo(0, 1000000);
              const isVisible = !isRectEmpty(
                endElement.getBoundingClientRect()
              );
              if (isVisible) {
                clearInterval(interval);
                resolve();
              }
            }, 100);
          });
        }

        return scrollToBottom().then(() => {
          console.log(Date.now() - ms);

          const selectors = {
            img: ".islrc",
          };

          const imgWrap = document.querySelector<HTMLDivElement>(selectors.img);
          let imageArray = Array.from(imgWrap.querySelectorAll("img"));
          if (args.offset > 0) imageArray.splice(0, args.offset);
          if (args.limit > 0) imageArray = imageArray.slice(0, args.limit);

          const images = imageArray.map((img) => {
            const parent = img.parentElement.parentElement as HTMLElement;
            const nextElement = parent.nextElementSibling as HTMLAnchorElement;

            if (parent.nodeName !== "A") return undefined;
            if (!parent) return undefined;

            const link = parent as HTMLAnchorElement;

            if (link.href.length > 0) {
              const linkURL = new URL(link.href);
              if (linkURL.host.startsWith("www.google")) return undefined;
            }

            link.target = null;
            link.click();

            try {
              const imgUrl = new URL(link.href);
              const params = new URLSearchParams(imgUrl.search);
              const urlParam = params.get("imgurl");
              return { url: nextElement.getAttribute("href"), img: urlParam };
            } catch {
              return undefined;
            }
          });

          return images;
        });
      },
      { limit: args.limit, offset: args.offset }
    );

    pipWindow.destroy();
    return images.filter((img) => !!img);
  } else if (args.engine === "bing") {
    const url = `https://www.bing.com/images/search?q=${args.searchTerm}&form=HDRSC2&first=1&tsc=ImageBasicHover`;
    await pipWindow.loadURL(url).catch(() => {
      // Do Nothing
    });
    pipWindow.webContents.openDevTools();

    const page = await pie.getPage(browser, pipWindow);

    await sleep(3000);
    try {
      await page.waitForSelector("[aria-modal=true]");
      page.keyboard.press("Enter");
    } catch {
      // Do Nothing
    }

    const images: Image[] = await page.evaluate(
      (args) => {
        function sleep(ms: number) {
          return new Promise((resolve) => setTimeout(resolve, ms));
        }

        const ms = Date.now();

        const interval = setInterval(() => {
          window.scrollTo(0, 1000000);
        }, 500);

        return sleep(2000).then(() => {
          clearInterval(interval);
          console.log(Date.now() - ms);

          let imageElements = Array.from(document.querySelectorAll(".mimg"));

          if (args.offset > 0) imageElements.splice(0, args.offset);
          if (args.limit > 0)
            imageElements = imageElements.slice(0, args.limit);

          const images = imageElements.map((elem) => {
            const parent = elem.parentElement.parentElement;

            const data = JSON.parse(parent.getAttribute("m"));
            return { url: data.purl, img: data.murl };
          });

          return images;
        });
      },
      { offset: args.offset, limit: args.limit }
    );

    pipWindow.destroy();
    return images.filter((img) => !!img);
  }
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

ipcMain.handle("open-dialog", async () => {
  const response = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return response;
});

ipcMain.handle("is-packaged", () => {
  return app.isPackaged;
});
