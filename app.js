// ===== App State =====
let currentQuoteIndex = 0;
let currentMode = 'daily'; // 'daily', 'browse', 'favorites'
let favorites = [];
let touchStartX = 0;
let touchEndX = 0;

// ===== DOM Elements =====
const quoteText = document.getElementById('quoteText');
const quoteAuthor = document.getElementById('quoteAuthor');
const quoteCard = document.getElementById('quoteCard');
const dateDisplay = document.getElementById('dateDisplay');
const menuBtn = document.getElementById('menuBtn');
const sideMenu = document.getElementById('sideMenu');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const overlay = document.getElementById('overlay');
const favoriteBtn = document.getElementById('favoriteBtn');
const shareBtn = document.getElementById('shareBtn');
const newQuoteBtn = document.getElementById('newQuoteBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const todayBtn = document.getElementById('todayBtn');
const favoritesBtn = document.getElementById('favoritesBtn');
const favCount = document.getElementById('favCount');

// ===== Initialize App =====
function init() {
    loadFavorites();
    updateDate();
    loadDailyQuote();
    attachEventListeners();
    updateFavoriteCount();
}

// ===== Date Functions =====
function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    dateDisplay.textContent = now.toLocaleDateString('en-US', options);
}

function getDayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

// ===== Quote Display Functions =====
function displayQuote(index) {
    const quote = quotes[index];
    
    // Fade out animation
    quoteCard.classList.add('fade-out');
    
    setTimeout(() => {
        quoteText.textContent = quote.text;
        quoteAuthor.textContent = quote.author;
        
        // Update favorite button state
        updateFavoriteButton(index);
        
        // Remove fade-out and trigger fade-in
        quoteCard.classList.remove('fade-out');
        
        // Force reflow to restart animation
        void quoteCard.offsetWidth;
    }, 300);
}

function loadDailyQuote() {
    currentMode = 'daily';
    const dayOfYear = getDayOfYear();
    currentQuoteIndex = dayOfYear % quotes.length;
    displayQuote(currentQuoteIndex);
}

function showNextQuote() {
    currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
    displayQuote(currentQuoteIndex);
}

function showPrevQuote() {
    currentQuoteIndex = (currentQuoteIndex - 1 + quotes.length) % quotes.length;
    displayQuote(currentQuoteIndex);
}

function showRandomQuote() {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    currentQuoteIndex = randomIndex;
    currentMode = 'browse';
    displayQuote(currentQuoteIndex);
}

// ===== Favorites Functions =====
function loadFavorites() {
    const stored = localStorage.getItem('favoriteQuotes');
    favorites = stored ? JSON.parse(stored) : [];
}

function saveFavorites() {
    localStorage.setItem('favoriteQuotes', JSON.stringify(favorites));
}

function toggleFavorite() {
    const currentQuote = quotes[currentQuoteIndex];
    const index = favorites.findIndex(fav => fav.text === currentQuote.text);
    
    if (index > -1) {
        // Remove from favorites
        favorites.splice(index, 1);
    } else {
        // Add to favorites
        favorites.push(currentQuote);
    }
    
    saveFavorites();
    updateFavoriteButton(currentQuoteIndex);
    updateFavoriteCount();
}

function updateFavoriteButton(quoteIndex) {
    const currentQuote = quotes[quoteIndex];
    const isFavorite = favorites.some(fav => fav.text === currentQuote.text);
    
    if (isFavorite) {
        favoriteBtn.classList.add('active');
        favoriteBtn.querySelector('svg').innerHTML = `
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor" stroke="currentColor"></path>
        `;
    } else {
        favoriteBtn.classList.remove('active');
        favoriteBtn.querySelector('svg').innerHTML = `
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor"></path>
        `;
    }
}

function updateFavoriteCount() {
    favCount.textContent = favorites.length;
}

function showFavorites() {
    if (favorites.length === 0) {
        alert('No favorites yet! Tap the heart icon to save quotes you love.');
        return;
    }
    
    currentMode = 'favorites';
    // Find the first favorite in the main quotes array
    const firstFav = favorites[0];
    currentQuoteIndex = quotes.findIndex(q => q.text === firstFav.text);
    displayQuote(currentQuoteIndex);
    closeMenu();
}

// ===== Share Function =====
async function shareQuote() {
    const currentQuote = quotes[currentQuoteIndex];
    const shareText = `"${currentQuote.text}" — ${currentQuote.author}`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Daily Quote',
                text: shareText
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                copyToClipboard(shareText);
            }
        }
    } else {
        copyToClipboard(shareText);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Quote copied to clipboard!');
        });
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Quote copied to clipboard!');
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(44, 44, 44, 0.95);
        color: white;
        padding: 12px 24px;
        border-radius: 24px;
        font-size: 14px;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 2000);
}

// ===== Menu Functions =====
function openMenu() {
    sideMenu.classList.add('active');
    overlay.classList.add('active');
}

function closeMenu() {
    sideMenu.classList.remove('active');
    overlay.classList.remove('active');
}

// ===== Touch/Swipe Functions =====
function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swipe left - next quote
            showNextQuote();
        } else {
            // Swipe right - previous quote
            showPrevQuote();
        }
    }
}

// ===== Event Listeners =====
function attachEventListeners() {
    // Menu
    menuBtn.addEventListener('click', openMenu);
    closeMenuBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
    
    // Navigation
    prevBtn.addEventListener('click', showPrevQuote);
    nextBtn.addEventListener('click', showNextQuote);
    
    // Actions
    favoriteBtn.addEventListener('click', toggleFavorite);
    shareBtn.addEventListener('click', shareQuote);
    newQuoteBtn.addEventListener('click', showRandomQuote);
    
    // Menu items
    todayBtn.addEventListener('click', () => {
        loadDailyQuote();
        closeMenu();
    });
    
    favoritesBtn.addEventListener('click', showFavorites);
    
    // Touch events for swipe
    quoteCard.addEventListener('touchstart', handleTouchStart, { passive: true });
    quoteCard.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') showPrevQuote();
        if (e.key === 'ArrowRight') showNextQuote();
        if (e.key === 'Escape') closeMenu();
    });
}

// ===== Service Worker Registration =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// ===== Initialize on Load =====
document.addEventListener('DOMContentLoaded', init);