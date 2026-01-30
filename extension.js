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

        // Check if the timeout is passed
        let lastUpdateTime = this.settings.get_int("time-last-update")
        let currentTime = Math.floor(Date.now() / 1000);
        let passedTime = currentTime - lastUpdateTime;

        // Create widget
        ImageWidget = new St.Widget();
        this.updateWidgetSize();
        this.updateWidgetPosition();
        if (lastUpdateTime === 0 || passedTime >= this.settings.get_int('widget-timeout')) {
            this.updateImagePath();
        } else {
            this.updateWidget();
        }
        
        Main.layoutManager._backgroundGroup.add_child(ImageWidget); // Add widget to the background group

        // Start repeating task
        this.updateTimeout();

        // Listen for changes
        this._settingsChangedIds = [];

        // Connect signals and store their IDs
        this._settingsChangedIds.push(
            this.settings.connect('changed::widget-size', this.updateWidgetSize),
            this.settings.connect('changed::widget-aspect-ratio', this.updateWidgetSize),
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
        let newAspectRatio = this.settings.get_double('widget-aspect-ratio');
        let newWidth = newSize * Math.sqrt(newAspectRatio);
        let newHeight = newSize / Math.sqrt(newAspectRatio);
        ImageWidget.set_width(newWidth);
        ImageWidget.set_height(newHeight);

        this.updateWidget();
    };

    updateWidgetPosition = () => {
        let newX = this.settings.get_int('widget-position-x');
        let newY = this.settings.get_int('widget-position-y');
        ImageWidget.set_position(newX, newY);
    };

    updateTimeout = () => {
        // Check if the timeout is passed
        let nextTimeout;
        let lastUpdateTime = this.settings.get_int("time-last-update")
        let currentTime = Math.floor(Date.now() / 1000);
        let passedTime = currentTime - lastUpdateTime;
        console.log(`Last update time: ${lastUpdateTime}, Current time: ${currentTime}, Passed time: ${passedTime}`);

        if (lastUpdateTime === 0 || passedTime >= this.settings.get_int('widget-timeout')) {
            nextTimeout = this.settings.get_int('widget-timeout');
        } else {
            nextTimeout = this.settings.get_int('widget-timeout') - passedTime;
        }

        // Clear previous timeout if it exists
        if (_timeoutId) {
            GLib.source_remove(_timeoutId);
        }

        // Set a new timeout
        _timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, nextTimeout, () => {
            this.updateImagePath();
            return true;
        });

        // Update the last update time in settings
        this.settings.set_int("time-last-update", Math.floor(Date.now() / 1000));
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

            // Collect all file names
            let fileNames = [];
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                const fileName = info.get_name();
                const filePath = folder.get_child(fileName);
                
                // Include files from subdirectories
                if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                    try {
                        const subEnumerator = filePath.enumerate_children(
                            'standard::name',
                            Gio.FileQueryInfoFlags.NONE,
                            null
                        );
                        let subInfo;
                        while ((subInfo = subEnumerator.next_file(null)) !== null) {
                            fileNames.push(`${fileName}/${subInfo.get_name()}`);
                        }
                        subEnumerator.close(null);
                    } catch (e) {
                        log(`Error reading subdirectory: ${e}`);
                    }
                } else {
                    fileNames.push(fileName);
                }
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
        this.settings.set_string('current-image-path', imagePath);
        this.updateWidget();
    };

    updateWidget = () => {
        let aspect_ratio = this.settings.get_double('widget-aspect-ratio');

        let size;
        if (aspect_ratio <= 1) {
            size = this.settings.get_int('widget-size') * Math.sqrt(aspect_ratio);
        } else {
            size = this.settings.get_int('widget-size') / Math.sqrt(aspect_ratio);
        }

        let radius_percent = this.settings.get_int('widget-corner-radius')/ 100;
        imagePath = this.settings.get_string('current-image-path');
        
        // Remove previous label if any
        if (ImageWidget._label) {
            ImageWidget._label.destroy();
            ImageWidget._label = null;
        }

        if (imagePath === '') {
            ImageWidget.set_style(`
                background-color: rgba(0, 0, 0, 1);
                border-radius: ${radius_percent * size/2}px;
            `);

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
                border-radius: ${radius_percent * size/2}px;
            `);
        }
    }
}