'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PictureDesktopWidgetPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this.settings = this.getSettings();

        // 1. Create the page
        this.page = new Adw.PreferencesPage();
        
        // 2. Group for general actions (Add button)
        const actionGroup = new Adw.PreferencesGroup();
        
        // A box to keep the button centered and with margins
        const buttonBox = new Gtk.Box({
            halign: Gtk.Align.CENTER,
            margin_top: 20,
            margin_bottom: 20
        });

        const addButton = new Gtk.Button({
            label: _("Add New Widget"),
            css_classes: ['suggested-action', 'pill']
        });

        addButton.connect('clicked', () => {
            this._addNewWidget();
            this._renderWidgets();
        });

        buttonBox.append(addButton);
        
        // Add the box to the Group, and the Group to the Page
        actionGroup.add(buttonBox);
        this.page.add(actionGroup);

        // Array to manage dynamic groups on the screen so we can remove and recreate them
        this.dynamicGroups = [];

        // Render existing widgets
        this._renderWidgets();
        
        window.add(this.page);

        window.connect('close-request', () => {
            this.settings = null;
        });
    }

    _getConfig() {
        try {
            const jsonString = this.settings.get_string('widgets-config');
            return JSON.parse(jsonString) || [];
        } catch (e) {
            console.error("Failed to parse widgets-config:", e);
            return [];
        }
    }

    _saveConfig(configs) {
        this.settings.set_string('widgets-config', JSON.stringify(configs));
    }

    _addNewWidget() {
        let configs = this._getConfig();
        const newId = "widget-" + Date.now();
        configs.push({
            "id": newId,
            "widget-size": 200,
            "widget-aspect-ratio": 1.0,
            "widget-position-x": 100,
            "widget-position-y": 100,
            "image-path": "",
            "widget-timeout": 60,
            "widget-corner-radius": 20,
            "time-last-update": 0,
            "current-image-path": ""
        });
        this._saveConfig(configs);
    }

    _deleteWidget(index) {
        let configs = this._getConfig();
        configs.splice(index, 1);
        this._saveConfig(configs);
    }

    _renderWidgets() {
        // Clear previous widget groups from the page
        this.dynamicGroups.forEach(group => {
            this.page.remove(group);
        });
        this.dynamicGroups = [];

        let configs = this._getConfig();

        configs.forEach((widgetConfig, index) => {
            // Each widget is a new PreferencesGroup added directly to the page
            const group = new Adw.PreferencesGroup({
                title: _("Widget") + ` ${index + 1}`
            });

            // Creating preference rows for this specific widget
            let sizeRow = this._createSpinRow(_("Widget Size"), 50, 2000, 1, 10, "widget-size", widgetConfig, index);
            let xPositionRow = this._createSpinRow(_("X Position"), 0, 100000, 5, 50, "widget-position-x", widgetConfig, index);
            let yPositionRow = this._createSpinRow(_("Y Position"), 0, 100000, 5, 50, "widget-position-y", widgetConfig, index);
            let imagePathRow = this._createFolderChooserRow(_("Images Path"), "image-path", widgetConfig, index);
            let timeoutRow = this._createSpinRow(_("Image Update Interval (seconds)"), 5, 100000, 5, 60, "widget-timeout", widgetConfig, index);
            let cornerRadiusRow = this._createSliderRow(_("Widget Corner Radius (%)"), 0, 100, 1, 10, "widget-corner-radius", 'int', widgetConfig, index);
            let aspectRatioRow = this._createSliderRow(_("Widget Aspect Ratio (Width/Height)"), 0.25, 4, 0.01, 0.1, "widget-aspect-ratio", 'double', widgetConfig, index);

            // Adding rows to the group
            group.add(sizeRow);
            group.add(xPositionRow);
            group.add(yPositionRow);
            group.add(imagePathRow);
            group.add(timeoutRow);
            group.add(cornerRadiusRow);
            group.add(aspectRatioRow);

            // Row with the delete button
            let deleteRow = new Adw.ActionRow({
                title: _("Remove this widget"),
            });
            let deleteBtn = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['destructive-action']
            });
            deleteBtn.connect('clicked', () => {
                this._deleteWidget(index);
                this._renderWidgets(); // Re-render after deleting
            });
            deleteRow.add_suffix(deleteBtn);
            group.add(deleteRow);

            // Add the group to the page and save the reference
            this.page.add(group);
            this.dynamicGroups.push(group);
        });
    }

    _updateConfigValue(index, settingName, newValue) {
        let configs = this._getConfig();
        configs[index][settingName] = newValue;
        this._saveConfig(configs);
    }

    _createSpinRow(title, lower, upper, stepIncrement, pageIncrement, settingName, widgetConfig, index) {
        const row = new Adw.SpinRow({
            title: title,
            adjustment: new Gtk.Adjustment({
                lower: lower,
                upper: upper,
                step_increment: stepIncrement,
                page_increment: pageIncrement,
                value: widgetConfig[settingName] !== undefined ? widgetConfig[settingName] : lower,
            }),
        });

        row.connect('notify::value', () => {
            const newValue = row.get_value();
            this._updateConfigValue(index, settingName, newValue);
        });

        return row;
    }

    _createSliderRow(title, lower, upper, stepIncrement, pageIncrement, settingName, settingType = 'int', widgetConfig, index) {
        let digits;
        if (stepIncrement < 1) {
            digits = Math.ceil(-Math.log10(stepIncrement));
        } else {
            digits = 0;
        }

        let value = widgetConfig[settingName] !== undefined ? widgetConfig[settingName] : lower;

        const row = new Adw.ActionRow({
            title: title,
        });

        const adjustment = new Gtk.Adjustment({
            lower: lower,
            upper: upper,
            step_increment: stepIncrement,
            page_increment: pageIncrement,
            value: value,
        });

        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: adjustment,
            digits: digits,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });

        scale.set_draw_value(true);
        scale.set_value_pos(Gtk.PositionType.RIGHT);

        scale.connect('value-changed', () => {
            const newValue = scale.get_value();
            this._updateConfigValue(index, settingName, newValue);
        });

        row.add_suffix(scale);
        row.activatable_widget = scale;

        return row;
    }

    _createFolderChooserRow(title, settingName, widgetConfig, index) {
        const row = new Adw.ActionRow({
            title: title,
            subtitle: widgetConfig[settingName] || '',
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
                transient_for: this.page.get_root(),
                modal: true,
                action: Gtk.FileChooserAction.SELECT_FOLDER,
            });

            dialog.add_button(_("_Cancel"), Gtk.ResponseType.CANCEL);
            dialog.add_button(_("_Open"), Gtk.ResponseType.OK);

            dialog.connect('response', (dialog, response) => {
                if (response === Gtk.ResponseType.OK) {
                    const folderPath = dialog.get_file().get_path();
                    this._updateConfigValue(index, settingName, folderPath);
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