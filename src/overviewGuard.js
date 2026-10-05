// Works around a GNOME 50 bug: a three-finger swipe that never moves the overview
// (for example swiping down on the desktop) ends with progress 0 while the overview was
// never shown. Overview._gestureEnd() then asks for the HIDDEN -> HIDING transition,
// _changeShownState() throws, and the controls' gesture flag is never cleared.
// The overview binds its swipe handlers at startup, so the fix has to sit in
// _changeShownState(), which the overview calls through `this` and can be replaced.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const HIDDEN = 'HIDDEN';
const HIDING = 'HIDING';

export class OverviewGuard {
    constructor() {
        const overview = Main.overview;
        this._original = overview._changeShownState;
        const original = this._original;

        overview._changeShownState = function (state) {
            // Hiding something that was never shown: let the hide path run its
            // cleanup (it resets the controls), but skip the state change it would reject.
            if (this._shownState === HIDDEN && (state === HIDING || state === HIDDEN))
                return;
            original.call(this, state);
        };
    }

    destroy() {
        if (this._original) {
            Main.overview._changeShownState = this._original;
            this._original = null;
        }
    }
}
