# Trackpad

Mac-style trackpad gestures for GNOME Shell, as close to Apple's defaults as the
hardware and GNOME allow.

GNOME already has the two big ones: swipe up with three fingers for Mission Control
(the Activities overview) and swipe sideways between workspaces, both tracked 1:1.
Trackpad adds what is missing and leaves those alone.

## Gestures

| Apple default | Gesture | Status |
| --- | --- | --- |
| Mission Control | Swipe up with three or four fingers | Built into GNOME |
| Swipe between full-screen apps | Swipe left or right with three or four fingers | Built into GNOME, switches workspaces |
| Swipe between pages | Scroll left or right with two fingers | Built into GNOME and apps |
| Launchpad | Pinch with thumb and three fingers | Trackpad: opens the app grid, tracked 1:1, spread closes it |
| Show Desktop | Spread with thumb and three fingers | Trackpad: windows slide to the edges and peek back in; pinch, or focusing a window, brings them back |
| App Exposé | Swipe down with three fingers | Trackpad: GNOME's window picker showing only the current app's windows, tracked 1:1. Off by default, as on macOS |
| Notification Center | Swipe left from the right edge with two fingers | Needs a helper outside the shell, planned |
| Three-finger drag | Drag with three fingers | libinput supports it, GNOME has no switch yet, planned with the helper |
| Look up, Force Click, haptics | Press harder | Needs a pressure-sensing trackpad |
| Smart zoom, Rotate | Two-finger double-tap, rotate | Up to each app; GNOME apps do not support them |

The settings page mirrors Apple's Trackpad panel: Point & Click, Scroll & Zoom and
More Gestures. Rows for GNOME's own options (tracking speed, secondary click, tap to
click, natural scrolling) change the GNOME settings in place.

## Install

Until it is on extensions.gnome.org:

```sh
git clone https://github.com/yagyaanshK/trackpad.git
cd trackpad
./install.sh
```

Log out and in, then enable **Trackpad** in the Extensions app.

Supported: GNOME Shell 50 on Wayland. Other versions will follow once this one is stable.

## How it works

App Exposé watches three-finger swipes in the stage's capture phase, ahead of GNOME's
own handler, and claims a downward one once it has moved 10 px (GNOME decides at 16).
It then drives the overview to the window picker the same way, with the shell's
`_isOverviewWindow` checks wrapped so only the focused app's windows get previews.

Pinch events from libinput reach the shell as Clutter touchpad gestures with a
scale factor. Trackpad converts that into a progress value and, for Launchpad, feeds
it to the overview's own gesture entry points, so the app grid opens with the same
interactive animation GNOME uses for the three-finger swipe. Show Desktop moves the
window actors with translations and settles them with the same easing and velocity
rules as GNOME's swipe tracker. The arithmetic lives in `src/pinchTracker.js` and
has node tests.

## GNOME quirks handled

- GNOME 50 logs "Invalid overview shown transition from HIDDEN to HIDING" whenever a
  three-finger swipe starts on the desktop but never moves the overview (swiping down,
  for example) and leaves its gesture flag set. Trackpad guards that path while enabled.

## License

GPL-3.0-or-later. Contributions are accepted under the [CLA](CLA.md), which lets
the project also be licensed commercially to parties who cannot use the GPL.
