# Extension Icons

This folder should contain the following icon files:

- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels  
- `icon128.png` - 128x128 pixels

## Generating Icons

You can generate these from the `icon.svg` file using any image editor or online tool.

### Using ImageMagick (command line):

```bash
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

### Using online tools:

1. Go to https://convertio.co/svg-png/
2. Upload `icon.svg`
3. Download and resize to required dimensions

## Temporary Solution

For development, you can use any placeholder PNG icons. The extension will work without icons, just won't display them in the toolbar.
