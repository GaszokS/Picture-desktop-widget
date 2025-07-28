import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

let ImageWidget;
let imagePath;
let _timeoutId;

export default class Picture_desktop_widget_extension extends Extension {
    enable() {
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
            this.getSettings().connect('changed::widget-size', this.updateWidgetSize),
            this.getSettings().connect('changed::widget-position-x', this.updateWidgetPosition),
            this.getSettings().connect('changed::widget-position-y', this.updateWidgetPosition),
            this.getSettings().connect('changed::image-path', this.updateImagePath),
            this.getSettings().connect('changed::widget-timeout', this.updateTimeout),
            this.getSettings().connect('changed::widget-corner-radius', this.updateWidget)
        );
    }

    disable() {
        ImageWidget?.destroy();
        ImageWidget = null;

        if (this._settingsChangedIds) {
            this._settingsChangedIds.forEach(id => this.getSettings().disconnect(id));
            this._settingsChangedIds = [];
        }

        if (_timeoutId) {
            GLib.Source.remove(_timeoutId);
            _timeoutId = null;
        }
    }

    updateWidgetSize = () => {
        let newSize = this.getSettings().get_int('widget-size');
        ImageWidget.set_width(newSize);
        ImageWidget.set_height(newSize);
    };

    updateWidgetPosition = () => {
        let newX = this.getSettings().get_int('widget-position-x');
        let newY = this.getSettings().get_int('widget-position-y');
        ImageWidget.set_position(newX, newY);
    };

    updateTimeout = () => {
        if (_timeoutId) {
            GLib.source_remove(_timeoutId);
        }
        _timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this.getSettings().get_int('widget-timeout'), () => {
            this.updateImagePath();
            return true;
        });
    };

    updateImagePath = () => {
        if (this.getSettings().get_string('image-path') === '') {
            imagePath = `${this.dir.get_path()}/image.JPG`;
        } else {
            const folderPath = this.getSettings().get_string('image-path');
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
        let size = this.getSettings().get_int('widget-size');
        let radius_percent = this.getSettings().get_int('widget-corner-radius')/ 100;
        ImageWidget.set_style(`
            background-image: url("file://${imagePath}");
            background-size: cover;
            border-radius: ${radius_percent * size}px;
        `);
    }
}