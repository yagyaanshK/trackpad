# Contributing

Trackpad is a GNOME Shell extension written in plain JavaScript modules. No build
step, no dependencies.

## Setup

```sh
git clone https://github.com/yagyaanshK/trackpad.git
cd trackpad
./install.sh        # copies into ~/.local/share/gnome-shell/extensions
```

Log out and back in once so GNOME Shell picks the folder up, then enable the
extension with the Extensions app or `gnome-extensions enable trackpad@yagyaanshK.github.com`.
After that, re-running `install.sh` and disabling/enabling the extension is enough
for most changes; prefs changes need the Extensions app closed and reopened.

## Tests

The gesture arithmetic in `src/pinchTracker.js` has no GNOME dependency and is
tested with node:

```sh
node --test
```

Everything that touches the shell is checked in a headless shell
(`dbus-run-session -- gnome-shell --headless --wayland --no-x11 --virtual-monitor 1600x1000 --unsafe-mode`)
by driving the gesture classes through `org.gnome.Shell.Eval`, and then by hand on a
real touchpad. Say in your pull request which of the two you did.

## Rules

- Match macOS behaviour first, GNOME conventions second, personal taste last. Cite
  the Apple behaviour you are replicating in the pull request.
- Keep GNOME's own gestures untouched. We add what is missing; we do not replace
  Mission Control or workspace swipes.
- Plain descriptive commit messages. No "Co-Authored-By" trailers, no "generated
  with" lines, no tool attribution of any kind in commits, pull requests or code.
- Contributions need the [CLA](CLA.md): comment "I have read and agree to the CLA"
  on your first pull request.
