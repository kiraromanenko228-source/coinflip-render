const { ipcRenderer } = require('electron');

class CoinFlipCasino {
    constructor() {
        this.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
        this.balance = 1000;
        this.currentBet = null;
        this.currentAmount = 100;
        this.isFlipping = false;
        this.gameMode = 'single';
        this.bankAmount = 0;
        
        this.stats = {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            totalWin: 0
        };

        this.gamesHistory = [];
        this.leaders = [];
        
        // Мультиплеер
        this.multiplayer = new MultiplayerManager(this);
        
        // Статистика сервера
        this.serverStats = {
            online: 0,
            rooms: 0,
            queue: 0,
            totalGames: 0,
            peakOnline: 0
        };

        this.initializeEventListeners();
        this.loadPlayerData();
        this.multiplayer.connect();
        
        console.log('🎰 CoinFlip Casino инициализирована!');
    }

    initializeEventListeners() {
        // Табы
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Кнопки ставок (одиночная игра)
        document.querySelectorAll('.bet-btn').forEach(btn => {
            if (btn.id !== 'multiHeadsBtn' && btn.id !== 'multiTailsBtn') {
                btn.addEventListener('click', (e) => {
                    this.selectBet(e.target.dataset.bet);
                });
            }
        });

        // Контроль суммы ставки
        document.getElementById('customAmount').addEventListener('input', (e) => {
            this.setAmount(parseInt(e.target.value) || 0);
        });

        document.getElementById('doubleBtn').addEventListener('click', () => {
            this.doubleAmount();
        });

        document.getElementById('halfBtn').addEventListener('click', () => {
            this.halfAmount();
        });

        // Основная кнопка (одиночная игра)
        document.getElementById('flipBtn').addEventListener('click', () => {
            this.flipCoin();
        });

        // Бонусы
        document.getElementById('bonusBtn').addEventListener('click', () => {
            this.getDailyBonus();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetBalance();
        });

        // Мультиплеер кнопки
        document.getElementById('multiAmount').addEventListener('input', (e) => {
            this.setMultiAmount(parseInt(e.target.value) || 0);
        });

        document.getElementById('multiDoubleBtn').addEventListener('click', () => {
            this.doubleMultiAmount();
        });

        document.getElementById('multiHalfBtn').addEventListener('click', () => {
            this.halfMultiAmount();
        });

        document.getElementById('findOpponentBtn').addEventListener('click', () => {
            this.multiplayer.findOpponent(this.currentAmount);
        });

        document.getElementById('cancelSearchBtn').addEventListener('click', () => {
            this.multiplayer.cancelSearch();
        });

        document.getElementById('multiHeadsBtn').addEventListener('click', () => {
            this.multiplayer.makeBet('heads');
        });

        document.getElementById('multiTailsBtn').addEventListener('click', () => {
            this.multiplayer.makeBet('tails');
        });

        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.multiplayer.playAgain();
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        this.gameMode = tabName;
        
        if (tabName === 'multiplayer') {
            this.multiplayer.updateUI();
        }
        
        this.updateUI();
    }

    selectBet(bet) {
        if (this.isFlipping) return;

        this.currentBet = bet;
        
        document.querySelectorAll('.bet-btn').forEach(btn => {
            if (btn.id !== 'multiHeadsBtn' && btn.id !== 'multiTailsBtn') {
                btn.classList.remove('active');
            }
        });
        document.querySelectorAll(`[data-bet="${bet}"]`).forEach(btn => {
            btn.classList.add('active');
        });
        
        this.checkReadyState();
    }

    setAmount(amount) {
        if (amount < 10) amount = 10;
        if (amount > this.balance) amount = this.balance;
        
        this.currentAmount = amount;
        document.getElementById('customAmount').value = amount;
        
        this.checkReadyState();
    }

    setMultiAmount(amount) {
        if (amount < 10) amount = 10;
        if (amount > this.balance) amount = this.balance;
        
        this.currentAmount = amount;
        document.getElementById('multiAmount').value = amount;
        document.getElementById('searchAmount').textContent = amount;
    }

    doubleAmount() {
        let newAmount = this.currentAmount * 2;
        if (newAmount > this.balance) newAmount = this.balance;
        this.setAmount(newAmount);
    }

    doubleMultiAmount() {
        let newAmount = this.currentAmount * 2;
        if (newAmount > this.balance) newAmount = this.balance;
        this.setMultiAmount(newAmount);
    }

    halfAmount() {
        let newAmount = Math.floor(this.currentAmount / 2);
        if (newAmount < 10) newAmount = 10;
        this.setAmount(newAmount);
    }

    halfMultiAmount() {
        let newAmount = Math.floor(this.currentAmount / 2);
        if (newAmount < 10) newAmount = 10;
        this.setMultiAmount(newAmount);
    }

    checkReadyState() {
        const flipBtn = document.getElementById('flipBtn');
        const canPlay = this.currentBet && this.currentAmount >= 10 && this.currentAmount <= this.balance;
        
        flipBtn.disabled = !canPlay || this.isFlipping;
    }

    async flipCoin() {
        if (this.isFlipping || !this.currentBet || this.currentAmount < 10) return;
        
        this.isFlipping = true;
        document.getElementById('flipBtn').disabled = true;

        // Снимаем деньги
        this.balance -= this.currentAmount;
        this.updateUI();

        // Анимация
        const coin = document.getElementById('coin');
        coin.classList.add('flipping');

        try {
            const result = await ipcRenderer.invoke('flip-coin-single', this.playerId, this.currentBet, this.currentAmount);
            
            setTimeout(() => {
                coin.classList.remove('flipping');
                this.processResult(result);
                this.isFlipping = false;
            }, 1500);

        } catch (error) {
            console.error('Error:', error);
            this.isFlipping = false;
        }
    }

    processResult(result) {
        const resultDiv = document.getElementById('result');
        
        // Обновляем статистику
        this.stats.gamesPlayed++;
        
        if (result.win) {
            this.balance += result.winAmount;
            this.stats.wins++;
            this.stats.totalWin += result.winAmount - this.currentAmount;
            
            let message = `🎉 Выигрыш! Выпал ${this.getRussianName(result.result)}! +${result.winAmount} ₽`;
            if (result.commission > 0) {
                message += ` (комиссия: -${result.commission} ₽)`;
            }
            resultDiv.innerHTML = `<i class="fas fa-trophy"></i> ${message}`;
            resultDiv.className = 'result win';
        } else {
            this.stats.losses++;
            this.stats.totalWin -= this.currentAmount;
            resultDiv.innerHTML = `<i class="fas fa-times"></i> Проигрыш! Выпала ${this.getRussianName(result.result)}. -${this.currentAmount} ₽`;
            resultDiv.className = 'result lose';
        }

        // Добавляем в историю
        this.addToHistory({
            type: 'pve',
            bet: this.currentBet,
            amount: this.currentAmount,
            result: result.result,
            win: result.win,
            winAmount: result.winAmount,
            commission: result.commission,
            timestamp: new Date()
        });

        this.updateUI();
        this.saveGameData();
    }

    addToHistory(game) {
        this.gamesHistory.unshift(game);
        if (this.gamesHistory.length > 50) {
            this.gamesHistory = this.gamesHistory.slice(0, 50);
        }
        this.updateHistoryUI();
    }

    updateHistoryUI() {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        
        // Заголовок
        const header = document.createElement('div');
        header.className = 'history-item';
        header.style.background = 'rgba(255, 255, 255, 0.15)';
        header.style.fontWeight = 'bold';
        header.innerHTML = `
            <div>Тип игры</div>
            <div>Ставка</div>
            <div>Результат</div>
            <div>Сумма</div>
        `;
        historyList.appendChild(header);
        
        this.gamesHistory.forEach(game => {
            const item = document.createElement('div');
            item.className = `history-item ${game.win ? 'history-win' : 'history-lose'}`;
            
            const typeIcon = game.type === 'pve' ? '🤖' : '👥';
            const typeText = game.type === 'pve' ? 'Против бота' : 'PvP';
            const betText = this.getRussianName(game.bet);
            const resultText = this.getRussianName(game.result);
            
            let amountText = '';
            let amountIcon = '';
            if (game.win) {
                amountText = `+${game.winAmount} ₽`;
                amountIcon = '🟢';
                if (game.commission > 0) {
                    amountText += ` (-${game.commission}₽)`;
                }
            } else {
                amountText = `-${game.amount} ₽`;
                amountIcon = '🔴';
            }
            
            item.innerHTML = `
                <div>${typeIcon} ${typeText}</div>
                <div>${betText}</div>
                <div>${resultText}</div>
                <div>${amountIcon} ${amountText}</div>
            `;
            historyList.appendChild(item);
        });

        // Если история пустая
        if (this.gamesHistory.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'history-item';
            emptyItem.innerHTML = `
                <div colspan="4" style="text-align: center; opacity: 0.7;">
                    <i class="fas fa-history"></i> История игр пуста
                </div>
            `;
            historyList.appendChild(emptyItem);
        }
    }

    async getDailyBonus() {
        try {
            const today = new Date().toDateString();
            const lastBonus = localStorage.getItem('lastBonus');
            
            if (lastBonus === today) {
                document.getElementById('bonusStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Бонус уже получен сегодня';
                return;
            }
            
            this.balance += 100;
            localStorage.setItem('lastBonus', today);
            document.getElementById('bonusStatus').innerHTML = '<i class="fas fa-check"></i> +100 ₽ получено!';
            document.getElementById('bonusBtn').disabled = true;
            
            this.updateUI();
            this.saveGameData();
            
        } catch (error) {
            console.error('Bonus error:', error);
            document.getElementById('bonusStatus').innerHTML = '<i class="fas fa-times"></i> Ошибка получения бонуса';
        }
    }

    async resetBalance() {
        try {
            const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            const lastReset = localStorage.getItem('lastReset') || 0;
            
            if (this.balance > 0 || lastReset > twoWeeksAgo) {
                alert('❌ Сброс недоступен. Проверьте что баланс = 0 и прошло 2 недели с последнего сброса.');
                return;
            }
            
            this.balance = 1000;
            localStorage.setItem('lastReset', Date.now());
            document.getElementById('resetBtn').disabled = true;
            
            this.updateUI();
            this.saveGameData();
            alert('✅ Баланс сброшен до 1000 ₽');
            
        } catch (error) {
            console.error('Reset error:', error);
            alert('❌ Ошибка сброса баланса');
        }
    }

    getRussianName(side) {
        return side === 'heads' ? 'ОРЁЛ' : 'РЕШКА';
    }

    updateUI() {
        // Баланс и основные элементы
        document.getElementById('balance').textContent = this.balance;
        document.getElementById('gamesPlayed').textContent = this.stats.gamesPlayed;
        document.getElementById('wins').textContent = this.stats.wins;
        document.getElementById('losses').textContent = this.stats.losses;
        document.getElementById('totalWin').textContent = this.stats.totalWin;

        // Статистика сервера
        document.getElementById('onlinePlayers').textContent = this.serverStats.online;
        document.getElementById('activeRooms').textContent = this.serverStats.rooms;
        document.getElementById('waitingQueue').textContent = this.serverStats.queue;
        document.getElementById('totalGames').textContent = this.serverStats.totalGames;
        document.getElementById('peakOnline').textContent = this.serverStats.peakOnline;

        // Онлайн счетчик в хедере
        document.getElementById('onlineCount').innerHTML = `<i class="fas fa-users"></i> ${this.serverStats.online}`;

        // Проверяем возможность сброса
        document.getElementById('resetBtn').disabled = this.balance > 0;

        // Проверяем ежедневный бонус
        const today = new Date().toDateString();
        const bonusUsed = localStorage.getItem('lastBonus') === today;
        document.getElementById('bonusBtn').disabled = bonusUsed;
        if (bonusUsed && !document.getElementById('bonusStatus').textContent.includes('получено')) {
            document.getElementById('bonusStatus').innerHTML = '<i class="fas fa-check"></i> Бонус получен сегодня';
        }

        this.checkReadyState();
        this.updateHistoryUI();
    }

    updateServerStats(stats) {
        this.serverStats = stats;
        this.updateUI();
    }

    saveGameData() {
        const gameData = {
            playerId: this.playerId,
            balance: this.balance,
            stats: this.stats,
            gamesHistory: this.gamesHistory,
            lastSave: Date.now()
        };
        localStorage.setItem('coinFlipData', JSON.stringify(gameData));
    }

    loadGameData() {
        try {
            const saved = localStorage.getItem('coinFlipData');
            if (saved) {
                const data = JSON.parse(saved);
                this.playerId = data.playerId || this.playerId;
                this.balance = data.balance || 1000;
                this.stats = data.stats || this.stats;
                this.gamesHistory = data.gamesHistory || [];
                
                console.log('💾 Данные игры загружены');
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }
}

// Менеджер мультиплеера для Railway
class MultiplayerManager {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.socket = null;
        this.state = 'disconnected';
        this.roomId = null;
        this.opponent = null;
        this.betTimer = 30;
        this.myBet = null;
        this.opponentBet = null;
        this.pingInterval = null;
        this.lastPingTime = 0;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        try {
            // RAILWAY URL - ЗАМЕНИ НА СВОЙ ПОСЛЕ ДЕПЛОЯ!
            const serverURL = 'https://coinflip-render.onrender.com';
            
            console.log(`🔗 Подключаемся к серверу: ${serverURL}`);
            this.socket = new WebSocket(serverURL);
            
            this.socket.onopen = () => {
                console.log('✅ Успешное подключение к Railway серверу');
                this.state = 'connected';
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                
                // Авторизация
                this.socket.send(JSON.stringify({
                    type: 'auth',
                    playerId: this.game.playerId,
                    balance: this.game.balance
                }));
                
                // Запускаем пинг
                this.startPing();
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('❌ Ошибка парсинга сообщения:', error);
                }
            };
            
            this.socket.onclose = (event) => {
                console.log(`🔴 Отключение от сервера:`, event.code, event.reason);
                this.state = 'disconnected';
                this.updateConnectionStatus(false);
                
                this.stopPing();
                
                // Автоматическое переподключение
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(1000 * this.reconnectAttempts, 10000);
                    console.log(`🔄 Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts} через ${delay}мс`);
                    
                    setTimeout(() => {
                        if (this.state === 'disconnected') {
                            this.connect();
                        }
                    }, delay);
                } else {
                    this.showMessage('❌ Не удалось подключиться к серверу. Проверьте интернет соединение.');
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('💥 Ошибка WebSocket:', error);
                this.showMessage('❌ Ошибка подключения к игровому серверу');
            };
            
        } catch (error) {
            console.error('❌ Ошибка подключения:', error);
        }
    }

    handleMessage(data) {
        console.log('📨 Получено сообщение:', data.type, data);
        
        switch (data.type) {
            case 'auth_success':
                this.handleAuthSuccess(data);
                break;
            case 'searching':
                this.handleSearching(data);
                break;
            case 'opponent_found':
                this.handleOpponentFound(data);
                break;
            case 'timer_update':
                this.handleTimerUpdate(data);
                break;
            case 'bet_made':
                this.handleBetMade(data);
                break;
            case 'coin_flip_start':
                this.handleCoinFlipStart(data);
                break;
            case 'game_result':
                this.handleGameResult(data);
                break;
            case 'opponent_disconnected':
                this.handleOpponentDisconnected(data);
                break;
            case 'search_cancelled':
                this.handleSearchCancelled(data);
                break;
            case 'stats_update':
                this.game.updateServerStats(data);
                break;
            case 'pong':
                this.handlePong(data);
                break;
            case 'error':
                this.handleError(data);
                break;
        }
    }

    handleAuthSuccess(data) {
        this.state = 'connected';
        this.showMessage('✅ Успешное подключение к игровому серверу Railway');
        this.updateUI();
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            this.lastPingTime = Date.now();
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'ping'
                }));
            }
        }, 10000); // Пинг каждые 10 секунд
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    handlePong(data) {
        const ping = Date.now() - this.lastPingTime;
        // Можно отображать пинг в интерфейсе
        console.log(`📡 Пинг: ${ping}мс`);
    }

    findOpponent(amount) {
        if (this.state !== 'connected') {
            this.showMessage('❌ Нет подключения к серверу');
            return;
        }

        if (amount < 10 || amount > 10000) {
            this.showMessage('❌ Неверная сумма ставки (10-10000 ₽)');
            return;
        }

        if (amount > this.game.balance) {
            this.showMessage('❌ Недостаточно средств для этой ставки');
            return;
        }

        this.socket.send(JSON.stringify({
            type: 'find_opponent',
            betAmount: amount
        }));

        this.state = 'searching';
        this.updateUI();
    }

    cancelSearch() {
        if (this.state === 'searching') {
            this.socket.send(JSON.stringify({
                type: 'cancel_search'
            }));
            this.state = 'connected';
            this.updateUI();
        }
    }

    makeBet(bet) {
        if (this.state !== 'betting') {
            this.showMessage('❌ Не сейчас');
            return;
        }

        this.socket.send(JSON.stringify({
            type: 'make_bet',
            bet: bet,
            roomId: this.roomId
        }));

        this.myBet = bet;
        this.updateUI();
    }

    handleSearching(data) {
        this.state = 'searching';
        document.getElementById('queuePosition').textContent = data.queuePosition || 1;
        this.updateUI();
    }

    handleOpponentFound(data) {
        this.state = 'betting';
        this.roomId = data.roomId;
        this.opponent = data.opponent;
        this.betTimer = data.timer;
        this.myBet = null;
        this.opponentBet = null;
        
        document.getElementById('opponentId').textContent = this.opponent.id;
        document.getElementById('opponentBalance').textContent = this.opponent.balance;
        
        this.updateUI();
        this.startBettingTimer();
    }

    startBettingTimer() {
        const timerElement = document.getElementById('betTimer');
        if (!timerElement) return;

        const timerInterval = setInterval(() => {
            this.betTimer--;
            timerElement.textContent = this.betTimer;
            
            if (this.betTimer <= 0) {
                clearInterval(timerInterval);
                // Время вышло - автоматическая ставка
                if (!this.myBet) {
                    const randomBet = Math.random() > 0.5 ? 'heads' : 'tails';
                    this.makeBet(randomBet);
                    this.showMessage('⏰ Время вышло! Сделана случайная ставка.');
                }
            }
            
            if (this.state !== 'betting') {
                clearInterval(timerInterval);
            }
        }, 1000);
    }

    handleTimerUpdate(data) {
        this.betTimer = data.timer;
        document.getElementById('betTimer').textContent = data.timer;
    }

    handleBetMade(data) {
        if (data.playerId === this.game.playerId) {
            this.myBet = data.bet;
        } else {
            this.opponentBet = data.bet;
        }
        this.updateUI();
    }

    handleCoinFlipStart(data) {
        this.state = 'flipping';
        this.updateUI();
    }

    handleGameResult(data) {
        this.state = 'results';
        
        // Обновляем баланс
        if (data.balances[this.game.playerId]) {
            this.game.balance = data.balances[this.game.playerId];
        }
        
        // Показываем результат
        const isWinner = data.winner === this.game.playerId;
        const message = isWinner ? 
            `🎉 Вы победили! +${data.winAmount} ₽` :
            `😞 Вы проиграли! -${this.game.currentAmount} ₽`;
        
        const resultText = `${message} | Выпал: ${this.game.getRussianName(data.result)}`;
        
        document.getElementById('multiResult').innerHTML = resultText;
        document.getElementById('multiResult').className = `result ${isWinner ? 'win' : 'lose'}`;
        
        // Добавляем в историю
        this.game.addToHistory({
            type: 'pvp',
            bet: this.myBet,
            amount: this.game.currentAmount,
            result: data.result,
            win: isWinner,
            winAmount: isWinner ? data.winAmount : 0,
            commission: data.commission || 0,
            timestamp: new Date()
        });
        
        this.game.updateUI();
        this.updateUI();
        
        // Автоматический возврат в лобби через 10 секунд
        setTimeout(() => {
            if (this.state === 'results') {
                this.playAgain();
            }
        }, 10000);
    }

    handleOpponentDisconnected(data) {
        this.showMessage('❌ Соперник отключился от игры');
        this.resetMultiplayer();
    }

    handleSearchCancelled(data) {
        this.state = 'connected';
        this.showMessage('✅ Поиск соперника отменен');
        this.updateUI();
    }

    handleError(data) {
        this.showMessage(`❌ Ошибка: ${data.message}`);
    }

    playAgain() {
        this.resetMultiplayer();
    }

    resetMultiplayer() {
        this.state = 'connected';
        this.roomId = null;
        this.opponent = null;
        this.myBet = null;
        this.opponentBet = null;
        this.updateUI();
    }

    updateUI() {
        const stateElement = document.getElementById('multiplayerState');
        const searchingContent = document.getElementById('searchingContent');
        const bettingContent = document.getElementById('bettingContent');
        const flippingContent = document.getElementById('flippingContent');
        const resultsContent = document.getElementById('resultsContent');
        const findBtn = document.getElementById('findOpponentBtn');
        const cancelBtn = document.getElementById('cancelSearchBtn');

        // Сбрасываем все состояния
        searchingContent.style.display = 'none';
        bettingContent.style.display = 'none';
        flippingContent.style.display = 'none';
        resultsContent.style.display = 'none';
        stateElement.className = 'multiplayer-state searching-state';

        // Обновляем ставки
        document.getElementById('myBetValue').textContent = this.myBet ? this.game.getRussianName(this.myBet) : '-';
        document.getElementById('opponentBetValue').textContent = this.opponentBet ? this.game.getRussianName(this.opponentBet) : '-';

        switch (this.state) {
            case 'disconnected':
                stateElement.className = 'multiplayer-state searching-state';
                searchingContent.style.display = 'block';
                searchingContent.innerHTML = `
                    <h3 style="color: #f44336; margin-bottom: 20px;">
                        <i class="fas fa-plug"></i> Нет подключения
                    </h3>
                    <p>Попытка переподключения...</p>
                    <p>Попытка: ${this.reconnectAttempts}/${this.maxReconnectAttempts}</p>
                `;
                findBtn.disabled = true;
                cancelBtn.style.display = 'none';
                break;

            case 'connected':
                stateElement.className = 'multiplayer-state searching-state';
                searchingContent.style.display = 'block';
                findBtn.disabled = false;
                cancelBtn.style.display = 'none';
                break;

            case 'searching':
                stateElement.className = 'multiplayer-state searching-state';
                searchingContent.style.display = 'block';
                findBtn.disabled = true;
                cancelBtn.style.display = 'block';
                break;

            case 'betting':
                stateElement.className = 'multiplayer-state betting-state';
                bettingContent.style.display = 'block';
                break;

            case 'flipping':
                stateElement.className = 'multiplayer-state flipping-state';
                flippingContent.style.display = 'block';
                break;

            case 'results':
                stateElement.className = 'multiplayer-state results-state';
                resultsContent.style.display = 'block';
                break;
        }
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('serverStatus');
        
        if (connected) {
            statusDot.className = 'status-dot connected';
            statusText.innerHTML = '<i class="fas fa-check"></i> Подключено';
        } else {
            statusDot.className = 'status-dot';
            statusText.innerHTML = '<i class="fas fa-times"></i> Отключено';
        }
    }

    showMessage(message) {
        console.log('💬:', message);
        // Можно добавить красивую систему уведомлений
        const resultElement = document.getElementById('multiResult');
        if (resultElement) {
            resultElement.innerHTML = message;
            resultElement.className = 'result';
        }
    }
}

// Запускаем игру когда страница загружена
document.addEventListener('DOMContent

// Запускаем игру когда страница загружена
document.addEventListener('DOMContentLoaded', () => {
    window.game = new CoinFlipCasino();
    
    // Показываем информацию о версии
    console.log('🎰 CoinFlip Casino v1.0.0');
    console.log('🚀 Игра успешно запущена!');
    console.log('💡 Подсказка: Перейдите во вкладку "Онлайн мультиплеер" для игры с друзьями');
});
