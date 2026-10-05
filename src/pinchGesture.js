// Feeds Clutter touchpad pinch events into a PinchTracker.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from 'gi://Clutter';

import {PinchTracker} from './pinchTracker.js';

export class PinchGesture {
    constructor(handlers) {
        this._tracker = new PinchTracker(handlers);
        this._handling = false;

        global.stage.connectObject('captured-event::touchpad',
            this._onEvent.bind(this), this);
    }

    get active() {
        return this._tracker.active;
    }

    _onEvent(_actor, event) {
        if (event.type() !== Clutter.EventType.TOUCHPAD_PINCH)
            return Clutter.EVENT_PROPAGATE;

        const time = event.get_time();

        switch (event.get_gesture_phase()) {
        case Clutter.TouchpadGesturePhase.BEGIN:
            this._handling = this._tracker.begin(time,
                event.get_touchpad_gesture_finger_count());
            break;
        case Clutter.TouchpadGesturePhase.UPDATE:
            if (this._handling)
                this._tracker.update(time, event.get_gesture_pinch_scale());
            break;
        case Clutter.TouchpadGesturePhase.END:
        case Clutter.TouchpadGesturePhase.CANCEL:
            if (this._handling) {
                this._tracker.end(time,
                    event.get_gesture_phase() === Clutter.TouchpadGesturePhase.CANCEL);
                this._handling = false;
                return Clutter.EVENT_STOP;
            }
            break;
        }

        return this._handling ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
    }

    /** Ends a gesture in flight as cancelled; used when the extension is disabled mid-gesture. */
    cancel() {
        if (this._handling) {
            this._tracker.end(global.get_current_time(), true);
            this._handling = false;
        }
    }

    destroy() {
        this.cancel();
        global.stage.disconnectObject(this);
    }
}
