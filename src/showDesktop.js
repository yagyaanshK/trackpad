// Show Desktop: spread slides every window to the nearest screen edge, pinch brings them back.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {animationDuration, decideEnd} from './pinchTracker.js';

/** Pixels of each window left peeking in from the screen edge, as macOS does. */
const PEEK = 12;

const WINDOW_TYPES = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG,
    Meta.WindowType.UTILITY,
];

export class ShowDesktop {
    constructor() {
        this._entries = [];
        this._strips = [];
        this._shown = false;
        this._gesture = false;
        this._progress = 0;
    }

    /** True while the windows rest at the edges. */
    get shown() {
        return this._shown;
    }

    get active() {
        return this._gesture;
    }

    canBegin() {
        return Main.actionMode === Shell.ActionMode.NORMAL && !Main.overview.visible;
    }

    _collect() {
        const workspace = global.workspace_manager.get_active_workspace();
        return global.get_window_actors().filter(actor => {
            const window = actor.meta_window;
            return window &&
                !window.minimized &&
                window.located_on_workspace(workspace) &&
                WINDOW_TYPES.includes(window.get_window_type()) &&
                !window.is_override_redirect();
        }).map(actor => ({actor, ...this._offsetFor(actor.meta_window)}));
    }

    /** Where a window goes: just outside the work area along the axis it is closest to, minus the peek. */
    _offsetFor(window) {
        const rect = window.get_frame_rect();
        const monitor = window.get_workspace().get_work_area_for_monitor(window.get_monitor());
        const area = {x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height};
        const cx = rect.x + rect.width / 2 - (monitor.x + monitor.width / 2);
        const cy = rect.y + rect.height / 2 - (monitor.y + monitor.height / 2);
        const nx = cx / (monitor.width / 2);
        const ny = cy / (monitor.height / 2);

        if (Math.abs(nx) >= Math.abs(ny)) {
            const dx = nx >= 0
                ? monitor.x + monitor.width - rect.x - PEEK
                : -(rect.x + rect.width - monitor.x - PEEK);
            return {dx, dy: 0, area};
        }
        const dy = ny >= 0
            ? monitor.y + monitor.height - rect.y - PEEK
            : -(rect.y + rect.height - monitor.y - PEEK);
        return {dx: 0, dy, area};
    }

    /**
     * On Wayland a click on a window goes straight to the app, so the shell never sees it.
     * While the desktop is shown, an invisible reactive strip sits over each window's
     * peeking edge: clicking it brings the windows back and raises that window, as on macOS.
     */
    _addStrips() {
        this._removeStrips();
        for (const entry of this._entries) {
            const rect = entry.actor.meta_window.get_frame_rect();
            const x0 = Math.max(rect.x + entry.dx, entry.area.x);
            const y0 = Math.max(rect.y + entry.dy, entry.area.y);
            const x1 = Math.min(rect.x + entry.dx + rect.width, entry.area.x + entry.area.width);
            const y1 = Math.min(rect.y + entry.dy + rect.height, entry.area.y + entry.area.height);
            if (x1 <= x0 || y1 <= y0)
                continue;
            const strip = new St.Widget({
                reactive: true,
                x: x0,
                y: y0,
                width: x1 - x0,
                height: y1 - y0,
            });
            const pick = () => {
                entry.actor.meta_window.activate(global.get_current_time());
                this.restore(true);
                return Clutter.EVENT_STOP;
            };
            strip.connect('button-press-event', pick);
            strip.connect('touch-event', (_actor, event) =>
                event.type() === Clutter.EventType.TOUCH_BEGIN ? pick() : Clutter.EVENT_PROPAGATE);
            entry.strip = strip;
            Main.layoutManager.uiGroup.add_child(strip);
            this._strips.push(strip);
        }
    }

    _removeStrips() {
        for (const strip of this._strips)
            strip.destroy();
        this._strips = [];
        for (const entry of this._entries)
            entry.strip = null;
    }

    _apply(progress) {
        this._progress = progress;
        for (const {actor, dx, dy} of this._entries) {
            actor.translation_x = dx * progress;
            actor.translation_y = dy * progress;
        }
    }

    /** Starts a gesture: from the desktop (progress 0) or from the shown state (progress 1). */
    begin() {
        this._gesture = true;
        if (!this._shown) {
            this._entries = this._collect();
            for (const entry of this._entries) {
                entry.actor.connectObject('destroy', () => {
                    this._entries = this._entries.filter(e => e !== entry);
                }, this);
            }
            this._progress = 0;
        } else {
            this._removeStrips();
            for (const {actor} of this._entries) {
                actor.remove_transition('translation-x');
                actor.remove_transition('translation-y');
            }
        }
        return this._entries.length > 0;
    }

    /** progress: 0 windows in place, 1 windows at the edges. */
    update(progress) {
        if (!this._gesture)
            return;
        this._apply(progress);
    }

    end(velocity, cancelled) {
        if (!this._gesture)
            return;
        this._gesture = false;

        const from = this._shown ? 1 : 0;
        const target = cancelled
            ? from
            : decideEnd({progress: this._progress, velocity, points: [0, 1]});
        const duration = animationDuration(this._progress, target, velocity);
        this._settle(target, duration);
    }

    _settle(target, duration) {
        let pending = this._entries.length;
        const done = () => {
            if (--pending > 0)
                return;
            if (target === 0)
                this._clear();
        };

        if (pending === 0) {
            this._shown = false;
            return;
        }

        this._shown = target === 1;
        if (this._shown) {
            this._watch();
            this._addStrips();
        } else {
            this._unwatch();
            this._removeStrips();
        }

        for (const {actor, dx, dy} of this._entries) {
            actor.ease({
                translation_x: dx * target,
                translation_y: dy * target,
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
                onComplete: done,
            });
        }
        this._progress = target;
    }

    /** While the desktop is shown, bring the windows back when the user turns to one of them. */
    _watch() {
        global.display.connectObject('notify::focus-window', () => {
            const focus = global.display.focus_window;
            if (focus && this._entries.some(e => e.actor.meta_window === focus))
                this.restore(true);
        }, this);
        global.window_manager.connectObject(
            'map', () => this.restore(true),
            'unminimize', () => this.restore(true),
            'minimize', (_wm, actor) => this._release(actor),
            this);
        global.workspace_manager.connectObject('workspace-switched',
            () => this.restore(false), this);
        Main.overview.connectObject('showing', () => this.restore(false), this);
    }

    _unwatch() {
        global.display.disconnectObject(this);
        global.window_manager.disconnectObject(this);
        global.workspace_manager.disconnectObject(this);
        Main.overview.disconnectObject(this);
    }

    /** A window that gets minimized while the desktop is shown goes back to its place first. */
    _release(actor) {
        const entry = this._entries.find(e => e.actor === actor);
        if (!entry)
            return;
        actor.remove_transition('translation-x');
        actor.remove_transition('translation-y');
        actor.set({translation_x: 0, translation_y: 0});
        actor.disconnectObject(this);
        entry.strip?.destroy();
        this._strips = this._strips.filter(s => s !== entry.strip);
        this._entries = this._entries.filter(e => e !== entry);
        if (this._entries.length === 0)
            this.restore(false);
    }

    /** Slide (or snap) the windows back into place. */
    restore(animate) {
        if (!this._shown && !this._gesture)
            return;
        this._gesture = false;
        this._unwatch();
        this._removeStrips();
        if (animate) {
            this._settle(0, MIN_RESTORE_DURATION);
        } else {
            for (const {actor} of this._entries) {
                actor.remove_transition('translation-x');
                actor.remove_transition('translation-y');
            }
            this._apply(0);
            this._shown = false;
            this._clear();
        }
    }

    _clear() {
        this._removeStrips();
        for (const {actor} of this._entries)
            actor.disconnectObject(this);
        this._entries = [];
        this._shown = false;
    }

    destroy() {
        this.restore(false);
    }
}

const MIN_RESTORE_DURATION = 250;
