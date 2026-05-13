/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'JP-Word 简谱编辑器',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 隐藏默认菜单栏
  Menu.setApplicationMenu(null);

  // 加载 Vite 构建产物
  win.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
