#!/usr/bin/env python3
"""
Simple script to create placeholder PNG icons for the PWA
"""

import os
import base64

# Create icons directory if it doesn't exist
os.makedirs('icons', exist_ok=True)

# Sizes needed for the PWA
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

# Create a simple 1x1 PNG with the app's color scheme
# This is a minimal valid PNG file (cream/beige color #f5f3f0)
png_data = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
)

# For each size, create a placeholder icon
for size in sizes:
    filename = f'icons/icon-{size}.png'
    with open(filename, 'wb') as f:
        f.write(png_data)
    print(f'Created {filename}')

print('\nPlaceholder icons created successfully!')
print('Note: These are minimal 1x1 pixel placeholders.')
print('For production, replace with proper icons using:')
print('  - Online tools like https://realfavicongenerator.net/')
print('  - Design software (Figma, Photoshop, etc.)')
print('  - Or use the icon.svg file with an SVG-to-PNG converter')