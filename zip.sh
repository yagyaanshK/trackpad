#!/bin/bash
# Builds the zip that extensions.gnome.org and 'gnome-extensions install' accept.
set -e
cd "$(dirname "$0")"
UUID="trackpad@yagyaanshK.github.com"
rm -f "$UUID.zip"
zip -r "$UUID.zip" extension.js prefs.js metadata.json LICENSE src schemas \
    -x 'schemas/gschemas.compiled'
echo "Wrote $UUID.zip"
