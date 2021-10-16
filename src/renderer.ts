import { ipcRenderer } from 'electron';
import fs from 'fs';
import './index.css';
import path from 'path';
import request from 'request';
import { Image as IImage } from './types';

let images: IImage[];
let index = 0;
let folderPath: string;

const searchInput = document.querySelector<HTMLInputElement>('.search-input');
const folderInput = document.querySelector<HTMLInputElement>('.folder-input');
const limitInput = document.querySelector<HTMLInputElement>('.limit-input');
const nextBtn = document.querySelector<HTMLButtonElement>('.next-btn');
const error = document.querySelector('.error');
const submitBtn = document.querySelector<HTMLButtonElement>('.submit-btn');

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

(async () => {
  const isPackaged: boolean = await ipcRenderer.invoke('is-packaged');
  if (!isPackaged) {
    searchInput.value = 'usb stick';
    folderInput.value = 'C:\\Users\\gesch\\Desktop\\Fotos\\Internet';
  }
})();

document.querySelector('.form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const searchValue = searchInput.value;
  const folderValue = folderInput.value;
  const limitValue = parseInt(limitInput.value);

  const isValidPath = await doesPathExist(folderValue);
  if (!isValidPath) return error.classList.remove('hidden');

  error.classList.add('hidden');
  folderPath = folderValue;

  submitBtn.disabled = true;
  const response: IImage[] = await ipcRenderer.invoke('get-response', { searchTerm: searchValue, limit: limitValue });
  submitBtn.disabled = false;

  if (response.length === 0) return;
  images = response;
  index = 0;
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
  fs.writeFile(fileName, dataURL, 'base64', (err) => console.log(err));
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
