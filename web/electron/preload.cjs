const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("streamVaultDesktop", {
  openExternal: (url) => ipcRenderer.invoke("open-external-url", url),
});
