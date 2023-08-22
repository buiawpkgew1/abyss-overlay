const { app, BrowserWindow, globalShortcut, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const shell = require('electron').shell;
const electron_log = require('electron-log'); electron_log.catchErrors({ showDialog: true }); Object.assign(console, electron_log.functions);
const isDev = require('electron-is-dev');
const path = require('path');
const { exec } = require('child_process');
const { version } = require('./package.json');
require('dotenv').config({ path: path.join(__dirname, '.env') });
isDev && !app.isPackaged && require('electron-reloader')(module)?.catch(() => {});

if (process.platform === 'win32') app.setAppUserModelId('AbyssOverlay');

try{require('electron-json-config');}
catch{
    if (process.platform !== 'darwin'){
        fs.writeFileSync(`${homedir}/AppData/Roaming/Abyss Overlay/config.json`, JSON.stringify({}));
    }
    else{
        fs.writeFileSync(`${homedir}/Library/Application Support/Abyss Overlay/config.json`, JSON.stringify({}));
    }
}
const config = require('electron-json-config');

let win, splash;
function createWindow(){
    splash = new BrowserWindow({width: 400, height: 400, transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true, show: false, webPreferences: {nodeIntegration: true, contextIsolation: false}});
    splash.loadFile('src/splash.html');
    win = new BrowserWindow({width: 800, height: 600, show: false, frame: false, transparent: true, resizable: true, useContentSize: true, maximizable: false, minWidth: 400, icon: __dirname+'/assets/logo.ico', alwaysOnTop: true, title: 'Abyss Overlay', focusable: false, skipTaskbar: false, hasShadow: true, webPreferences: {nodeIntegration: true, enableRemoteModule: true, contextIsolation: false}});
    win.loadFile('src/index.html');
    //win.webContents.openDevTools();
    win.on('closed', () => {win = null});
    splash.once('ready-to-show', () => {
        splash.show();
        setTimeout(() => {splash.destroy(); win.show(); checkForUpdate(); setTimeout(() => {win.setSkipTaskbar(false);}, 1000);}, 4500);
    });
    /*win.once('ready-to-show', () => {
        splash.destroy(); win.show();
    });*/
    win.setAlwaysOnTop(true);
    win.setVisibleOnAllWorkspaces(true);
    win.setMenu(null);
    win.webContents.setUserAgent(`${process.env.AGENT_NAME}/${version}`);
}

let keybinds = {}
let through = false;

function setKeybind(bind, keybind) {
    //unbind key
    if(!keybind){
        if(keybinds[bind]){ globalShortcut.unregister(keybinds[bind]); }
        keybinds[bind] = keybind;
        return;
    }

    //bind key
    switch (bind) {
      case 'peak':
            try {
                globalShortcut.register(keybind, () => {
                    if (win.isVisible()) win.hide();
                    else if (!win.isVisible()) { win.showInactive(); win.moveTop(); }
                }); 
            } catch (error) {
                console.log(`在将 "${bind}" 设置为 "${keybind}" 时出现错误：`, error);
                break;
            }
         case 'clear':
            try {
                globalShortcut.register(keybind, () => {
                    win.webContents.send('clear')
                });
            } catch(error) {
                console.log(`在设置 "${bind}" 为 "${keybind}" 时出现错误：`, error);
                break;
            }
        case 'through':
            try {
                globalShortcut.register(keybind, () => {
                    through = !through;
                    if(through) win.setIgnoreMouseEvents(true);
                    else if(!through) win.setIgnoreMouseEvents(false);
                }); 
            } catch (error) {
                console.log(`设置 "${bind}" 为 "${keybind}" 时出现错误：`, error);   
                break;
            }
      default:
        if(keybinds[bind]){ globalShortcut.unregister(keybinds[bind]); }
        keybinds[bind] = keybind;
        break;
    }
}

app.whenReady().then(() => {
    createWindow();
    setKeybind('peak', config.get('settings.keybinds.peak', null) ?? 'CommandOrControl+Shift+A')
    setKeybind('clear', config.get('settings.keybinds.clear', null) ?? 'CommandOrControl+Shift+Z')
    setKeybind('through', config.get('settings.keybinds.through', null) ?? 'CommandOrControl+Shift+T')
    if (isDev) {
        globalShortcut.register('CommandOrControl+Shift+F9', () => {
            win.webContents.openDevTools({mode: 'detach'});
        });
        globalShortcut.register('Ctrl+Alt+A', () => {
            win.webContents.send('test', 'hi testing');
        });
    }
});

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

function checkForUpdate() {
    if (isDev) return;
    if (process.platform === 'win32') autoUpdater.checkForUpdates();
}

autoUpdater.on('update-downloaded', info => {
    const options = {
        type: 'info',
        title: `Abyss Overlay 更新 v${info.version} 已下载`,
        message: '已下载新的更新。强烈建议进行更新！是否立即自动重启覆盖层并安装更新？',
        detail: '在安装更新后，覆盖层将自动重启',
        buttons: ['是', '否'],
        icon: path.join(__dirname, 'assets', 'logo.ico'),
        defaultId: 0,
        checkboxLabel: '在浏览器中显示更新说明'
    };
    dialog.showMessageBox(win, options).then(returned => {
        if (returned.checkboxChecked === true) shell.openExternal('https://github.com/Chit132/abyss-overlay/releases/latest');
        if (returned.response === 0) autoUpdater.quitAndInstall(true, true);
    });
    //console.log(info);
});

autoUpdater.on('error', (err) => {
    console.log(err);
    dialog.showMessageBox(win, {
        type: 'error',
        title: '自动更新错误',
        message: '在自动更新覆盖层时出现错误！请尽快手动安装新的更新',
        detail: '点击"前往"将带您到新版本的下载页面',
        buttons: ['前往', '稍后'],
        defaultId: 0
    }).then(returned => {
        if (returned.response === 0) shell.openExternal('https://github.com/Chit132/abyss-overlay/releases/latest');
    });
});

const execPath = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'exec') : path.join(__dirname, 'exec');
var forceJAR = true;
function runJAR(event) {
    exec('javaw -jar key-sender.jar slash.w50 w h o enter', { cwd: execPath }, function(error, stdout, stderr) {
        console.log('jar ran');
        if (error != null) {
            console.log('JAR AUTOWHO ERROR:\n' + stderr);
            console.log(error);
            event.reply('autowho-err');
        }
        else forceJAR = true;
    });
}
ipcMain.on('autowho', (event) => {
    console.log('autowho');
    if (!forceJAR && process.platform === 'win32') {
        exec('wscript autowho.vbs', { cwd: execPath }, function(error, stdout, stderr) {
            if (error != null) {
                console.log('VBS AUTOWHO ERROR:\n' + stderr);
                console.log(error);
                runJAR(event);
            }
        });
    }
    else runJAR(event);
});

ipcMain.on('focus', (event, focusable) => {
    win.setFocusable(focusable);
    if (focusable) win.focus();
    else {
        win.blur();
        setTimeout(() => win.setSkipTaskbar(false), 100);
    }
});

ipcMain.on('setKeybind', (event, bind, keybind) => {
    setKeybind(bind, keybind)
});
