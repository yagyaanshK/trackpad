// Pure arithmetic for claiming a three-finger swipe before GNOME's own tracker does.
// No GNOME or Clutter imports, so it runs under node for tests.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

import {VelocityHistory, clamp} from './pinchTracker.js';

/** Travel in px before the swipe's direction is decided. GNOME decides at 16, we must be first. */
export const CLAIM_THRESHOLD = 10;

/** Finger travel in px for a full gesture, the same base GNOME uses for vertical swipes. */
export const BASE_DISTANCE = 300;

export const MIN_FINGERS = 3;

const State = {
    NONE: 0,
    PENDING: 1,
    CLAIMED: 2,
    IGNORED: 3,
};

/**
 * Feed it touchpad swipe events; it claims a vertical swipe in the "hide the overview"
 * direction (fingers down with natural scrolling, as App Exposé on a Mac) and reports
 * progress 0..1 for it.
 *
 * handlers.onBegin() -> boolean: whether to take the swipe once its direction is known.
 * handlers.onUpdate(progress)
 * handlers.onEnd(progress, velocity, cancelled)
 */
export class SwipeClaimer {
    constructor(handlers) {
        this._handlers = handlers;
        this._state = State.NONE;
        this._cx = 0;
        this._cy = 0;
        this._travel = 0;
        this._progress = 0;
        this._history = new VelocityHistory();
    }

    get claimed() {
        return this._state === State.CLAIMED;
    }

    get progress() {
        return this._progress;
    }

    /**
     * @param {object} ev {phase: 'begin'|'update'|'end'|'cancel', fingers, dx, dy, natural, time}
     * @returns {boolean} true when the event is ours and must not reach GNOME
     */
    feed(ev) {
        if (ev.phase === 'begin') {
            this._state = ev.fingers >= MIN_FINGERS ? State.PENDING : State.IGNORED;
            this._cx = 0;
            this._cy = 0;
            this._travel = 0;
            this._progress = 0;
            this._history.reset();
        }

        if (this._state === State.IGNORED || this._state === State.NONE)
            return false;

        // GNOME flips the delta for natural scrolling; progress toward the overview is
        // positive, so the App Exposé direction is a negative delta.
        const delta = ev.natural ? -ev.dy : ev.dy;

        if (this._state === State.PENDING) {
            if (ev.phase === 'end' || ev.phase === 'cancel') {
                this._state = State.NONE;
                return false;
            }
            this._cx += ev.dx;
            this._cy += delta;
            if (Math.hypot(this._cx, this._cy) < CLAIM_THRESHOLD)
                return false;
            const vertical = Math.abs(this._cy) > Math.abs(this._cx);
            if (!vertical || this._cy >= 0 || !this._handlers.onBegin()) {
                this._state = State.IGNORED;
                return false;
            }
            this._state = State.CLAIMED;
            this._travel = -this._cy;
            this._history.push(ev.time, 0);
            this._emitUpdate(ev.time);
            return true;
        }

        switch (ev.phase) {
        case 'update':
            this._travel -= delta;
            this._emitUpdate(ev.time);
            break;
        case 'end':
        case 'cancel': {
            this._state = State.NONE;
            this._history.trim(ev.time);
            const velocity = ev.phase === 'cancel' ? 0 : this._history.velocity();
            this._handlers.onEnd(this._progress, velocity, ev.phase === 'cancel');
            break;
        }
        }
        return true;
    }

    _emitUpdate(time) {
        this._progress = clamp(this._travel / BASE_DISTANCE, 0, 1);
        this._history.push(time, this._progress);
        this._handlers.onUpdate(this._progress);
    }

    /** Drop a swipe in flight without reporting it, used when the extension is disabled. */
    reset() {
        this._state = State.NONE;
    }
}
