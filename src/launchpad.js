// Launchpad: a pinch drives GNOME's own overview straight to the app grid, tracked 1:1.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {ControlsState} from 'resource:///org/gnome/shell/ui/overviewControls.js';

import {animationDuration, clamp, decideEnd} from './pinchTracker.js';

const SPAN = ControlsState.APP_GRID - ControlsState.HIDDEN;

export class Launchpad {
    constructor() {
        this._tracker = null;
        this._start = ControlsState.HIDDEN;
        this._cancel = ControlsState.HIDDEN;
        this._value = ControlsState.HIDDEN;
        this._shown = false;
    }

    get active() {
        return this._tracker !== null;
    }

    canBegin() {
        if (Main.overview.isDummy)
            return false;
        return Main.actionMode === Shell.ActionMode.NORMAL ||
            Main.actionMode === Shell.ActionMode.OVERVIEW;
    }

    begin() {
        // The overview expects a SwipeTracker; it only ever calls confirmSwipe() on it.
        this._tracker = {
            confirmSwipe: (_distance, _points, progress, cancelProgress) => {
                this._start = progress;
                this._cancel = cancelProgress;
            },
        };
        this._shown = Main.overview.visible;
        Main.overview._gestureBegin(this._tracker);
        this._value = this._start;
    }

    /** progress: +1 is a full pinch in, -1 a full spread. */
    update(progress) {
        if (!this._tracker)
            return;
        this._value = clamp(this._start + progress * SPAN,
            ControlsState.HIDDEN, ControlsState.APP_GRID);
        if (this._value > ControlsState.HIDDEN)
            this._shown = true;
        Main.overview._gestureUpdate(this._tracker, this._value);
    }

    end(velocity, cancelled) {
        if (!this._tracker)
            return;

        const v = velocity * SPAN;
        // Launchpad goes straight between the desktop and the app grid; the window
        // picker is only a resting point when the gesture started there.
        const points = [ControlsState.HIDDEN, ControlsState.APP_GRID];
        if (this._start === ControlsState.WINDOW_PICKER)
            points.push(ControlsState.WINDOW_PICKER);
        const target = cancelled
            ? this._cancel
            : decideEnd({progress: this._value, velocity: v, points});
        const duration = animationDuration(this._value, target, v);

        if (!this._shown && target === ControlsState.HIDDEN) {
            // The overview never appeared: unwind what gestureBegin() prepared
            // without touching the overview's shown-state machine.
            Main.overview._overview.controls.gestureEnd(target, duration, () => {});
        } else {
            Main.overview._gestureEnd(this._tracker, duration, target);
        }

        this._tracker = null;
    }
}
