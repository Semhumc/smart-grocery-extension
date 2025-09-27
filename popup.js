// popup.js - Extension popup functionality

let pendingIngredients = [];
let currentTab = null;

// DOM yüklendiğinde
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup yüklendi');
    
    // Mevcut tab bilgisini al
    await getCurrentTab();
    
    // Pending ingredients'ları yükle
    await loadPendingIngredients();
    
    // UI'ı güncelle
    updateUI();
    
    // Event listener'ları ekle
    setupEventListeners();
});

// Mevcut tab bilgisini al
async function getCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;
        console.log('Mevcut tab:', tab.url);
    } catch (error) {
        console.error('Tab bilgisi alınamadı:', error);
    }
}

// Bekleyen malzemeleri yükle
async function loadPendingIngredients() {
    try {
        const result = await chrome.storage.local.get(['pendingIngredients']);
        pendingIngredients = result.pendingIngredients || [];
        console.log('Yüklenen malzemeler:', pendingIngredients);
    } catch (error) {
        console.error('Storage okuma hatası:', error);
    }
}

// UI'ı güncelle
function updateUI() {
    updateStatus();
    updateIngredientsList();
    updateButtons();
}

// Status'u güncelle
function updateStatus() {
    const statusEl = document.getElementById('status');
    const isYemekSepeti = currentTab && currentTab.url && currentTab.url.includes('yemeksepeti.com');
    
    if (isYemekSepeti) {
        statusEl.className = 'status active';
        statusEl.innerHTML = '<span class="status-icon">✅</span><span>YemekSepeti Market - Hazır!</span>';
    } else {
        statusEl.className = 'status inactive';
        statusEl.innerHTML = '<span class="status-icon">⚠️</span><span>YemekSepeti Market sayfasında değilsiniz</span>';
    }
}

// Malzeme listesini güncelle
function updateIngredientsList() {
    const pendingSection = document.getElementById('pending-section');
    const noIngredientsEl = document.getElementById('no-ingredients');
    const ingredientListEl = document.getElementById('ingredient-list');
    
    if (pendingIngredients && pendingIngredients.length > 0) {
        pendingSection.style.display = 'block';
        noIngredientsEl.style.display = 'none';
        
        ingredientListEl.innerHTML = pendingIngredients
            .map((ingredient, index) => 
                `<div class="ingredient-item">${index + 1}. ${ingredient}</div>`
            )
            .join('');
    } else {
        pendingSection.style.display = 'none';
        noIngredientsEl.style.display = 'block';
        ingredientListEl.innerHTML = '';
    }
}

// Butonları güncelle
function updateButtons() {
    const addToCartBtn = document.getElementById('addToCartBtn');
    const hasIngredients = pendingIngredients && pendingIngredients.length > 0;
    const isYemekSepeti = currentTab && currentTab.url && currentTab.url.includes('yemeksepeti.com');
    
    addToCartBtn.disabled = !hasIngredients || !isYemekSepeti;
    addToCartBtn.textContent = hasIngredients 
        ? `Sepete Ekle (${pendingIngredients.length})` 
        : 'Sepete Ekle';
}

// Event listener'ları ayarla
function setupEventListeners() {
    // Sepete ekle butonu
    document.getElementById('addToCartBtn').addEventListener('click', handleAddToCart);
    
    // YemekSepeti'ni aç butonu
    document.getElementById('openYemekSepetiBtn').addEventListener('click', openYemekSepeti);
    
    // Temizle butonu
    document.getElementById('clearBtn').addEventListener('click', clearIngredients);
    
    // Storage değişikliklerini dinle
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (changes.pendingIngredients) {
            pendingIngredients = changes.pendingIngredients.newValue || [];
            updateUI();
        }
    });
    
    // Tab değişikliklerini dinle
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tab.active && changeInfo.status === 'complete') {
            currentTab = tab;
            updateUI();
        }
    });
    
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        currentTab = tab;
        updateUI();
    });
}

// Sepete ekleme işlemi
async function handleAddToCart() {
    if (!pendingIngredients || pendingIngredients.length === 0) {
        showMessage('Eklenecek malzeme bulunmuyor!', 'error');
        return;
    }
    
    if (!currentTab || !currentTab.url || !currentTab.url.includes('yemeksepeti.com')) {
        showMessage('Önce YemekSepeti Market sayfasına gidin!', 'error');
        return;
    }
    
    try {
        // Loading göster
        showLoading(true);
        
        // Background script'e mesaj gönder
        const response = await chrome.runtime.sendMessage({
            action: 'addIngredientsToCart',
            ingredients: pendingIngredients
        });
        
        if (response.success) {
            showMessage(`${pendingIngredients.length} malzeme sepete ekleniyor...`, 'success');
            
            // Popup'ı kapat
            setTimeout(() => {
                window.close();
            }, 2000);
        } else {
            showMessage('Sepete ekleme başarısız: ' + response.error, 'error');
        }
        
    } catch (error) {
        console.error('Sepete ekleme hatası:', error);
        showMessage('Bir hata oluştu: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// YemekSepeti Market'i aç
async function openYemekSepeti() {
    try {
        await chrome.tabs.create({
            url: 'https://www.yemeksepeti.com/market',
            active: true
        });
        
        // Popup'ı kapat
        window.close();
    } catch (error) {
        console.error('Tab açma hatası:', error);
        showMessage('Sayfa açılamadı: ' + error.message, 'error');
    }
}

// Malzeme listesini temizle
async function clearIngredients() {
    try {
        await chrome.storage.local.remove(['pendingIngredients', 'addToCartStatus']);
        pendingIngredients = [];
        updateUI();
        showMessage('Malzeme listesi temizlendi', 'success');
    } catch (error) {
        console.error('Temizleme hatası:', error);
        showMessage('Temizleme başarısız: ' + error.message, 'error');
    }
}

// Loading durumunu göster/gizle
function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    const addBtn = document.getElementById('addToCartBtn');
    
    if (show) {
        loadingEl.classList.add('show');
        addBtn.disabled = true;
    } else {
        loadingEl.classList.remove('show');
        addBtn.disabled = false;
    }
}

// Mesaj göster
function showMessage(message, type) {
    const messageEl = document.getElementById('result-message');
    messageEl.textContent = message;
    messageEl.className = `result-message ${type} show`;
    
    // 5 saniye sonra gizle
    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 5000);
}

// Popup açıldığında otomatik olarak güncel bilgileri al
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
        currentTab = tabs[0];
        updateUI();
    }
});