// Feeds Clutter touchpad swipe events into a SwipeClaimer, ahead of GNOME's own handler.
// GNOME's TouchpadSwipeGesture listens on the stage's bubble-phase 'event' signal, so a
// 'captured-event' handler sees every swipe first and can keep the ones it claims.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import {SwipeClaimer} from './swipeClaimer.js';

const PHASES = new Map([
    [Clutter.TouchpadGesturePhase.BEGIN, 'begin'],
    [Clutter.TouchpadGesturePhase.UPDATE, 'update'],
    [Clutter.TouchpadGesturePhase.END, 'end'],
    [Clutter.TouchpadGesturePhase.CANCEL, 'cancel'],
]);

export class SwipeGesture {
    constructor(handlers) {
        this._claimer = new SwipeClaimer(handlers);
        this._touchpad = new Gio.Settings({schema_id: 'org.gnome.desktop.peripherals.touchpad'});

        global.stage.connectObject('captured-event::touchpad',
            this._onEvent.bind(this), this);
    }

    get claimer() {
        return this._claimer;
    }

    _onEvent(_actor, event) {
        if (event.type() !== Clutter.EventType.TOUCHPAD_SWIPE)
            return Clutter.EVENT_PROPAGATE;

        const [dx, dy] = event.get_gesture_motion_delta_unaccelerated();
        const consumed = this._claimer.feed({
            phase: PHASES.get(event.get_gesture_phase()),
            fingers: event.get_touchpad_gesture_finger_count(),
            dx,
            dy,
            natural: this._touchpad.get_boolean('natural-scroll'),
            time: event.get_time(),
        });
        return consumed ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        if (this._claimer.claimed)
            this._claimer.feed({phase: 'cancel', fingers: 0, dx: 0, dy: 0, natural: false, time: 0});
        this._claimer.reset();
        global.stage.disconnectObject(this);
    }
}
