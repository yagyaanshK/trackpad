// Routes pinch gestures to Launchpad and Show Desktop the way macOS does.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Launchpad} from './launchpad.js';
import {PinchGesture} from './pinchGesture.js';
import {DEAD_ZONE, clamp} from './pinchTracker.js';
import {ShowDesktop} from './showDesktop.js';

const Target = {
    UNDECIDED: 0,
    NONE: 1,
    LAUNCHPAD: 2,
    SHOW_DESKTOP: 3,
    RESTORE_DESKTOP: 4,
};

export class Trackpad {
    constructor(settings) {
        this._settings = settings;
        this._launchpad = new Launchpad();
        this._showDesktop = new ShowDesktop();
        this._target = Target.UNDECIDED;

        this._gesture = new PinchGesture({
            onBegin: fingers => this._onBegin(fingers),
            onUpdate: progress => this._onUpdate(progress),
            onEnd: (progress, velocity, cancelled) => this._onEnd(progress, velocity, cancelled),
        });
    }

    _fingersAccepted(fingers) {
        switch (this._settings.get_string('pinch-fingers')) {
        case 'four':
            return fingers === 4;
        case 'three':
            return fingers === 3;
        default:
            return fingers === 3 || fingers === 4;
        }
    }

    _onBegin(fingers) {
        if (!this._fingersAccepted(fingers))
            return false;
        this._target = Target.UNDECIDED;
        return true;
    }

    /** The first movement past the dead zone picks what the pinch does, as on a Mac. */
    _decide(progress) {
        const pinchIn = progress > 0;

        if (this._showDesktop.shown)
            return pinchIn ? Target.RESTORE_DESKTOP : Target.NONE;

        if (Main.overview.visible)
            return this._launchpad.canBegin() ? Target.LAUNCHPAD : Target.NONE;

        if (pinchIn) {
            return this._settings.get_boolean('launchpad-enabled') && this._launchpad.canBegin()
                ? Target.LAUNCHPAD : Target.NONE;
        }
        return this._settings.get_boolean('show-desktop-enabled') && this._showDesktop.canBegin()
            ? Target.SHOW_DESKTOP : Target.NONE;
    }

    _onUpdate(progress) {
        if (this._target === Target.UNDECIDED) {
            if (Math.abs(progress) < DEAD_ZONE)
                return;
            this._target = this._decide(progress);
            switch (this._target) {
            case Target.LAUNCHPAD:
                this._launchpad.begin();
                break;
            case Target.SHOW_DESKTOP:
            case Target.RESTORE_DESKTOP:
                if (!this._showDesktop.begin())
                    this._target = Target.NONE;
                break;
            }
        }

        switch (this._target) {
        case Target.LAUNCHPAD:
            this._launchpad.update(progress);
            break;
        case Target.SHOW_DESKTOP:
            this._showDesktop.update(clamp(-progress, 0, 1));
            break;
        case Target.RESTORE_DESKTOP:
            this._showDesktop.update(clamp(1 - progress, 0, 1));
            break;
        }
    }

    _onEnd(_progress, velocity, cancelled) {
        switch (this._target) {
        case Target.LAUNCHPAD:
            this._launchpad.end(velocity, cancelled);
            break;
        case Target.SHOW_DESKTOP:
        case Target.RESTORE_DESKTOP:
            // Show Desktop progress runs opposite to pinch progress.
            this._showDesktop.end(-velocity, cancelled);
            break;
        }
        this._target = Target.UNDECIDED;
    }

    destroy() {
        this._gesture.destroy();
        this._gesture = null;
        this._showDesktop.destroy();
        this._showDesktop = null;
        this._launchpad = null;
    }
}
