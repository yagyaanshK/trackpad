// App Exposé: a three-finger swipe down shows the windows of the current app, using
// GNOME's own window picker with every other app's windows filtered out.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {ControlsState} from 'resource:///org/gnome/shell/ui/overviewControls.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

import {animationDuration, decideEnd} from './pinchTracker.js';

export class AppExpose {
    constructor() {
        this._windows = [];
        this._tracker = null;
        this._value = 0;
        this._shown = false;
        this._filterInstalled = false;
        this._originals = null;
    }

    get active() {
        return this._tracker !== null;
    }

    /** True from the moment the filter goes in until the overview has hidden again. */
    get showing() {
        return this._filterInstalled;
    }

    canBegin() {
        if (Main.overview.isDummy || Main.overview.visible)
            return false;
        if (Main.actionMode !== Shell.ActionMode.NORMAL)
            return false;
        const app = Shell.WindowTracker.get_default().focus_app;
        if (!app)
            return false;
        const workspace = global.workspace_manager.get_active_workspace();
        this._windows = app.get_windows().filter(w =>
            w.located_on_workspace(workspace) && !w.skip_taskbar);
        return this._windows.length > 0;
    }

    begin() {
        this._installFilter();
        this._tracker = {confirmSwipe: () => {}};
        this._shown = false;
        this._value = 0;
        Main.overview._gestureBegin(this._tracker);
    }

    update(progress) {
        if (!this._tracker)
            return;
        this._value = progress * (ControlsState.WINDOW_PICKER - ControlsState.HIDDEN);
        if (this._value > 0)
            this._shown = true;
        Main.overview._gestureUpdate(this._tracker, this._value);
    }

    end(velocity, cancelled) {
        if (!this._tracker)
            return;
        const target = cancelled
            ? ControlsState.HIDDEN
            : decideEnd({progress: this._value, velocity, points: [ControlsState.HIDDEN, ControlsState.WINDOW_PICKER]});
        const duration = animationDuration(this._value, target, velocity);

        if (!this._shown && target === ControlsState.HIDDEN) {
            Main.overview._overview.controls.gestureEnd(target, duration, () => {});
            this._removeFilter();
        } else {
            Main.overview._gestureEnd(this._tracker, duration, target);
        }
        this._tracker = null;
    }

    _installFilter() {
        if (this._filterInstalled)
            return;
        this._filterInstalled = true;

        const workspaceProto = Workspace.Workspace.prototype;
        const thumbnailProto = WorkspaceThumbnail.WorkspaceThumbnail.prototype;
        this._originals = {
            workspace: workspaceProto._isOverviewWindow,
            thumbnail: thumbnailProto._isOverviewWindow,
        };
        const expose = this;
        const {workspace, thumbnail} = this._originals;
        workspaceProto._isOverviewWindow = function (window) {
            return workspace.call(this, window) && expose._windows.includes(window);
        };
        thumbnailProto._isOverviewWindow = function (windowActor) {
            return thumbnail.call(this, windowActor) && expose._windows.includes(windowActor.metaWindow);
        };
        this._refreshWorkspaces(w => !this._windows.includes(w), 'window-removed');

        // App Exposé has no search field on a Mac.
        Main.overview.searchEntry.opacity = 0;
        Main.overview.searchEntry.reactive = false;

        Main.overview.connectObject('hidden', () => this._removeFilter(), this);
    }

    _removeFilter() {
        if (!this._filterInstalled)
            return;
        this._filterInstalled = false;
        Main.overview.disconnectObject(this);

        Workspace.Workspace.prototype._isOverviewWindow = this._originals.workspace;
        WorkspaceThumbnail.WorkspaceThumbnail.prototype._isOverviewWindow = this._originals.thumbnail;
        this._originals = null;
        this._refreshWorkspaces(() => true, 'window-added');

        Main.overview.searchEntry.opacity = 255;
        Main.overview.searchEntry.reactive = true;
        this._windows = [];
    }

    /** Makes existing workspace views re-evaluate their windows, the way Ubuntu Dock's app spread does. */
    _refreshWorkspaces(matches, signal) {
        const manager = global.workspace_manager;
        for (let i = 0; i < manager.n_workspaces; i++) {
            const workspace = manager.get_workspace_by_index(i);
            workspace.list_windows().filter(matches).forEach(w => workspace.emit(signal, w));
        }
    }

    destroy() {
        if (this._tracker)
            this.end(0, true);
        this._removeFilter();
    }
}
