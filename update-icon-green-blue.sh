#!/bin/bash

SOURCE="public/assets/flyp_app_icon.png"
ANDROID_RES="android/app/src/main/res"

# Green gradient colors
GREEN_START="#10B981"
GREEN_END="#059669"

echo "Creating icons with green background + dark blue logo (full fill like screenshot)..."

# Create directories
mkdir -p "$ANDROID_RES/mipmap-ldpi"
mkdir -p "$ANDROID_RES/mipmap-mdpi"
mkdir -p "$ANDROID_RES/mipmap-hdpi"
mkdir -p "$ANDROID_RES/mipmap-xhdpi"
mkdir -p "$ANDROID_RES/mipmap-xxhdpi"
mkdir -p "$ANDROID_RES/mipmap-xxxhdpi"

# Process each density
# ldpi: 36x36 icon, 81x81 canvas
magick -size 81x81 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 36x36 \) -gravity center -composite "$ANDROID_RES/mipmap-ldpi/ic_launcher_foreground.png"
magick -size 81x81 gradient:"$GREEN_START-$GREEN_END" "$ANDROID_RES/mipmap-ldpi/ic_launcher_background.png"
magick -size 36x36 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 36x36 \) -gravity center -composite "$ANDROID_RES/mipmap-ldpi/ic_launcher.png"
magick -size 36x36 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 36x36 \) -gravity center -composite "$ANDROID_RES/mipmap-ldpi/ic_launcher_round.png"
echo "✅ ldpi: 36x36 icon on 81x81 canvas"

# mdpi: 48x48 icon, 108x108 canvas
magick -size 108x108 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 48x48 \) -gravity center -composite "$ANDROID_RES/mipmap-mdpi/ic_launcher_foreground.png"
magick -size 108x108 gradient:"$GREEN_START-$GREEN_END" "$ANDROID_RES/mipmap-mdpi/ic_launcher_background.png"
magick -size 48x48 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 48x48 \) -gravity center -composite "$ANDROID_RES/mipmap-mdpi/ic_launcher.png"
magick -size 48x48 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 48x48 \) -gravity center -composite "$ANDROID_RES/mipmap-mdpi/ic_launcher_round.png"
echo "✅ mdpi: 48x48 icon on 108x108 canvas"

# hdpi: 72x72 icon, 162x162 canvas
magick -size 162x162 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 72x72 \) -gravity center -composite "$ANDROID_RES/mipmap-hdpi/ic_launcher_foreground.png"
magick -size 162x162 gradient:"$GREEN_START-$GREEN_END" "$ANDROID_RES/mipmap-hdpi/ic_launcher_background.png"
magick -size 72x72 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 72x72 \) -gravity center -composite "$ANDROID_RES/mipmap-hdpi/ic_launcher.png"
magick -size 72x72 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 72x72 \) -gravity center -composite "$ANDROID_RES/mipmap-hdpi/ic_launcher_round.png"
echo "✅ hdpi: 72x72 icon on 162x162 canvas"

# xhdpi: 96x96 icon, 216x216 canvas
magick -size 216x216 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 96x96 \) -gravity center -composite "$ANDROID_RES/mipmap-xhdpi/ic_launcher_foreground.png"
magick -size 216x216 gradient:"$GREEN_START-$GREEN_END" "$ANDROID_RES/mipmap-xhdpi/ic_launcher_background.png"
magick -size 96x96 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 96x96 \) -gravity center -composite "$ANDROID_RES/mipmap-xhdpi/ic_launcher.png"
magick -size 96x96 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 96x96 \) -gravity center -composite "$ANDROID_RES/mipmap-xhdpi/ic_launcher_round.png"
echo "✅ xhdpi: 96x96 icon on 216x216 canvas"

# xxhdpi: 144x144 icon, 324x324 canvas
magick -size 324x324 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 144x144 \) -gravity center -composite "$ANDROID_RES/mipmap-xxhdpi/ic_launcher_foreground.png"
magick -size 324x324 gradient:"$GREEN_START-$GREEN_END" "$ANDROID_RES/mipmap-xxhdpi/ic_launcher_background.png"
magick -size 144x144 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 144x144 \) -gravity center -composite "$ANDROID_RES/mipmap-xxhdpi/ic_launcher.png"
magick -size 144x144 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 144x144 \) -gravity center -composite "$ANDROID_RES/mipmap-xxhdpi/ic_launcher_round.png"
echo "✅ xxhdpi: 144x144 icon on 324x324 canvas"

# xxxhdpi: 192x192 icon, 432x432 canvas
magick -size 432x432 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 192x192 \) -gravity center -composite "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher_foreground.png"
magick -size 432x432 gradient:"$GREEN_START-$GREEN_END" "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher_background.png"
magick -size 192x192 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 192x192 \) -gravity center -composite "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher.png"
magick -size 192x192 gradient:"$GREEN_START-$GREEN_END" \( "$SOURCE" -resize 192x192 \) -gravity center -composite "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher_round.png"
echo "✅ xxxhdpi: 192x192 icon on 432x432 canvas"

echo ""
echo "✅ All icons created with green background + dark blue logo!"
echo "   Composition: Green gradient background with dark blue FLYP logo centered"
echo "   Fill: Full icon size (matches screenshot appearance)"

