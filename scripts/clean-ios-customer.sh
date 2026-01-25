#!/bin/bash

# Clean iOS Customer App Build
# This script cleans Xcode derived data and build artifacts

echo "🧹 Cleaning iOS Customer App build artifacts..."

cd "$(dirname "$0")/.."

# Clean Xcode derived data for ios-customer
DERIVED_DATA="$HOME/Library/Developer/Xcode/DerivedData"
if [ -d "$DERIVED_DATA" ]; then
    echo "📦 Cleaning Xcode Derived Data..."
    find "$DERIVED_DATA" -name "*App-*" -type d -exec rm -rf {} + 2>/dev/null || true
    echo "   ✓ Cleaned derived data"
fi

# Clean build folder in ios-customer
if [ -d "ios-customer/App/build" ]; then
    echo "📦 Cleaning build folder..."
    rm -rf ios-customer/App/build
    echo "   ✓ Cleaned build folder"
fi

# Clean module cache
if [ -d "ios-customer/App/App.xcworkspace/xcuserdata" ]; then
    echo "📦 Cleaning workspace user data..."
    rm -rf ios-customer/App/App.xcworkspace/xcuserdata
    echo "   ✓ Cleaned workspace user data"
fi

echo ""
echo "✅ Clean complete!"
echo ""
echo "Next steps:"
echo "1. Open Xcode: open ios-customer/App/App.xcworkspace"
echo "2. Product > Clean Build Folder (Shift+Cmd+K)"
echo "3. Product > Build (Cmd+B)"
