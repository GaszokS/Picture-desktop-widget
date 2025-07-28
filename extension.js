import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

let ImageWidget;
let settings;
let imagePath;
let _timeoutId;

export default class Picture_desktop_widget_extension extends Extension {
    enable() {
        settings = this.getSettings();

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
            settings.connect('changed::widget-size', this.updateWidgetSize),
            settings.connect('changed::widget-position-x', this.updateWidgetPosition),
            settings.connect('changed::widget-position-y', this.updateWidgetPosition),
            settings.connect('changed::image-path', this.updateImagePath),
            settings.connect('changed::widget-timeout', this.updateTimeout),
            settings.connect('changed::widget-corner-radius', this.updateWidget)
        );
    }

    disable() {
        ImageWidget?.destroy();
        ImageWidget = null;

        if (settings && this._settingsChangedIds) {
            this._settingsChangedIds.forEach(id => settings.disconnect(id));
            this._settingsChangedIds = [];
        }

        if (_timeoutId) {
            GLib.Source.remove(_timeoutId);
            _timeoutId = null;
        }
    }

    updateWidgetSize = () => {
        let newSize = settings.get_int('widget-size');
        ImageWidget.set_width(newSize);
        ImageWidget.set_height(newSize);
    };

    updateWidgetPosition = () => {
        let newX = settings.get_int('widget-position-x');
        let newY = settings.get_int('widget-position-y');
        ImageWidget.set_position(newX, newY);
    };

    updateTimeout = () => {
        if (_timeoutId) {
            GLib.source_remove(_timeoutId);
        }
        _timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, settings.get_int('widget-timeout'), () => {
            this.updateImagePath();
            return true;
        });
    };

    updateImagePath = () => {
        if (settings.get_string('image-path') === '') {
            imagePath = `${this.dir.get_path()}/image.JPG`;
        } else {
            const folderPath = settings.get_string('image-path');
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
        let size = settings.get_int('widget-size');
        let radius_percent = settings.get_int('widget-corner-radius')/ 100;
        ImageWidget.set_style(`
            background-image: url("file://${imagePath}");
            background-size: cover;
            border-radius: ${radius_percent * size}px;
        `);
    }
}