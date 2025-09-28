// content.js - YemekSepeti Market sayfasında çalışan script

console.log('Smart Grocery Content Script yüklendi - YemekSepeti Market');

let isAddingToCart = false;
let addingProgress = [];

// Background script'ten mesaj dinle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script mesaj aldı:', message);

    if (message.action === 'startAddingToCart' && !isAddingToCart) {
        addIngredientsToCart(message.ingredients)
            .then(result => {
                sendResponse({ success: true, result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

// Sayfa yüklendiğinde pending ingredients kontrol et
window.addEventListener('load', async () => {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Sayfanın tam yüklenmesini bekle
    checkForPendingIngredients();
});

// LocalStorage'dan pending ingredients kontrol et
function checkForPendingIngredients() {
    const pendingData = localStorage.getItem('pendingIngredients');
    if (pendingData) {
        try {
            const data = JSON.parse(pendingData);
            if (data.ingredients && data.ingredients.length > 0) {
                console.log('Pending ingredients bulundu:', data.ingredients);

                // 3 saniye bekle ve sepete eklemeye başla
                setTimeout(() => {
                    addIngredientsToCart(data.ingredients);
                    localStorage.removeItem('pendingIngredients'); // Temizle
                }, 3000);
            }
        } catch (error) {
            console.error('Pending ingredients parse hatası:', error);
        }
    }
}

// Ana sepete ekleme fonksiyonu
async function addIngredientsToCart(ingredients) {
    if (isAddingToCart) {
        console.log('Zaten sepete ekleme işlemi devam ediyor...');
        return;
    }

    isAddingToCart = true;
    addingProgress = [];

    try {
        console.log('Sepete ekleme başladı:', ingredients);

        // Progress indicator göster
        showProgressIndicator(ingredients.length);

        for (let i = 0; i < ingredients.length; i++) {
            const ingredient = ingredients[i];
            console.log(`${i + 1}/${ingredients.length} - Aranan: ${ingredient}`);

            try {
                const result = await searchAndAddProduct(ingredient, i + 1, ingredients.length);
                addingProgress.push({
                    ingredient,
                    success: result.success,
                    message: result.message,
                    productName: result.productName
                });

                updateProgressIndicator(i + 1, ingredients.length, ingredient, result.success);

                // İki arama arasında bekle
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error(`${ingredient} için hata:`, error);
                addingProgress.push({
                    ingredient,
                    success: false,
                    message: error.message
                });

                updateProgressIndicator(i + 1, ingredients.length, ingredient, false);
            }
        }

        // Sonuç göster
        showFinalResults();

    } catch (error) {
        console.error('Genel sepete ekleme hatası:', error);
        showError('Sepete ekleme işlemi başarısız: ' + error.message);
    } finally {
        isAddingToCart = false;
        // Progress indicator'ı 5 saniye sonra gizle
        setTimeout(hideProgressIndicator, 5000);
    }
}

// Ürün arama ve sepete ekleme
async function searchAndAddProduct(ingredient, current, total) {
    try {
        // Arama kutusunu bul
        const searchInput = document.querySelector('input[placeholder*="arama"], input[placeholder*="Arama"], input[type="text"][class*="search"], .search-input, #search-input');

        if (!searchInput) {
            throw new Error('Arama kutusu bulunamadı');
        }

        // Önceki aramayı temizle
        searchInput.value = '';
        searchInput.focus();

        // Malzeme adını yaz
        await typeText(searchInput, ingredient);

        // Enter tuşuna bas veya arama butonuna tıkla
        const searchButton = document.querySelector('button[type="submit"], .search-button, button[class*="search"]');
        if (searchButton) {
            searchButton.click();
        } else {
            // Enter tuşuna bas
            searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13 }));
        }
        // Sonuçların yüklenmesini bekle        
        await waitForResults();
        // Ürün listesini kontrol et
        const productList = document.querySelectorAll('.product-list .product-item, .products .product, .product-grid .product-card');
        if (productList.length === 0) {
            throw new Error('Ürün bulunamadı');
        }
        // İlk ürünü sepete ekle
        const firstProduct = productList[0];
        const addToCartButton = firstProduct.querySelector('button.add-to-cart, .add-to-cart-button, button[class*="add-to-cart"]');
        const productNameElem = firstProduct.querySelector('.product-name, .name, .product-title');
        const productName = productNameElem ? productNameElem.innerText.trim() : ingredient;
        if (!addToCartButton) {
            throw new Error('Sepete ekle butonu bulunamadı');
        }
        addToCartButton.click();
        return { success: true, message: 'Sepete eklendi', productName };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// content.js'in eksik fonksiyonlarını ekleyin:

// Text yazma fonksiyonu
async function typeText(element, text) {
    return new Promise(resolve => {
        element.focus();
        element.value = '';
        
        let index = 0;
        const interval = setInterval(() => {
            if (index < text.length) {
                element.value += text[index];
                element.dispatchEvent(new Event('input', { bubbles: true }));
                index++;
            } else {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
}

// Sonuçların yüklenmesini bekleme
async function waitForResults() {
    return new Promise(resolve => {
        let attempts = 0;
        const checkForResults = () => {
            attempts++;
            const products = document.querySelectorAll('.product-list .product-item, .products .product, .product-grid .product-card');
            
            if (products.length > 0 || attempts > 10) {
                resolve();
            } else {
                setTimeout(checkForResults, 1000);
            }
        };
        
        setTimeout(checkForResults, 2000);
    });
}

// Progress indicator gösterme
function showProgressIndicator(total) {
    const progressDiv = document.createElement('div');
    progressDiv.id = 'smart-grocery-progress';
    progressDiv.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: white; 
                    padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); 
                    z-index: 10000; min-width: 300px; border: 2px solid #ff6b35;">
            <h3 style="margin: 0 0 10px 0; color: #ff6b35;">🛍️ Smart Grocery</h3>
            <div id="progress-text">Malzemeler sepete ekleniyor...</div>
            <div style="background: #f0f0f0; height: 8px; border-radius: 4px; margin: 10px 0;">
                <div id="progress-bar" style="background: #ff6b35; height: 8px; border-radius: 4px; width: 0%; transition: width 0.3s;"></div>
            </div>
            <div id="progress-details"></div>
        </div>
    `;
    document.body.appendChild(progressDiv);
}

// Progress indicator güncelleme
function updateProgressIndicator(current, total, ingredient, success) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressDetails = document.getElementById('progress-details');
    
    if (progressBar) {
        progressBar.style.width = `${(current / total) * 100}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${current}/${total} - ${ingredient}`;
    }
    
    if (progressDetails) {
        const statusIcon = success ? '✅' : '❌';
        progressDetails.innerHTML += `<div>${statusIcon} ${ingredient}</div>`;
        progressDetails.scrollTop = progressDetails.scrollHeight;
    }
}

// Progress indicator gizleme
function hideProgressIndicator() {
    const progressDiv = document.getElementById('smart-grocery-progress');
    if (progressDiv) {
        progressDiv.remove();
    }
}

// Sonuçları gösterme
function showFinalResults() {
    const successCount = addingProgress.filter(p => p.success).length;
    const failCount = addingProgress.length - successCount;
    
    alert(`Sepete ekleme tamamlandı!\n✅ Başarılı: ${successCount}\n❌ Başarısız: ${failCount}`);
}

// Hata gösterme
function showError(message) {
    alert('Hata: ' + message);
}