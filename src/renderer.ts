import { ipcRenderer } from 'electron';
import fs from 'fs';
import './index.css';
import { Image } from './types';
import path from 'path';
import request from 'request';

let images: Image[];
let index = 0;
let folderPath: string;

const searchInput = document.querySelector<HTMLInputElement>('.search-input');
const folderInput = document.querySelector<HTMLInputElement>('.folder-input');
const imgElement = document.querySelector('img');
const nextBtn = document.querySelector<HTMLButtonElement>('.next-btn');
const error = document.querySelector('.error');

document.querySelector('.form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const searchValue = searchInput.value;
  const folderValue = folderInput.value;

  const isValidPath = await doesPathExist(folderValue);
  if (!isValidPath) return error.classList.remove('hidden');

  error.classList.add('hidden');
  folderPath = folderValue;

  const response: Image[] = await ipcRenderer.invoke('get-response', searchValue);

  if (response.length > 0) images = response;
  showImg();
});

document.querySelector('.choose-folder-btn').addEventListener('click', async () => {
  const response: Electron.OpenDialogReturnValue = await ipcRenderer.invoke('open-dialog');
  if (!response.canceled) folderInput.value = response.filePaths[0];
});

nextBtn.addEventListener('click', () => {
  index++;
  showImg();

  if (index === images.length - 1) nextBtn.disabled = true;
});

imgElement.addEventListener('error', () => {
  nextBtn.click();
});

document.querySelector('.save-btn').addEventListener('click', async () => {
  const image = images[index];

  const sourcesPath = path.join(folderPath, 'sources.txt');
  const currentSources = (await getCurrentSources(sourcesPath)).filter((src) => src.length > 0);
  await setSources(sourcesPath, [...currentSources, image.url]);

  // Download
  request.head(image.img, (err, res, body) => {
    request(image.img).pipe(fs.createWriteStream(path.join(folderPath, `${currentSources.length}.png`)));
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
  const image = images[index];
  imgElement.src = image.img;
}

function doesPathExist(path: string) {
  return new Promise((resolve) => {
    fs.readdir(path, (err) => {
      if (err) resolve(false);
      resolve(true);
    });
  });
}
