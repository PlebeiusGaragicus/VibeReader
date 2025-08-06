#!/bin/bash

# Simple Build Number Incrementer for VibeReader
# This script increments the build number and injects it into index.html

BUILD_FILE="build.json"
HTML_FILE="index.html"

echo "🔧 Incrementing build number..."

# Read current build number
if [ -f "$BUILD_FILE" ]; then
    CURRENT_BUILD=$(cat $BUILD_FILE | grep -o '"build": [0-9]*' | grep -o '[0-9]*')
else
    CURRENT_BUILD=0
fi

# Increment build number
NEW_BUILD=$((CURRENT_BUILD + 1))

# Update build.json
echo "{
  \"build\": $NEW_BUILD
}" > $BUILD_FILE

# Generate timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Create backup of original HTML if it doesn't exist
if [ ! -f "index.html.template" ]; then
    cp index.html index.html.template
fi

# Inject build number into HTML (replace existing or add new)
if grep -q "<!-- BUILD:" index.html; then
    # Replace existing build comment
    sed -i '' "s/<!-- BUILD:.*-->/<!-- BUILD: $NEW_BUILD | $TIMESTAMP -->/" index.html
else
    # Add build comment after <title> tag
    sed -i '' "s/<title>\(.*\)<\/title>/<title>\1<\/title>\n    <!-- BUILD: $NEW_BUILD | $TIMESTAMP -->/" index.html
fi

# Also add as a meta tag for cache busting
if grep -q '<meta name="build"' index.html; then
    # Replace existing build meta tag
    sed -i '' "s/<meta name=\"build\" content=\"[^\"]*\">/<meta name=\"build\" content=\"$NEW_BUILD\">/" index.html
else
    # Add build meta tag after viewport meta
    sed -i '' "s/<meta name=\"viewport\"[^>]*>/<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <meta name=\"build\" content=\"$NEW_BUILD\">/" index.html
fi

echo "✅ Build incremented to: $NEW_BUILD"
echo "📅 Timestamp: $TIMESTAMP"
echo "🌐 Build info added to index.html"

# Optional: Add cache-busting query parameters to CSS and JS files
echo "🔄 Adding cache-busting parameters..."

# Reset to template first
cp index.html.template temp.html

# Add build info
sed -i '' "s/<title>\(.*\)<\/title>/<title>\1<\/title>\n    <!-- BUILD: $NEW_BUILD | $TIMESTAMP -->/" temp.html
sed -i '' "s/<meta name=\"viewport\"[^>]*>/<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <meta name=\"build\" content=\"$NEW_BUILD\">/" temp.html

# Add cache-busting to CSS and JS files
sed -i '' "s/href=\"css\/main\.css\"/href=\"css\/main.css?v=$NEW_BUILD\"/g" temp.html
sed -i '' "s/href=\"css\/themes\/default\.css\"/href=\"css\/themes\/default.css?v=$NEW_BUILD\"/g" temp.html
sed -i '' "s/src=\"js\/\([^\"]*\)\.js\"/src=\"js\/\1.js?v=$NEW_BUILD\"/g" temp.html

# Replace the original
mv temp.html index.html

echo "🚀 Ready to test! Build $NEW_BUILD"
echo ""
echo "💡 Safari Cache-Busting Tips:"
echo "   1. Hard refresh: Cmd+Shift+R"
echo "   2. Developer menu: Develop > Empty Caches"
echo "   3. Private browsing window"
echo "   4. Check build number in page source"
