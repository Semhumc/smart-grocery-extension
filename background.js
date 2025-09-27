// Extension yüklendiğinde
chrome.runtime.onInstalled.addListener(() => {
  console.log('Smart Grocery Extension yüklendi!');
});

// Web uygulamasından mesaj dinle
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('Mesaj alındı:', message);
  
  if (message.action === 'addIngredientsToCart') {
    handleAddIngredientsToCart(message.ingredients)
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Popup'tan mesaj dinle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'addIngredientsToCart') {
    handleAddIngredientsToCart(message.ingredients)
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'getPendingIngredients') {
    chrome.storage.local.get(['pendingIngredients'], (result) => {
      sendResponse({ ingredients: result.pendingIngredients || [] });
    });
    return true;
  }
});

// Malzemeleri sepete ekleme
async function handleAddIngredientsToCart(ingredients) {
  try {
    // Malzemeleri storage'a kaydet
    await chrome.storage.local.set({ 
      pendingIngredients: ingredients,
      addToCartStatus: 'pending'
    });
    
    // YemekSepeti sayfasını kontrol et
    const tabs = await chrome.tabs.query({ url: '*://www.yemeksepeti.com/market*' });
    
    if (tabs.length > 0) {
      // Mevcut tab'ı aktifleştir
      await chrome.tabs.update(tabs[0].id, { active: true });
      
      // Content script'e gönder
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'startAddingToCart',
        ingredients: ingredients
      });
    } else {
      // Yeni tab aç
      const newTab = await chrome.tabs.create({
        url: 'https://www.yemeksepeti.com/market',
        active: true
      });
      
      // Tab yüklenene kadar bekle
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              action: 'startAddingToCart',
              ingredients: ingredients
            });
          }, 3000);
        }
      });
    }
    
    return { message: 'Malzemeler sepete ekleniyor...', count: ingredients.length };
    
  } catch (error) {
    console.error('Sepete ekleme hatası:', error);
    throw error;
  }
}

// Tab güncellemelerini dinle
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('yemeksepeti.com/market')) {
    const result = await chrome.storage.local.get(['pendingIngredients', 'addToCartStatus']);
    
    if (result.pendingIngredients && result.pendingIngredients.length > 0 && result.addToCartStatus === 'pending') {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          action: 'startAddingToCart',
          ingredients: result.pendingIngredients
        });
      }, 3000);
    }
  }
});