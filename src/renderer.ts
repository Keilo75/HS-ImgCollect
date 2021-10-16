import { ipcRenderer } from 'electron';
import './index.css';

const searchInput = document.querySelector<HTMLInputElement>('#search-btn');
document.querySelector('#submit-btn').addEventListener('click', async () => {
  const value = searchInput.value;
  if (value.length === 0) return;

  const response = await ipcRenderer.invoke('get-response', value);
  console.log(response);
});
