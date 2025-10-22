const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        fullscreen: true,
        icon: path.join(__dirname, 'assets/icon.png'),
        title: 'CoinFlip Casino 🎰',
        show: false
    });

    mainWindow.loadFile('src/index.html');
    
    // Показываем окно когда всё загружено
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    // Открываем DevTools для отладки (закомментируй в продакшене)
    // mainWindow.webContents.openDevTools();
}

// 🎰 УМНАЯ СИСТЕМА ДЛЯ ОДИНОЧНОЙ ИГРЫ
const SmartSinglePlayerSystem = {
    playerStats: new Map(),
    
    calculateWinProbability(playerId, betAmount, currentBalance) {
        const stats = this.getPlayerStats(playerId);
        const totalGames = stats.wins + stats.losses;
        const balanceRatio = currentBalance / 1000; // начальный баланс 1000
        
        // 🎁 ЗАМАНИВАНИЕ НОВИЧКОВ
        if (totalGames < 3) {
            console.log(`🎁 Одиночная: новичок ${playerId} - шанс 75%`);
            return 0.75;
        }
        
        // 🔁 КОМПЕНСАЦИЯ ПОСЛЕ ПРОИГРЫШЕЙ
        if (stats.lossStreak >= 2) {
            console.log(`🔁 Одиночная: компенсация после ${stats.lossStreak} проигрышей - 65%`);
            return 0.65;
        }
        
        // 📉 КОНТРОЛЬ БАЛАНСА
        if (balanceRatio > 1.8) {
            console.log(`📉 Одиночная: баланс x${balanceRatio.toFixed(1)} - слив 20%`);
            return 0.2;
        }
        
        if (balanceRatio > 1.3) {
            console.log(`📉 Одиночная: баланс x${balanceRatio.toFixed(1)} - снижение 35%`);
            return 0.35;
        }
        
        // 💸 КРУПНЫЕ СТАВКИ
        if (betAmount > 300) {
            console.log(`💸 Одиночная: крупная ставка ${betAmount} - шанс 30%`);
            return 0.3;
        }
        
        // 🎰 СТАНДАРТ
        console.log(`🎰 Одиночная: стандартный шанс 45%`);
        return 0.45;
    },
    
    getPlayerStats(playerId) {
        if (!this.playerStats.has(playerId)) {
            this.playerStats.set(playerId, {
                wins: 0,
                losses: 0,
                winStreak: 0,
                lossStreak: 0,
                totalWagered: 0,
                registeredAt: Date.now()
            });
        }
        return this.playerStats.get(playerId);
    },
    
    updatePlayerStats(playerId, won, amount) {
        const stats = this.getPlayerStats(playerId);
        stats.totalWagered += amount;
        
        if (won) {
            stats.wins++;
            stats.winStreak++;
            stats.lossStreak = 0;
        } else {
            stats.losses++;
            stats.lossStreak++;
            stats.winStreak = 0;
        }
        
        console.log(`📊 Одиночная ${playerId}: ${won ? 'ПОБЕДА' : 'ПРОИГРЫШ'} | Серия: ${won ? stats.winStreak : stats.lossStreak} | Всего игр: ${stats.wins + stats.losses}`);
    }
};

app.whenReady().then(() => {
    createWindow();
    
    // Показываем приветственное сообщение
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Добро пожаловать!',
        message: 'CoinFlip Casino 🎰',
        detail: 'Игра запущена успешно! Умная система шансов активирована.'
    });
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

// 🔥 УМНАЯ ОДИНОЧНАЯ ИГРА С СИСТЕМОЙ ЗАМАНИВАНИЯ/СЛИВА
ipcMain.handle('flip-coin-single', async (event, playerId, bet, amount, currentBalance = 1000) => {
    // УМНАЯ СИСТЕМА РАСЧЕТА ШАНСОВ
    const winProbability = SmartSinglePlayerSystem.calculateWinProbability(playerId, amount, currentBalance);
    const playerWins = Math.random() < winProbability;
    const result = playerWins ? bet : (bet === 'heads' ? 'tails' : 'heads');
    
    const win = result === bet;
    const commission = Math.floor(amount * 0.1);
    const winAmount = win ? (amount * 2) - commission : 0;
    
    // Обновляем статистику игрока
    SmartSinglePlayerSystem.updatePlayerStats(playerId, win, amount);
    
    console.log(`🎰 Одиночная игра: ${playerId} | Ставка: ${bet} | Выпало: ${result} | ${win ? 'ПОБЕДА' : 'ПРОИГРЫШ'} | Шанс: ${(winProbability * 100).toFixed(1)}%`);
    
    return {
        result: result,
        win: win,
        winAmount: winAmount,
        commission: commission
    };
});
