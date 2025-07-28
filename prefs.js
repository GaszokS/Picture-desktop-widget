'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PictureDesktopWidgetPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();
        group.set_title(_("Settings"));

        let sizeRow = this._createSpinRow(_("Widget Size"), 50, 2000, 1, 10, "widget-size");
        let xPositionRow = this._createSpinRow(_("X Position"), 0, 100000, 5, 50, "widget-position-x");
        let yPositionRow = this._createSpinRow(_("Y Position"), 0, 100000, 5, 50, "widget-position-y");
        let imagePathRow = this._createFolderChooserRow(_("Images Path"), "image-path", page);
        let timeoutRow = this._createSpinRow(_("Image Update Interval (seconds)"), 5, 100000, 5, 60, "widget-timeout");
        let cornerRadiusRow = this._createSliderRow(_("Widget Corner Radius (%)"), 0, 100, 1, 10, "widget-corner-radius");

        group.add(sizeRow);
        group.add(xPositionRow);
        group.add(yPositionRow);
        group.add(imagePathRow);
        group.add(timeoutRow);
        group.add(cornerRadiusRow);

        page.add(group);
        window.add(page);
    }

    _createSpinRow(title, lower, upper, stepIncrement, pageIncrement, settingName) {
        const row = new Adw.SpinRow({
            title: title,
            adjustment: new Gtk.Adjustment({
                lower: lower,
                upper: upper,
                step_increment: stepIncrement,
                page_increment: pageIncrement,
                value: this._settings.get_int(settingName),
            }),
        });

        row.connect('notify::value', () => {
            const newValue = row.get_value();
            if (newValue !== this._settings.get_int(settingName)) {
                this._settings.set_int(settingName, newValue);
            }
        });

        return row;
    }

    _createSliderRow(title, lower, upper, stepIncrement, pageIncrement, settingName) {
        const row = new Adw.ActionRow({
            title: title,
        });

        const adjustment = new Gtk.Adjustment({
            lower: lower,
            upper: upper,
            step_increment: stepIncrement,
            page_increment: pageIncrement,
            value: this._settings.get_int(settingName),
        });

        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: adjustment,
            digits: 0,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });

        scale.set_draw_value(true);
        scale.set_value_pos(Gtk.PositionType.RIGHT);

        scale.connect('value-changed', () => {
            const newValue = scale.get_value();
            if (newValue !== this._settings.get_int(settingName)) {
                this._settings.set_int(settingName, newValue);
            }
        });

        row.add_suffix(scale);
        row.activatable_widget = scale;

        return row;
    }

    _createFolderChooserRow(title, settingName, page) {
        const row = new Adw.ActionRow({
            title: title,
            activatable: false,
        });

        const button = new Gtk.Button({
            label: _("Choose Folder"),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });

        button.connect('clicked', () => {
            const dialog = new Gtk.FileChooserDialog({
                title: _("Select Image Folder"),
                transient_for: page.get_root(),
                modal: true,
                action: Gtk.FileChooserAction.SELECT_FOLDER,
            });

            dialog.add_button(_("_Cancel"), Gtk.ResponseType.CANCEL);
            dialog.add_button(_("_Open"), Gtk.ResponseType.OK);

            dialog.connect('response', (dialog, response) => {
                if (response === Gtk.ResponseType.OK) {
                    const folderPath = dialog.get_file().get_path();
                    this._settings.set_string(settingName, folderPath);
                    row.set_subtitle(folderPath);
                }
                dialog.destroy();
            });

            dialog.present();
        });

        row.add_suffix(button);
        row.activatable_widget = button;

        return row;
    }
}