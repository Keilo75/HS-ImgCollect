import { ipcRenderer } from 'electron';
import fs from 'fs';
import './index.css';
import path from 'path';
import { Image as IImage } from './types';
import { v4 as uuid } from 'uuid';

let images: IImage[];
let index = 0;
let folderPath: string;

const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
const ctx = canvas.getContext('2d');
const cropCanvas = document.querySelector<HTMLCanvasElement>('#cropCanvas');
const cropCtx = cropCanvas.getContext('2d');

const searchInput = document.querySelector<HTMLInputElement>('.search-input');
const folderInput = document.querySelector<HTMLInputElement>('.folder-input');
const limitInput = document.querySelector<HTMLInputElement>('.limit-input');
const offsetInput = document.querySelector<HTMLInputElement>('.offset-input');
const nextBtn = document.querySelector<HTMLButtonElement>('.next-btn');
const error = document.querySelector('.error');
const submitBtn = document.querySelector<HTMLButtonElement>('.submit-btn');

const googleRadio = document.querySelector<HTMLInputElement>('#engineRadio1');
const uuidRadio = document.querySelector<HTMLInputElement>('#nameRadio1');

const sizeInput = document.querySelector<HTMLInputElement>('.size-input');
const sizeLabel = document.querySelector('.size-label');
sizeInput.addEventListener('input', () => {
  sizeLabel.textContent = `Pen Size: ${sizeInput.value}px`;
});

const toolRadio = document.querySelector<HTMLInputElement>('#tool1');

let isDrawing = false;
let x = 0;
let y = 0;

interface CroppedPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}
let croppedPosition: CroppedPosition = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};
canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  x = e.offsetX;
  y = e.offsetY;

  if (toolRadio.checked) {
    ctx.strokeStyle = 'white';
    ctx.moveTo(x, y);
    ctx.beginPath();
  } else {
    cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  }
});

document.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;

  if (toolRadio.checked) {
    x = e.offsetX;
    y = e.offsetY;

    ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    const { offsetX, offsetY } = e;
    const { width, height } = cropCanvas;
    cropCtx.clearRect(0, 0, width, height);

    cropCtx.strokeStyle = 'white';
    cropCtx.lineWidth = 5;
    cropCtx.strokeRect(x, y, offsetX - x, offsetY - y);

    const left = Math.min(x, offsetX);
    const right = Math.max(x, offsetX);
    const top = Math.min(y, offsetY);
    const bottom = Math.max(y, offsetY);

    const cropWidth = width - left - (width - right);

    cropCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    cropCtx.fillRect(0, 0, left, height);
    cropCtx.fillRect(right, 0, width - right, height);
    cropCtx.fillRect(left, 0, cropWidth, top);
    cropCtx.fillRect(left, bottom, cropWidth, height);
  }
});

document.addEventListener('mouseup', (e) => {
  if (!isDrawing) return;
  isDrawing = false;

  if (toolRadio.checked) {
    ctx.closePath();
  } else {
    const { offsetX, offsetY } = e;
    const { width, height } = cropCanvas;

    const left = Math.min(x, offsetX);
    const right = Math.max(x, offsetX);
    const top = Math.min(y, offsetY);
    const bottom = Math.max(y, offsetY);

    const cropWidth = width - left - (width - right);
    const cropHeight = height - top - (height - bottom);
    croppedPosition = {
      x: left,
      y: top,
      width: cropWidth,
      height: cropHeight,
    };
  }
});

(async () => {
  const isPackaged: boolean = await ipcRenderer.invoke('is-packaged');
  if (!isPackaged) {
    searchInput.value = 'usb stick';
    folderInput.value = 'C:\\Users\\gesch\\Desktop\\Fotos\\Internet';
    folderPath = folderInput.value;

    images = [
      {
        img: 'https://www.bechtle.com/shop/medias/5c94e7f74c2f8519d6ea345a-900Wx900H-820Wx820H?context=bWFzdGVyfHJvb3R8MzUwNjd8aW1hZ2UvanBlZ3xoZGEvaDEzLzEwNjMxNzkzNDQyODQ2LmpwZ3wzNjM1YzY3NmVjMWE2MjdhMDA3NDg3YWYzMDI1YTRmMGQ5NDkyYWUxMjc3MjAyOWZmYTEzZDRjOTViZmM1YTMy',
        url: 'https://www.bechtle.com/shop/articona-onos-256-gb-usb-stick--925705--p',
      },
    ];
    index = 0;
    (document.querySelector('.form-button') as HTMLButtonElement).click();
    showImg();
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
  const isCropped = croppedPosition.width !== 0 && croppedPosition.height !== 0;
  const croppedCanvas = isCropped ? crop(canvas, croppedPosition) : canvas;

  const dataURL = croppedCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  const fileName = path.join(folderPath, `${uuidRadio.checked ? uuid() : currentSources.length}.png`);
  fs.writeFile(fileName, dataURL, 'base64', (err) => {
    if (err) console.error(err);
    nextBtn.click();
  });
});

const crop = (canvas: CanvasImageSource, { x, y, width, height }: CroppedPosition) => {
  const newCanvas = document.createElement('canvas');
  newCanvas.width = width;
  newCanvas.height = height;
  newCanvas.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, width, height);
  return newCanvas;
};

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
    cropCanvas.width = imageWidth;
    cropCanvas.height = imageHeight;

    ctx.lineWidth = parseInt(sizeInput.value);
    ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
    cropCtx.clearRect(0, 0, imageWidth, imageHeight);
    croppedPosition = { x: 0, y: 0, width: 0, height: 0 };
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
