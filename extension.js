import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

let ImageWidget;
let imagePath;
let _timeoutId;

export default class Picture_desktop_widget_extension extends Extension {
    enable() {
        this.settings = this.getSettings();

        // Create widget
        ImageWidget = new St.Widget();
        this.updateWidgetSize();
        this.updateWidgetPosition();
        this.updateImagePath();
        
        Main.layoutManager._backgroundGroup.add_child(ImageWidget); // Add widget to the background group

        // Start repeating task
        this.updateTimeout();

        // Listen for changes
        this._settingsChangedIds = [];

        // Connect signals and store their IDs
        this._settingsChangedIds.push(
            this.settings.connect('changed::widget-size', this.updateWidgetSize),
            this.settings.connect('changed::widget-position-x', this.updateWidgetPosition),
            this.settings.connect('changed::widget-position-y', this.updateWidgetPosition),
            this.settings.connect('changed::image-path', this.updateImagePath),
            this.settings.connect('changed::widget-timeout', this.updateTimeout),
            this.settings.connect('changed::widget-corner-radius', this.updateWidget)
        );
    }

    disable() {
        ImageWidget?.destroy();
        ImageWidget = null;

        if (this._settingsChangedIds) {
            this._settingsChangedIds.forEach(id => this.settings.disconnect(id));
            this._settingsChangedIds = [];
        }
        this.settings = null;

        if (_timeoutId) {
            GLib.Source.remove(_timeoutId);
            _timeoutId = null;
        }
    }

    updateWidgetSize = () => {
        let newSize = this.settings.get_int('widget-size');
        ImageWidget.set_width(newSize);
        ImageWidget.set_height(newSize);
    };

    updateWidgetPosition = () => {
        let newX = this.settings.get_int('widget-position-x');
        let newY = this.settings.get_int('widget-position-y');
        ImageWidget.set_position(newX, newY);
    };

    updateTimeout = () => {
        if (_timeoutId) {
            GLib.source_remove(_timeoutId);
        }
        _timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this.settings.get_int('widget-timeout'), () => {
            this.updateImagePath();
            return true;
        });
    };

    updateImagePath = () => {
        if (this.settings.get_string('image-path') === '') {
            imagePath = '';
        } else {
            const folderPath = this.settings.get_string('image-path');
            const folder = Gio.File.new_for_path(folderPath);
            const enumerator = folder.enumerate_children(
                'standard::name',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            // Collect all file names into an array
            let fileNames = [];
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                fileNames.push(info.get_name());
            }
            enumerator.close(null);

            // Filter for image files
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
            fileNames = fileNames.filter(fileName =>
                imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext))
            );

            if (fileNames.length > 0) {
                // Pick random one
                const randomIndex = Math.floor(Math.random() * fileNames.length);
                const randomFile = fileNames[randomIndex];
                imagePath = `${folderPath}/${randomFile}`;
            } else {
                log('No files found');
            }
        }
        this.updateWidget();
    };

    updateWidget = () => {
        let size = this.settings.get_int('widget-size');
        let radius_percent = this.settings.get_int('widget-corner-radius')/ 100;
        if (imagePath === '') {
            ImageWidget.set_style(`
                background-color: rgba(0, 0, 0, 1);
                border-radius: ${radius_percent * size}px;
            `);

            // Remove previous label if any
            if (ImageWidget._label) {
                ImageWidget._label.destroy();
                ImageWidget._label = null;
            }

            // Add a label to the widget
            let label = new St.Label({ text: _("Add a path\n to folder with images")});
            label.set_style(`
                color: white;
                font-size: ${size / 10}px;
                text-align: center;
            `);
            ImageWidget.add_child(label);
            ImageWidget._label = label;
        } else {
            ImageWidget.set_style(`
                background-image: url("file://${imagePath}");
                background-size: cover;
                border-radius: ${radius_percent * size}px;
            `);
        }
    }
}