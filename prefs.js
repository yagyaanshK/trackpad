// Preferences laid out like Apple's Trackpad panel: Point & Click, Scroll & Zoom, More Gestures.
// Copyright (C) 2026 Yagyaansh Khaneja
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const TOUCHPAD_SCHEMA = 'org.gnome.desktop.peripherals.touchpad';

export default class TrackpadPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const touchpad = new Gio.Settings({schema_id: TOUCHPAD_SCHEMA});
        window._trackpadSettings = [settings, touchpad];

        window.set_default_size(720, 620);
        window.add(this._pointAndClick(touchpad));
        window.add(this._scrollAndZoom(touchpad));
        window.add(this._moreGestures(settings));
    }

    _page(title, iconName) {
        return new Adw.PreferencesPage({title, icon_name: iconName});
    }

    _group(page, title = null) {
        const group = new Adw.PreferencesGroup(title ? {title} : {});
        page.add(group);
        return group;
    }

    _switchRow(group, {title, subtitle, settings, key}) {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
        return row;
    }

    _unavailableRow(group, title, subtitle) {
        const row = new Adw.ActionRow({title, subtitle, sensitive: false});
        group.add(row);
        return row;
    }

    _builtInRow(group, title, subtitle) {
        const row = new Adw.ActionRow({title, subtitle});
        row.add_suffix(new Gtk.Label({label: 'Built into GNOME', css_classes: ['dim-label']}));
        group.add(row);
        return row;
    }

    _pointAndClick(touchpad) {
        const page = this._page('Point & Click', 'input-mouse-symbolic');
        const group = this._group(page);

        const speedRow = new Adw.ActionRow({title: 'Tracking speed'});
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({lower: -1, upper: 1, step_increment: 0.1}),
            draw_value: false,
            hexpand: true,
            valign: Gtk.Align.CENTER,
            width_request: 260,
        });
        scale.add_mark(-1, Gtk.PositionType.BOTTOM, 'Slow');
        scale.add_mark(1, Gtk.PositionType.BOTTOM, 'Fast');
        touchpad.bind('speed', scale.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
        speedRow.add_suffix(scale);
        group.add(speedRow);

        const secondary = new Adw.ComboRow({
            title: 'Secondary click',
            model: Gtk.StringList.new(['Click or tap with two fingers', 'Click in bottom-right corner']),
        });
        const methods = ['fingers', 'areas'];
        const current = touchpad.get_string('click-method');
        secondary.selected = Math.max(0, methods.indexOf(current === 'default' ? 'fingers' : current));
        secondary.connect('notify::selected', () => {
            touchpad.set_string('click-method', methods[secondary.selected]);
        });
        group.add(secondary);

        this._switchRow(group, {
            title: 'Tap to click',
            subtitle: 'Tap with one finger',
            settings: touchpad,
            key: 'tap-to-click',
        });

        this._unavailableRow(group, 'Look up & data detectors',
            'Needs a pressure-sensing trackpad (Force Touch); not available on this hardware');
        this._unavailableRow(group, 'Force Click and haptic feedback',
            'Needs a pressure-sensing trackpad; not available on this hardware');

        return page;
    }

    _scrollAndZoom(touchpad) {
        const page = this._page('Scroll & Zoom', 'view-paged-symbolic');
        const group = this._group(page);

        this._switchRow(group, {
            title: 'Natural scrolling',
            subtitle: 'Content tracks finger movement',
            settings: touchpad,
            key: 'natural-scroll',
        });
        this._builtInRow(group, 'Zoom in or out', 'Pinch with two fingers, in apps that support it');
        this._unavailableRow(group, 'Smart zoom', 'Double-tap with two fingers: not supported by GNOME apps');
        this._unavailableRow(group, 'Rotate', 'Rotate with two fingers: not supported by GNOME apps');

        return page;
    }

    _moreGestures(settings) {
        const page = this._page('More Gestures', 'input-touchpad-symbolic');
        const group = this._group(page);

        this._builtInRow(group, 'Swipe between pages', 'Scroll left or right with two fingers');
        this._builtInRow(group, 'Swipe between workspaces', 'Swipe left or right with three or four fingers');
        this._unavailableRow(group, 'Notification Center',
            'Swipe left from the right edge with two fingers: needs the Trackpad helper, coming later');
        this._builtInRow(group, 'Mission Control', 'Swipe up with three or four fingers');

        const appExpose = this._switchRow(group, {
            title: 'App Exposé',
            subtitle: 'Swipe down with three fingers. In development, not active yet',
            settings,
            key: 'app-expose-enabled',
        });
        appExpose.sensitive = false;

        this._switchRow(group, {
            title: 'Launchpad',
            subtitle: 'Pinch with thumb and three fingers',
            settings,
            key: 'launchpad-enabled',
        });
        this._switchRow(group, {
            title: 'Show Desktop',
            subtitle: 'Spread with thumb and three fingers',
            settings,
            key: 'show-desktop-enabled',
        });

        const fingers = new Adw.ComboRow({
            title: 'Pinch finger count',
            subtitle: 'Thumb and three fingers usually count as four contacts, sometimes three',
            model: Gtk.StringList.new(['Three or four', 'Four only', 'Three only']),
        });
        const values = ['any', 'four', 'three'];
        fingers.selected = Math.max(0, values.indexOf(settings.get_string('pinch-fingers')));
        fingers.connect('notify::selected', () => {
            settings.set_string('pinch-fingers', values[fingers.selected]);
        });
        group.add(fingers);

        return page;
    }
}
