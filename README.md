# Timer

A sleek, iOS-style countdown timer web application that can be installed as a Progressive Web App (PWA) on iOS devices.

## Features

- ⏱️ **Countdown Timer**: Set custom minutes and seconds
- 🔄 **Circular Progress Bar**: Visual iOS-style analog display
- 📱 **iOS PWA Support**: Install as an app on your iOS home screen
- 🔒 **Screen Wake Lock**: Prevents screen from sleeping while timer is running
- 🎨 **Sleek Design**: Clean, modern interface inspired by iOS Timer app
- 📱 **Responsive**: Works perfectly on mobile and desktop

## Installation on iOS

1. Open Safari on your iOS device
2. Navigate to the hosted URL where this app is deployed
3. Tap the Share button (square with arrow pointing up)
4. Scroll down and tap "Add to Home Screen"
5. Name it "Timer" and tap "Add"
6. The app icon will appear on your home screen

## Usage

1. **Set Time**: Use the Minutes and Seconds inputs to set your desired countdown time
2. **Start**: Tap the orange "Start" button to begin the countdown
3. **Pause**: Tap "Pause" to temporarily stop the timer
4. **Resume**: Tap "Start" again to resume from where you paused
5. **Reset**: Tap "Reset" to clear the timer and start over

## Deployment

This is a static HTML application. To deploy:

1. Upload all files to any web server or static hosting service:
   - `index.html`
   - `manifest.json`
   - `icon.png`
   - `icon.svg` (optional)

2. Popular hosting options:
   - GitHub Pages
   - Netlify
   - Vercel
   - Any HTTP server

## Technical Details

- **No dependencies**: Pure HTML, CSS, and JavaScript
- **Wake Lock API**: Keeps screen active during countdown
- **PWA Manifest**: Enables installation on iOS and Android
- **Responsive Design**: Adapts to different screen sizes

## Browser Support

- ✅ Safari (iOS/macOS)
- ✅ Chrome
- ✅ Firefox
- ✅ Edge

Note: Wake Lock API support varies by browser and platform.