// Pure gesture arithmetic: no GNOME or Clutter imports, so it runs under node for tests.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

/** Change of pinch scale that counts as one full gesture: 1.0 -> 0.55 pinches all the way in. */
export const SCALE_RANGE = 0.45;

/** Below this much progress the direction of a pinch is not decided yet. */
export const DEAD_ZONE = 0.03;

/** Speed, in progress units per millisecond, above which the gesture is a flick. */
export const FLICK_VELOCITY = 0.0015;

/** Same constants GNOME Shell's SwipeTracker uses, so our animations end like its own. */
export const MIN_DURATION = 100;
export const MAX_DURATION = 400;
export const BASE_VELOCITY = 0.002;
export const DURATION_MULTIPLIER = 3;

export function clamp(value, lower, upper) {
    return Math.min(upper, Math.max(lower, value));
}

/** Pinch scale from libinput (1 at the start) to progress: > 0 pinching in, < 0 spreading. */
export function progressFromScale(scale, range = SCALE_RANGE) {
    return (1 - scale) / range;
}

/**
 * Pick the point a gesture settles on when the fingers lift.
 * A flick moves to the next point in its direction; otherwise the nearest point wins.
 */
export function decideEnd({progress, velocity, points, flickVelocity = FLICK_VELOCITY}) {
    const sorted = [...points].sort((a, b) => a - b);

    if (Math.abs(velocity) >= flickVelocity) {
        if (velocity > 0) {
            const next = sorted.find(p => p > progress + 1e-6);
            if (next !== undefined)
                return next;
        } else {
            const prev = [...sorted].reverse().find(p => p < progress - 1e-6);
            if (prev !== undefined)
                return prev;
        }
    }

    return sorted.reduce((best, p) =>
        Math.abs(p - progress) < Math.abs(best - progress) ? p : best, sorted[0]);
}

/** Milliseconds to animate from progress to target, carrying the finger velocity into the animation. */
export function animationDuration(progress, target, velocity) {
    const distance = Math.abs(target - progress);
    if (distance < 1e-4)
        return MIN_DURATION;

    let v = Math.abs(velocity);
    if ((target - progress) * velocity <= 0 || v < BASE_VELOCITY)
        v = BASE_VELOCITY;

    return clamp(distance / v * DURATION_MULTIPLIER, MIN_DURATION, MAX_DURATION);
}

/** Velocity over a short trailing window, like GNOME Shell's EventHistory. */
export class VelocityHistory {
    constructor(windowMs = 150) {
        this._window = windowMs;
        this._events = [];
    }

    reset() {
        this._events = [];
    }

    push(time, value) {
        this._events.push({time, value});
        this.trim(time);
    }

    trim(time) {
        const cutoff = time - this._window;
        while (this._events.length > 1 && this._events[0].time < cutoff)
            this._events.shift();
    }

    /** Progress units per millisecond, 0 when there is not enough history. */
    velocity() {
        if (this._events.length < 2)
            return 0;
        const first = this._events[0];
        const last = this._events[this._events.length - 1];
        const dt = last.time - first.time;
        return dt > 0 ? (last.value - first.value) / dt : 0;
    }
}

/**
 * Turns a stream of pinch begin/update/end calls into progress values and an end decision.
 *
 * handlers.onBegin(fingers) -> boolean: whether to take the gesture.
 * handlers.onUpdate(progress, scale)
 * handlers.onEnd(progress, velocity, cancelled)
 */
export class PinchTracker {
    constructor(handlers, {range = SCALE_RANGE} = {}) {
        this._handlers = handlers;
        this._range = range;
        this._history = new VelocityHistory();
        this._active = false;
        this._progress = 0;
    }

    get active() {
        return this._active;
    }

    get progress() {
        return this._progress;
    }

    begin(time, fingers) {
        this._active = !!this._handlers.onBegin(fingers);
        this._progress = 0;
        this._history.reset();
        if (this._active)
            this._history.push(time, 0);
        return this._active;
    }

    update(time, scale) {
        if (!this._active)
            return;
        this._progress = progressFromScale(scale, this._range);
        this._history.push(time, this._progress);
        this._handlers.onUpdate(this._progress, scale);
    }

    end(time, cancelled = false) {
        if (!this._active)
            return;
        this._active = false;
        this._history.trim(time);
        const velocity = cancelled ? 0 : this._history.velocity();
        this._handlers.onEnd(this._progress, velocity, cancelled);
    }
}
