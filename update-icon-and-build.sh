#!/bin/bash

# Script to update Android app icon and build .aab file
# This script updates the icon and builds the Android App Bundle

set -e

echo "🚀 Starting Android build process..."

# Step 1: Build web assets
echo "📦 Building web assets..."
npm run build

# Step 2: Sync Capacitor
echo "🔄 Syncing Capacitor..."
npx cap sync android

# Step 3: Check Java version
echo "☕ Checking Java version..."
JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | sed '/^1\./s///' | cut -d'.' -f1)
echo "Current Java version: $JAVA_VERSION"

if [ "$JAVA_VERSION" -lt 21 ]; then
    echo "⚠️  Warning: Capacitor Android requires Java 21, but you have Java $JAVA_VERSION"
    echo "💡 Installing Java 21..."
    
    # Try to install Java 21 via Homebrew
    if command -v brew &> /dev/null; then
        brew install openjdk@21
        export JAVA_HOME=$(/usr/libexec/java_home -v 21)
        echo "✅ Java 21 installed and set"
    else
        echo "❌ Please install Java 21 manually:"
        echo "   brew install openjdk@21"
        echo "   export JAVA_HOME=\$(/usr/libexec/java_home -v 21)"
        exit 1
    fi
fi

# Step 4: Update icon (manual conversion)
echo "🎨 Updating app icon..."
ICON_SOURCE="public/assets/flyp_icon.jpg"
ICON_DIR="android/app/src/main/res"

if [ -f "$ICON_SOURCE" ]; then
    echo "   Found icon: $ICON_SOURCE"
    
    # Check if ImageMagick is available
    if command -v convert &> /dev/null; then
        echo "   Using ImageMagick to generate icons..."
        
        # Generate icons for different densities
        # mdpi: 48x48
        convert "$ICON_SOURCE" -resize 48x48 "$ICON_DIR/mipmap-mdpi/ic_launcher.png"
        convert "$ICON_SOURCE" -resize 48x48 "$ICON_DIR/mipmap-mdpi/ic_launcher_round.png"
        
        # hdpi: 72x72
        convert "$ICON_SOURCE" -resize 72x72 "$ICON_DIR/mipmap-hdpi/ic_launcher.png"
        convert "$ICON_SOURCE" -resize 72x72 "$ICON_DIR/mipmap-hdpi/ic_launcher_round.png"
        
        # xhdpi: 96x96
        convert "$ICON_SOURCE" -resize 96x96 "$ICON_DIR/mipmap-xhdpi/ic_launcher.png"
        convert "$ICON_SOURCE" -resize 96x96 "$ICON_DIR/mipmap-xhdpi/ic_launcher_round.png"
        
        # xxhdpi: 144x144
        convert "$ICON_SOURCE" -resize 144x144 "$ICON_DIR/mipmap-xxhdpi/ic_launcher.png"
        convert "$ICON_SOURCE" -resize 144x144 "$ICON_DIR/mipmap-xxhdpi/ic_launcher_round.png"
        
        # xxxhdpi: 192x192
        convert "$ICON_SOURCE" -resize 192x192 "$ICON_DIR/mipmap-xxxhdpi/ic_launcher.png"
        convert "$ICON_SOURCE" -resize 192x192 "$ICON_DIR/mipmap-xxxhdpi/ic_launcher_round.png"
        
        # ldpi: 36x36
        convert "$ICON_SOURCE" -resize 36x36 "$ICON_DIR/mipmap-ldpi/ic_launcher.png"
        convert "$ICON_SOURCE" -resize 36x36 "$ICON_DIR/mipmap-ldpi/ic_launcher_round.png"
        
        echo "   ✅ Icons generated successfully"
    elif command -v sips &> /dev/null; then
        echo "   Using sips (macOS) to generate icons..."
        
        # Generate icons for different densities
        sips -z 48 48 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-mdpi/ic_launcher.png"
        sips -z 48 48 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-mdpi/ic_launcher_round.png"
        
        sips -z 72 72 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-hdpi/ic_launcher.png"
        sips -z 72 72 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-hdpi/ic_launcher_round.png"
        
        sips -z 96 96 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-xhdpi/ic_launcher.png"
        sips -z 96 96 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-xhdpi/ic_launcher_round.png"
        
        sips -z 144 144 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-xxhdpi/ic_launcher.png"
        sips -z 144 144 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-xxhdpi/ic_launcher_round.png"
        
        sips -z 192 192 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-xxxhdpi/ic_launcher.png"
        sips -z 192 192 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-xxxhdpi/ic_launcher_round.png"
        
        sips -z 36 36 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-ldpi/ic_launcher.png"
        sips -z 36 36 "$ICON_SOURCE" --out "$ICON_DIR/mipmap-ldpi/ic_launcher_round.png"
        
        echo "   ✅ Icons generated successfully"
    else
        echo "   ⚠️  No image conversion tool found. Please install ImageMagick or use Android Studio to update icons."
        echo "   Icon update skipped. Building with existing icons..."
    fi
else
    echo "   ⚠️  Icon file not found: $ICON_SOURCE"
    echo "   Building with existing icons..."
fi

# Step 5: Build .aab file
echo "🔨 Building Android App Bundle (.aab)..."
cd android
./gradlew bundleRelease

# Step 6: Show result
AAB_PATH="app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB_PATH" ]; then
    AAB_SIZE=$(du -h "$AAB_PATH" | cut -f1)
    echo ""
    echo "✅ Build successful!"
    echo "📦 .aab file location: $AAB_PATH"
    echo "📊 File size: $AAB_SIZE"
    echo ""
    echo "📤 You can now upload this file to Google Play Console"
else
    echo "❌ Build failed - .aab file not found"
    exit 1
fi

