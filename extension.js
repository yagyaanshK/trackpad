// Trackpad: Mac-style trackpad gestures for GNOME Shell.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Trackpad} from './src/trackpad.js';

export default class TrackpadExtension extends Extension {
    enable() {
        this._trackpad = new Trackpad(this.getSettings());
    }

    disable() {
        this._trackpad?.destroy();
        this._trackpad = null;
    }
}
