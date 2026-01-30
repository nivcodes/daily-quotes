# Daily Quotes - Inspirational Quote App

A beautiful, minimalist Progressive Web App (PWA) that delivers daily inspirational quotes.

## Features

✨ **Daily Quote** - Get a new inspirational quote every day
📱 **Mobile-First Design** - Optimized for mobile devices with elegant, classy UI
💾 **Offline Support** - Works without internet after first load
❤️ **Favorites** - Save your favorite quotes
🔀 **Browse & Random** - Explore 120+ curated quotes
📤 **Share** - Share quotes with friends
👆 **Swipe Navigation** - Swipe left/right to navigate quotes
⌨️ **Keyboard Support** - Use arrow keys to navigate

## Installation

### On Mobile (iOS/Android)

1. Open the app in your mobile browser
2. Tap the browser menu (⋮ or share icon)
3. Select "Add to Home Screen"
4. The app icon will appear on your home screen
5. Open it like any other app!

### On Desktop

1. Open the app in Chrome, Edge, or Safari
2. Look for the install icon in the address bar
3. Click "Install" to add it to your applications

## Local Development

Simply open `index.html` in a web browser, or use a local server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## Project Structure

```
daily-quotes-app/
├── index.html          # Main HTML structure
├── styles.css          # Elegant, minimal styling
├── app.js              # App logic & functionality
├── quotes.js           # Quote database (120+ quotes)
├── manifest.json       # PWA configuration
├── service-worker.js   # Offline functionality
├── icons/              # App icons
│   ├── icon.svg        # Source SVG icon
│   └── icon-*.png      # PNG icons (various sizes)
└── README.md           # This file
```

## Technologies Used

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS Grid/Flexbox
- **Vanilla JavaScript** - No frameworks needed
- **PWA APIs** - Service Workers, Web App Manifest
- **Local Storage** - For favorites persistence

## Customization

### Adding More Quotes

Edit `quotes.js` and add quotes in this format:

```javascript
{
    text: "Your quote here",
    author: "Author Name"
}
```

### Changing Colors

Edit the CSS variables in `styles.css`:

```css
:root {
    --color-bg: #f5f3f0;
    --color-accent: #c9a961;
    /* ... more colors */
}
```

### Custom Icons

Replace the placeholder icons in the `icons/` directory with your own:
- Use the `icon.svg` as a template
- Generate PNGs at sizes: 72, 96, 128, 144, 152, 192, 384, 512
- Tools: [RealFaviconGenerator](https://realfavicongenerator.net/)

## Browser Support

- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Safari (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Samsung Internet
- ✅ Opera

## Future Enhancements

- [ ] Push notifications for daily quotes
- [ ] Quote categories/tags
- [ ] Dark mode toggle
- [ ] Quote search functionality
- [ ] Social sharing with custom images
- [ ] Multiple language support
- [ ] Convert to React Native for native apps

## License

Free to use and modify for personal and commercial projects.

## Credits

Quotes compiled from various public domain sources and inspirational speakers.

---

**Enjoy your daily dose of inspiration! 🌟**