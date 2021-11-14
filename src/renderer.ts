import { ipcRenderer } from 'electron';
import fs from 'fs';
import './index.css';
import path from 'path';
import { Image as IImage } from './types';

let images: IImage[];
let index = 0;
let folderPath: string;

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const searchInput = document.querySelector<HTMLInputElement>('.search-input');
const folderInput = document.querySelector<HTMLInputElement>('.folder-input');
const limitInput = document.querySelector<HTMLInputElement>('.limit-input');
const offsetInput = document.querySelector<HTMLInputElement>('.offset-input');
const nextBtn = document.querySelector<HTMLButtonElement>('.next-btn');
const error = document.querySelector('.error');
const submitBtn = document.querySelector<HTMLButtonElement>('.submit-btn');

const googleRadio = document.querySelector<HTMLInputElement>('#engineRadio1');

const sizeInput = document.querySelector<HTMLInputElement>('.size-input');
const sizeLabel = document.querySelector('.size-label');
sizeInput.addEventListener('input', () => {
  sizeLabel.textContent = `Pen Size: ${sizeInput.value}px`;
});

let isDrawing = false;
let x = 0;
let y = 0;
canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  x = e.offsetX;
  y = e.offsetY;
});

document.addEventListener('mousemove', (e) => {
  mouseEvent(e);
});

document.addEventListener('mouseup', (e) => {
  mouseEvent(e, true);
});

const mouseEvent = (e: MouseEvent, stop?: true) => {
  if (isDrawing) {
    drawLine(x, y, e.offsetX, e.offsetY);
    x = e.offsetX;
    y = e.offsetY;
    if (stop) isDrawing = false;
  }
};

const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
  ctx.beginPath();
  ctx.lineWidth = parseInt(sizeInput.value);
  ctx.strokeStyle = 'white';
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.closePath();
};

(async () => {
  const isPackaged: boolean = await ipcRenderer.invoke('is-packaged');
  if (!isPackaged) {
    searchInput.value = 'usb stick';
    folderInput.value = 'C:\\Users\\gesch\\Desktop\\Fotos\\Internet';
    document.querySelector<HTMLInputElement>('#engineRadio2').click();
  }
})();

document.querySelector('.form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const searchValue = searchInput.value;
  const folderValue = folderInput.value;
  const limitValue = parseInt(limitInput.value);
  const offsetValue = parseInt(offsetInput.value);
  const searchEngine = googleRadio.checked ? 'google' : 'bing';

  const isValidPath = await doesPathExist(folderValue);
  if (!isValidPath) return error.classList.remove('hidden');

  error.classList.add('hidden');
  folderPath = folderValue;

  submitBtn.disabled = true;
  const response: IImage[] = await ipcRenderer.invoke('get-response', {
    searchTerm: searchValue,
    limit: limitValue,
    offset: offsetValue,
    engine: searchEngine,
  });
  submitBtn.disabled = false;

  if (response.length === 0) return;
  images = response;
  index = 0;
  (document.querySelector('.form-button') as HTMLButtonElement).click();
  showImg();
});

document.querySelector('.reset-btn').addEventListener('click', () => {
  showImg();
});

document.querySelector('.choose-folder-btn').addEventListener('click', async () => {
  const response: Electron.OpenDialogReturnValue = await ipcRenderer.invoke('open-dialog');
  if (!response.canceled) folderInput.value = response.filePaths[0];
});

nextBtn.addEventListener('click', () => {
  index++;
  showImg();
});

document.querySelector('.save-btn').addEventListener('click', async () => {
  const image = images[index];

  const sourcesPath = path.join(folderPath, 'sources.txt');
  const currentSources = (await getCurrentSources(sourcesPath)).filter((src) => src.length > 0);
  await setSources(sourcesPath, [...currentSources, image.url]);

  // Download
  const dataURL = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  const fileName = path.join(folderPath, `${currentSources.length}.png`);
  fs.writeFile(fileName, dataURL, 'base64', (err) => {
    if (err) console.error(err);
    nextBtn.click();
  });
});

async function getCurrentSources(path: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf-8', (err, items) => {
      if (err) {
        fs.writeFile(path, '', (err) => {
          if (err) reject(err);
          resolve([]);
        });
      } else {
        resolve(items.split('\n'));
      }
    });
  });
}

async function setSources(path: string, sources: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, sources.join('\n'), (err) => {
      if (err) reject();
      resolve();
    });
  });
}

function showImg() {
  document.querySelector('.result').classList.remove('hidden');
  nextBtn.disabled = index === images.length - 1;

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = images[index].img;

  image.onload = () => {
    const maxWidth = document.querySelector('.canvas').getBoundingClientRect().width;
    const aspectRatio = maxWidth / image.width;

    const imageWidth = image.width * aspectRatio;
    const imageHeight = image.height * aspectRatio;

    canvas.width = imageWidth;
    canvas.height = imageHeight;
    ctx.lineWidth = parseInt(sizeInput.value);
    ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
  };

  document.querySelector('.index').textContent = `${index + 1} / ${images.length}`;
}

function doesPathExist(path: string) {
  return new Promise((resolve) => {
    fs.readdir(path, (err) => {
      if (err) resolve(false);
      resolve(true);
    });
  });
}
