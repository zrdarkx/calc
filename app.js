// ========================================
// State Management
// ========================================
const state = {
    rates: {
        bcv: 0,
        eur: 0,
        binance: 0
    },
    cryptoPrices: {
        BTC: 0,
        ETH: 0,
        BNB: 0,
        XRP: 0,
        SOL: 0,
        PAXG: 0
    },
    lastUpdate: null,
    isOnline: navigator.onLine,
    previousRates: {}
};

// ========================================
// Constants
// ========================================
const CACHE_KEY = 'exchangeRatesCache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const SATOSHIS_PER_BTC = 100000000;
const GWEI_PER_ETH = 1000000000;

// ========================================
// DOM Elements
// ========================================
const elements = {
    // Status
    statusIndicator: document.getElementById('statusIndicator'),
    lastUpdate: document.getElementById('lastUpdate'),
    
    // Dashboard rates
    bcvRate: document.getElementById('bcvRate'),
    eurRate: document.getElementById('eurRate'),
    binanceRate: document.getElementById('binanceRate'),
    bcvChange: document.getElementById('bcvChange'),
    eurChange: document.getElementById('eurChange'),
    binanceChange: document.getElementById('binanceChange'),
    
    // Buttons
    refreshBtn: document.getElementById('refreshBtn'),
    shareDashboardBtn: document.getElementById('shareDashboardBtn'),
    shareCalcBtn: document.getElementById('shareCalcBtn'),
    shareCryptoBtn: document.getElementById('shareCryptoBtn'),
    refreshCryptoBtn: document.getElementById('refreshCryptoBtn'),
    
    // Calculator - Simple
    rateSelect: document.getElementById('rateSelect'),
    directionSelect: document.getElementById('directionSelect'),
    amountInput: document.getElementById('amountInput'),
    inputLabel: document.getElementById('inputLabel'),
    singleResult: document.getElementById('singleResult'),
    
    // Calculator - Comparison
    rate1Select: document.getElementById('rate1Select'),
    rate2Select: document.getElementById('rate2Select'),
    compareDirection: document.getElementById('compareDirection'),
    compareAmount: document.getElementById('compareAmount'),
    compareInputLabel: document.getElementById('compareInputLabel'),
    rate1Name: document.getElementById('rate1Name'),
    rate2Name: document.getElementById('rate2Name'),
    rate1Result: document.getElementById('rate1Result'),
    rate2Result: document.getElementById('rate2Result'),
    averageResult: document.getElementById('averageResult'),
    differenceResult: document.getElementById('differenceResult'),
    
    // Crypto
    cryptoSelect: document.getElementById('cryptoSelect'),
    cryptoDirection: document.getElementById('cryptoDirection'),
    cryptoAmount: document.getElementById('cryptoAmount'),
    cryptoResult: document.getElementById('cryptoResult'),
    cryptoInputLabel: document.getElementById('cryptoInputLabel'),
    useSmallUnit: document.getElementById('useSmallUnit'),
    smallUnitGroup: document.getElementById('smallUnitGroup'),
    smallUnitName: document.getElementById('smallUnitName'),
    
    // Loading
    loadingOverlay: document.getElementById('loadingOverlay'),
    toastContainer: document.getElementById('toastContainer')
};

// ========================================
// Utility Functions
// ========================================
function formatCurrency(value, locale = 'es-VE', options = {}) {
    return value.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...options
    });
}

function showLoading(show = true) {
    elements.loadingOverlay.classList.toggle('active', show);
}

function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function updateOnlineStatus() {
    state.isOnline = navigator.onLine;
    elements.statusIndicator.className = `status-indicator ${state.isOnline ? 'online' : 'offline'}`;
}

function saveToCache(data) {
    const cacheData = {
        ...data,
        timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
}

function loadFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;
        
        const data = JSON.parse(cached);
        const age = Date.now() - data.timestamp;
        
        if (age < CACHE_EXPIRY) {
            return data;
        }
        
        return null;
    } catch (error) {
        console.error('Error loading cache:', error);
        return null;
    }
}

// ========================================
// API Functions
// ========================================
async function fetchExchangeRates() {
    try {
        showLoading(true);
        
        // Store previous rates for comparison
        state.previousRates = { ...state.rates };
        
        // Fetch USD to VES (BCV)
        const bcvResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const bcvData = await bcvResponse.json();
        state.rates.bcv = bcvData.rates.VES;
        
        // Fetch EUR to VES (BCV)
        const eurResponse = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
        const eurData = await eurResponse.json();
        state.rates.eur = eurData.rates.VES;
        
        // Fetch USDT to VES (Binance P2P)
        const binanceResponse = await fetch('https://criptoya.com/api/binancep2p/USDT/VES/1');
        const binanceData = await binanceResponse.json();
        state.rates.binance = binanceData.bid;
        
        state.lastUpdate = new Date();
        
        // Save to cache
        saveToCache({
            rates: state.rates,
            cryptoPrices: state.cryptoPrices,
            lastUpdate: state.lastUpdate
        });
        
        updateDashboard();
        showToast('Actualización exitosa', 'Tasas actualizadas correctamente', 'success');
        
        // Send notification if enabled
        sendNotification();
        
    } catch (error) {
        console.error('Error fetching rates:', error);
        
        // Try to load from cache
        const cached = loadFromCache();
        if (cached) {
            state.rates = cached.rates;
            state.lastUpdate = new Date(cached.timestamp);
            updateDashboard();
            showToast('Modo sin conexión', 'Mostrando datos guardados', 'info');
        } else {
            showToast('Error', 'No se pudieron cargar las tasas', 'error');
        }
    } finally {
        showLoading(false);
    }
}

async function fetchCryptoPrices() {
    try {
        showLoading(true);
        
        const symbols = ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'PAXG'];
        const promises = symbols.map(async (symbol) => {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);
            const data = await response.json();
            return { symbol, price: parseFloat(data.price) };
        });
        
        const results = await Promise.all(promises);
        results.forEach(({ symbol, price }) => {
            state.cryptoPrices[symbol] = price;
        });
        
        // Save to cache
        saveToCache({
            rates: state.rates,
            cryptoPrices: state.cryptoPrices,
            lastUpdate: state.lastUpdate || new Date()
        });
        
        updateCryptoPrices();
        showToast('Actualización exitosa', 'Precios de criptomonedas actualizados', 'success');
        
    } catch (error) {
        console.error('Error fetching crypto prices:', error);
        showToast('Error', 'No se pudieron cargar los precios de criptomonedas', 'error');
    } finally {
        showLoading(false);
    }
}

// ========================================
// Update Functions
// ========================================
function updateDashboard() {
    // Update rates display
    elements.bcvRate.textContent = `Bs. ${formatCurrency(state.rates.bcv)}`;
    elements.eurRate.textContent = `Bs. ${formatCurrency(state.rates.eur)}`;
    elements.binanceRate.textContent = `Bs. ${formatCurrency(state.rates.binance)}`;
    
    // Update change indicators
    updateChangeIndicator('bcv', state.rates.bcv, state.previousRates.bcv);
    updateChangeIndicator('eur', state.rates.eur, state.previousRates.eur);
    updateChangeIndicator('binance', state.rates.binance, state.previousRates.binance);
    
    // Update last update time
    if (state.lastUpdate) {
        const timeString = state.lastUpdate.toLocaleString('es-VE', {
            dateStyle: 'short',
            timeStyle: 'short'
        });
        elements.lastUpdate.textContent = `Actualizado: ${timeString}`;
    }
}

function updateChangeIndicator(rateType, current, previous) {
    const element = elements[`${rateType}Change`];
    if (!previous || previous === 0) {
        element.textContent = '--';
        element.className = 'change';
        return;
    }
    
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    
    element.textContent = `${isPositive ? '+' : ''}${change.toFixed(2)}%`;
    element.className = `change ${isPositive ? 'positive' : 'negative'}`;
}

function updateCryptoPrices() {
    Object.keys(state.cryptoPrices).forEach(symbol => {
        const price = state.cryptoPrices[symbol];
        const priceElement = document.getElementById(`${symbol.toLowerCase()}Price`);
        const vesElement = document.getElementById(`${symbol.toLowerCase()}Ves`);
        
        if (priceElement && vesElement) {
            priceElement.textContent = `$${formatCurrency(price)}`;
            const vesPrice = price * state.rates.binance;
            vesElement.textContent = `Bs. ${formatCurrency(vesPrice)}`;
        }
    });
}

// ========================================
// Calculator Functions
// ========================================
function calculateSingle() {
    const rateType = elements.rateSelect.value;
    const direction = elements.directionSelect.value;
    const amount = parseFloat(elements.amountInput.value) || 0;
    
    const rate = state.rates[rateType];
    let result = 0;
    
    if (direction === 'toVes') {
        result = amount * rate;
        elements.singleResult.textContent = `Bs. ${formatCurrency(result)}`;
    } else {
        result = amount / rate;
        const currency = rateType === 'eur' ? 'EUR' : (rateType === 'binance' ? 'USDT' : 'USD');
        elements.singleResult.textContent = `${currency} ${formatCurrency(result)}`;
    }
}

function calculateComparison() {
    const rate1Type = elements.rate1Select.value;
    const rate2Type = elements.rate2Select.value;
    const direction = elements.compareDirection.value;
    const amount = parseFloat(elements.compareAmount.value) || 0;
    
    const rate1 = state.rates[rate1Type];
    const rate2 = state.rates[rate2Type];
    
    let result1, result2, average;
    
    if (direction === 'fromVes') {
        // VES → Divisa
        result1 = amount / rate1;
        result2 = amount / rate2;
        average = (result1 + result2) / 2;
    } else {
        // Divisa → VES
        result1 = amount * rate1;
        result2 = amount * rate2;
        average = (result1 + result2) / 2;
    }
    
    // Calculate percentage difference
    const difference = result2 !== 0 ? Math.abs(((result1 - result2) / result2) * 100) : 0;
    
    // Update names
    const names = {
        bcv: 'Dólar BCV',
        eur: 'Euro BCV',
        binance: 'USDT Binance'
    };
    
    elements.rate1Name.textContent = names[rate1Type];
    elements.rate2Name.textContent = names[rate2Type];
    
    // Update results with proper formatting
    if (direction === 'fromVes') {
        // Showing currency amounts
        const getCurrency = (type) => {
            if (type === 'eur') return 'EUR';
            if (type === 'binance') return 'USDT';
            return 'USD';
        };
        
        elements.rate1Result.textContent = `${getCurrency(rate1Type)} ${formatCurrency(result1)}`;
        elements.rate2Result.textContent = `${getCurrency(rate2Type)} ${formatCurrency(result2)}`;
        elements.averageResult.textContent = formatCurrency(average);
    } else {
        // Showing VES amounts
        elements.rate1Result.textContent = `Bs. ${formatCurrency(result1)}`;
        elements.rate2Result.textContent = `Bs. ${formatCurrency(result2)}`;
        elements.averageResult.textContent = `Bs. ${formatCurrency(average)}`;
    }
    
    elements.differenceResult.textContent = `${formatCurrency(difference)}%`;
}

function calculateCrypto() {
    const crypto = elements.cryptoSelect.value;
    const direction = elements.cryptoDirection.value;
    const amount = parseFloat(elements.cryptoAmount.value) || 0;
    const useSmall = elements.useSmallUnit.checked;
    
    const cryptoPrice = state.cryptoPrices[crypto];
    const usdtVes = state.rates.binance;
    let result = 0;
    let resultText = '';
    
    switch(direction) {
        case 'usdtToCrypto':
            result = amount / cryptoPrice;
            if (useSmall && crypto === 'BTC') {
                result = result * SATOSHIS_PER_BTC;
                resultText = `${formatCurrency(result, 'en-US', { maximumFractionDigits: 0 })} Satoshis`;
            } else if (useSmall && crypto === 'ETH') {
                result = result * GWEI_PER_ETH;
                resultText = `${formatCurrency(result, 'en-US', { maximumFractionDigits: 0 })} Gwei`;
            } else {
                resultText = `${formatCurrency(result, 'en-US', { maximumFractionDigits: 8 })} ${crypto}`;
            }
            break;
            
        case 'cryptoToUsdt':
            result = amount * cryptoPrice;
            resultText = `${formatCurrency(result)} USDT`;
            break;
            
        case 'vesToCrypto':
            const usdtAmount = amount / usdtVes;
            result = usdtAmount / cryptoPrice;
            if (useSmall && crypto === 'BTC') {
                result = result * SATOSHIS_PER_BTC;
                resultText = `${formatCurrency(result, 'en-US', { maximumFractionDigits: 0 })} Satoshis`;
            } else if (useSmall && crypto === 'ETH') {
                result = result * GWEI_PER_ETH;
                resultText = `${formatCurrency(result, 'en-US', { maximumFractionDigits: 0 })} Gwei`;
            } else {
                resultText = `${formatCurrency(result, 'en-US', { maximumFractionDigits: 8 })} ${crypto}`;
            }
            break;
            
        case 'cryptoToVes': //abogado
			const usdtValue = amount * cryptoPrice;
            result = usdtValue * usdtVes;
            resultText = `Bs. ${formatCurrency(result)}`;
            break;
    }
    
    elements.cryptoResult.textContent = resultText;
}

function updateCryptoInputLabel() {
    const direction = elements.cryptoDirection.value;
    const crypto = elements.cryptoSelect.value;
    
    const labels = {
        'usdtToCrypto': 'Cantidad (USDT):',
        'cryptoToUsdt': `Cantidad (${crypto}):`,
        'vesToCrypto': 'Cantidad (VES):',
        'cryptoToVes': `Cantidad (${crypto}):`
    };
    
    elements.cryptoInputLabel.textContent = labels[direction];
    
    // Show/hide small unit option
    const showSmallUnit = (crypto === 'BTC' || crypto === 'ETH') && 
                          (direction === 'usdtToCrypto' || direction === 'vesToCrypto');
    elements.smallUnitGroup.style.display = showSmallUnit ? 'block' : 'none';
    
    if (showSmallUnit) {
        elements.smallUnitName.textContent = crypto === 'BTC' ? 'Satoshis' : 'Gwei';
    }
}

function updateDirectionLabel() {
    const direction = elements.directionSelect.value;
    const rateType = elements.rateSelect.value;
    
    const currency = rateType === 'eur' ? 'EUR' : (rateType === 'binance' ? 'USDT' : 'USD');
    
    if (direction === 'toVes') {
        elements.inputLabel.textContent = `Cantidad (${currency}):`;
    } else {
        elements.inputLabel.textContent = 'Cantidad (VES):';
    }
}

function updateCompareDirectionLabel() {
    const direction = elements.compareDirection.value;
    
    if (direction === 'toVes') {
        elements.compareInputLabel.textContent = 'Cantidad (Divisa):';
    } else {
        elements.compareInputLabel.textContent = 'Cantidad (VES):';
    }
}

// ========================================
// Share Functions
// ========================================
async function shareDashboard() {
    const text = `💱 Tasas de Cambio Venezuela
    
🇺🇸 Dólar BCV: Bs. ${formatCurrency(state.rates.bcv)}
🇪🇺 Euro BCV: Bs. ${formatCurrency(state.rates.eur)}
₮ USDT Binance: Bs. ${formatCurrency(state.rates.binance)}

Actualizado: ${state.lastUpdate.toLocaleString('es-VE')}`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Tasas de Cambio Venezuela',
                text: text
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                copyToClipboard(text);
            }
        }
    } else {
        copyToClipboard(text);
    }
}

async function shareCalculator() {
    const rateType = elements.rateSelect.value;
    const direction = elements.directionSelect.value;
    const amount = parseFloat(elements.amountInput.value) || 0;
    const result = elements.singleResult.textContent;
    
    const names = {
        bcv: 'Dólar BCV',
        eur: 'Euro BCV',
        binance: 'USDT Binance'
    };
    
    const directionText = direction === 'toVes' ? '→ VES' : 'VES →';
    
    const text = `🧮 Calculadora de Tasas

${names[rateType]}
${amount} ${directionText}
Resultado: ${result}

Actualizado: ${state.lastUpdate.toLocaleString('es-VE')}`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Calculadora de Tasas',
                text: text
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                copyToClipboard(text);
            }
        }
    } else {
        copyToClipboard(text);
    }
}

async function shareCrypto() {
    let text = `🪙 Precios de Criptomonedas (USDT)
    
₿ Bitcoin: $${formatCurrency(state.cryptoPrices.BTC)}
Ξ Ethereum: $${formatCurrency(state.cryptoPrices.ETH)}
● BNB: $${formatCurrency(state.cryptoPrices.BNB)}
✕ Ripple: $${formatCurrency(state.cryptoPrices.XRP)}
◎ Solana: $${formatCurrency(state.cryptoPrices.SOL)}
⚜ PAX Gold: $${formatCurrency(state.cryptoPrices.PAXG)}

USDT: Bs. ${formatCurrency(state.rates.binance)}`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Precios de Criptomonedas',
                text: text
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                copyToClipboard(text);
            }
        }
    } else {
        copyToClipboard(text);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copiado', 'Texto copiado al portapapeles', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showToast('Copiado', 'Texto copiado al portapapeles', 'success');
    } catch (error) {
        showToast('Error', 'No se pudo copiar el texto', 'error');
    }
    
    document.body.removeChild(textArea);
}

// ========================================
// Notification Functions
// ========================================
async function requestNotificationPermission() {
    if ('Notification' in window && 'serviceWorker' in navigator) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    return false;
}

function sendNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('💱 Tasas Actualizadas', {
            body: `Dólar BCV: Bs. ${formatCurrency(state.rates.bcv)}\nEuro BCV: Bs. ${formatCurrency(state.rates.eur)}\nUSDT: Bs. ${formatCurrency(state.rates.binance)}`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200],
            tag: 'rate-update',
            requireInteraction: false
        });
        
        notification.onclick = function() {
            window.focus();
            notification.close();
        };
        
        setTimeout(() => notification.close(), 10000);
    }
}

function scheduleDailyNotification() {
    // Check if we should send notification (every 24 hours)
    const lastNotification = localStorage.getItem('lastNotification');
    const now = Date.now();
    
    if (!lastNotification || now - parseInt(lastNotification) > CACHE_EXPIRY) {
        if (state.lastUpdate && state.rates.bcv > 0) {
            sendNotification();
            localStorage.setItem('lastNotification', now.toString());
        }
    }
    
    // Schedule next check in 1 hour
    setTimeout(scheduleDailyNotification, 60 * 60 * 1000);
}

// ========================================
// Tab Navigation
// ========================================
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // Load crypto prices when switching to crypto tab
            if (targetTab === 'crypto' && state.cryptoPrices.BTC === 0) {
                fetchCryptoPrices();
            }
        });
    });
}

// ========================================
// Event Listeners
// ========================================
function initEventListeners() {
    // Online/Offline detection
    window.addEventListener('online', () => {
        updateOnlineStatus();
        showToast('Conectado', 'Conexión a Internet restaurada', 'success');
        fetchExchangeRates();
    });
    
    window.addEventListener('offline', () => {
        updateOnlineStatus();
        showToast('Sin conexión', 'Usando datos guardados', 'info');
    });
    
    // Refresh buttons
    elements.refreshBtn.addEventListener('click', fetchExchangeRates);
    elements.refreshCryptoBtn.addEventListener('click', fetchCryptoPrices);
    
    // Share buttons
    elements.shareDashboardBtn.addEventListener('click', shareDashboard);
    elements.shareCalcBtn.addEventListener('click', shareCalculator);
    elements.shareCryptoBtn.addEventListener('click', shareCrypto);
    
    // Calculator - Single conversion
    elements.rateSelect.addEventListener('change', () => {
        updateDirectionLabel();
        calculateSingle();
    });
    
    elements.directionSelect.addEventListener('change', () => {
        updateDirectionLabel();
        calculateSingle();
    });
    
    elements.amountInput.addEventListener('input', calculateSingle);
    
    // Calculator - Comparison
    elements.rate1Select.addEventListener('change', calculateComparison);
    elements.rate2Select.addEventListener('change', calculateComparison);
    elements.compareDirection.addEventListener('change', () => {
        updateCompareDirectionLabel();
        calculateComparison();
    });
    elements.compareAmount.addEventListener('input', calculateComparison);
    
    // Crypto calculator
    elements.cryptoSelect.addEventListener('change', () => {
        updateCryptoInputLabel();
        calculateCrypto();
    });
    
    elements.cryptoDirection.addEventListener('change', () => {
        updateCryptoInputLabel();
        calculateCrypto();
    });
    
    elements.cryptoAmount.addEventListener('input', calculateCrypto);
    elements.useSmallUnit.addEventListener('change', calculateCrypto);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + R para refrescar
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab.id === 'crypto') {
                fetchCryptoPrices();
            } else {
                fetchExchangeRates();
            }
        }
        
        // Escape para cerrar loading
        if (e.key === 'Escape') {
            showLoading(false);
        }
    });
    
    // Auto-refresh rates every 30 minutes
    setInterval(() => {
        if (state.isOnline) {
            fetchExchangeRates();
        }
    }, 30 * 60 * 1000);
    
    // Auto-refresh crypto prices every 5 minutes
    setInterval(() => {
        if (state.isOnline && document.getElementById('crypto').classList.contains('active')) {
            fetchCryptoPrices();
        }
    }, 5 * 60 * 1000);
    
    // Page visibility API - refresh when user returns to tab
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.isOnline) {
            const lastUpdate = state.lastUpdate ? state.lastUpdate.getTime() : 0;
            const now = Date.now();
            
            // Refresh if more than 10 minutes have passed
            if (now - lastUpdate > 10 * 60 * 1000) {
                fetchExchangeRates();
                
                const activeTab = document.querySelector('.tab-content.active');
                if (activeTab.id === 'crypto' && state.cryptoPrices.BTC > 0) {
                    fetchCryptoPrices();
                }
            }
        }
    });
}

// ========================================
// Service Worker Registration
// ========================================
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('Service Worker update found!');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showToast('Actualización disponible', 'Recarga la página para actualizar', 'info');
                    }
                });
            });
            
            // Check for updates every hour
            setInterval(() => {
                registration.update();
            }, 60 * 60 * 1000);
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}

// ========================================
// PWA Install Prompt
// ========================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button or banner
    showToast('Instalar App', 'Puedes instalar esta app en tu dispositivo', 'info');
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showToast('¡Instalado!', 'La app se ha instalado correctamente', 'success');
});

// ========================================
// Initialization
// ========================================
async function init() {
    console.log('🚀 Iniciando aplicación...');
    
    // Initialize tabs
    initTabs();
    
    // Initialize event listeners
    initEventListeners();
    
    // Update online status
    updateOnlineStatus();
    
    // Try to load from cache first
    const cached = loadFromCache();
    if (cached) {
        state.rates = cached.rates || state.rates;
        state.cryptoPrices = cached.cryptoPrices || state.cryptoPrices;
        state.lastUpdate = new Date(cached.timestamp);
        updateDashboard();
        if (state.cryptoPrices.BTC > 0) {
            updateCryptoPrices();
        }
        console.log('✅ Datos cargados desde caché');
    }
    
    // Fetch fresh data if online
    if (state.isOnline) {
        await fetchExchangeRates();
    } else {
        if (!cached) {
            showToast('Sin conexión', 'No hay datos guardados disponibles', 'error');
        }
    }
    
    // Request notification permission
    const notificationGranted = await requestNotificationPermission();
    if (notificationGranted) {
        console.log('✅ Permisos de notificación concedidos');
    }
    
    // Start daily notification schedule
    scheduleDailyNotification();
    
    // Register service worker
    await registerServiceWorker();
    
    // Set initial labels
    updateDirectionLabel();
    updateCompareDirectionLabel();
    updateCryptoInputLabel();
    
    console.log('✅ Aplicación iniciada correctamente');
}

// ========================================
// Error Handling
// ========================================
window.addEventListener('error', (e) => {
    console.error('Error global:', e.error);
    showToast('Error', 'Ha ocurrido un error inesperado', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise rechazada:', e.reason);
    showToast('Error', 'Error al procesar la solicitud', 'error');
});

// ========================================
// Start the application
// ========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging
if (typeof window !== 'undefined') {
    window.appState = state;
    window.appFunctions = {
        fetchExchangeRates,
        fetchCryptoPrices,
        calculateSingle,
        calculateComparison,
        calculateCrypto
    };
}
