# VS Code Extension Icon Requirements

## Icon Specifications

### Main Extension Icon
- **File**: `icon.png`
- **Size**: 128x128 pixels
- **Format**: PNG with transparency
- **Color Scheme**: Should work on both light and dark backgrounds
- **Style**: Flat design, minimal shadows

### Recommended Icon Set
1. **icon.png** - Main extension icon (128x128)
2. **icon@2x.png** - Retina display version (256x256)
3. **icon-light.png** - Light theme variant (optional)
4. **icon-dark.png** - Dark theme variant (optional)

## Gallery Banner
- **Recommended Size**: 1280x640 pixels
- **Format**: PNG or JPG
- **Color**: #2C3E50 (dark blue-gray)
- **Content**: Should include:
  - Extension name
  - Tagline
  - Key features icons
  - Cursor/Template visual elements

## Design Suggestions

### Icon Concept Ideas
1. **Template Symbol**: Document with placeholder brackets {{}}
2. **Cursor Integration**: Cursor/caret with template overlay
3. **AI/Smart**: Brain or lightbulb with template elements
4. **Code Generation**: Code brackets <> with template symbols

### Color Palette
- Primary: #2C3E50 (Dark Blue-Gray)
- Secondary: #3498DB (Bright Blue)
- Accent: #E74C3C (Red for emphasis)
- Success: #2ECC71 (Green)
- Background: #ECF0F1 (Light Gray)

## Creating Icons

### Using Free Tools
1. **Figma** (Free web-based design tool)
   - Template: https://www.figma.com/community/file/876509330581995404
   
2. **Canva** (Free with templates)
   - VS Code icon templates available
   
3. **icons8** (Free icon generator)
   - https://icons8.com/icons

### Using Command Line (ImageMagick)
```bash
# Create a simple placeholder icon
convert -size 128x128 xc:transparent \
  -fill '#2C3E50' \
  -draw 'rectangle 20,20 108,108' \
  -fill white \
  -font Arial -pointsize 60 \
  -gravity center -annotate +0+0 'CP' \
  icon.png

# Create different sizes
convert icon.png -resize 256x256 icon@2x.png
convert icon.png -resize 64x64 icon-small.png
```

### Using Node.js Script
```javascript
// generate-icon.js
const { createCanvas } = require('canvas');
const fs = require('fs');

function generateIcon(size = 128) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#2C3E50';
  ctx.roundRect(10, 10, size - 20, size - 20, 20);
  ctx.fill();
  
  // Template brackets
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${size * 0.4}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('{{}}', size / 2, size / 2);
  
  return canvas.toBuffer('image/png');
}

// Generate icons
fs.writeFileSync('icon.png', generateIcon(128));
fs.writeFileSync('icon@2x.png', generateIcon(256));
```

## Icon Checklist
- [ ] icon.png (128x128) created
- [ ] icon@2x.png (256x256) created
- [ ] Icon works on light backgrounds
- [ ] Icon works on dark backgrounds
- [ ] Icon is recognizable at small sizes
- [ ] Gallery banner created
- [ ] All images optimized for size

## Resources
- [VS Code Extension Icon Guidelines](https://code.visualstudio.com/api/references/extension-manifest#icon)
- [VS Code Marketplace Presentation Tips](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#marketplace-presentation-tips)
- [Free Icon Resources](https://github.com/vscode-icons/vscode-icons)