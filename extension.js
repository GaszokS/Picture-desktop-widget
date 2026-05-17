import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

// --- HELPER CLASS FOR EACH INDEPENDENT WIDGET ---
class PictureWidgetInstance {
    constructor(config) {
        this.config = config;
        this.imageWidget = new St.Widget();
        this.currentImagePath = config['current-image-path'] || '';
        this.lastUpdateTime = config['time-last-update'] || 0;
        this._timeoutId = null;
    }

    enable() {
        // Check if the timeout is passed
        let currentTime = Math.floor(Date.now() / 1000);
        let passedTime = currentTime - this.lastUpdateTime;

        // Create widget
        this.updateWidgetSize();
        this.updateWidgetPosition();
        if (this.lastUpdateTime === 0 || passedTime >= this.config['widget-timeout']) {
            this.updateImagePath();
        } else {
            this.updateWidget();
        }
        
        Main.layoutManager._backgroundGroup.add_child(this.imageWidget); // Add widget to the background group

        // Start repeating task
        this.updateTimeout();
    }

    disable() {
        this.imageWidget?.destroy();
        this.imageWidget = null;

        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }
    }

    updateWidgetSize = () => {
        let newSize = this.config['widget-size'];
        let newAspectRatio = this.config['widget-aspect-ratio'];
        let newWidth = newSize * Math.sqrt(newAspectRatio);
        let newHeight = newSize / Math.sqrt(newAspectRatio);
        this.imageWidget.set_width(newWidth);
        this.imageWidget.set_height(newHeight);

        this.updateWidget();
    };

    updateWidgetPosition = () => {
        let newX = this.config['widget-position-x'];
        let newY = this.config['widget-position-y'];
        this.imageWidget.set_position(newX, newY);
    };

    updateTimeout = () => {
        // Check if the timeout is passed
        let nextTimeout;
        let currentTime = Math.floor(Date.now() / 1000);
        let passedTime = currentTime - this.lastUpdateTime;
        console.log(`Last update time: ${this.lastUpdateTime}, Current time: ${currentTime}, Passed time: ${passedTime}`);

        if (this.lastUpdateTime === 0 || passedTime >= this.config['widget-timeout']) {
            nextTimeout = this.config['widget-timeout'];
        } else {
            nextTimeout = this.config['widget-timeout'] - passedTime;
        }

        // Clear previous timeout if it exists
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
        }

        // Set a new timeout
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, nextTimeout, () => {
            this.updateImagePath();
            return true;
        });

        this.lastUpdateTime = Math.floor(Date.now() / 1000);
    };

    updateImagePath = () => {
        if (!this.config['image-path'] || this.config['image-path'] === '') {
            this.currentImagePath = '';
        } else {
            const folderPath = this.config['image-path'];
            const folder = Gio.File.new_for_path(folderPath);
            
            if (folder.query_exists(null)) {
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
                    this.currentImagePath = `${folderPath}/${randomFile}`;
                } else {
                    log('No files found');
                    this.currentImagePath = '';
                }
            } else {
                this.currentImagePath = '';
            }
        }
        this.updateWidget();
    };

    updateWidget = () => {
        let aspect_ratio = this.config['widget-aspect-ratio'];

        let size;
        if (aspect_ratio <= 1) {
            size = this.config['widget-size'] * Math.sqrt(aspect_ratio);
        } else {
            size = this.config['widget-size'] / Math.sqrt(aspect_ratio);
        }

        let radius_percent = this.config['widget-corner-radius'] / 100;
        
        // Remove previous label if any
        if (this.imageWidget._label) {
            this.imageWidget._label.destroy();
            this.imageWidget._label = null;
        }

        if (this.currentImagePath === '') {
            this.imageWidget.set_style(`
                background-color: rgba(0, 0, 0, 1);
                border-radius: ${radius_percent * size / 2}px;
            `);

            // Add a label to the widget
            let label = new St.Label({ text: _("Add a path\n to folder with images")});
            label.set_style(`
                color: white;
                font-size: ${size / 10}px;
                text-align: center;
            `);
            this.imageWidget.add_child(label);
            this.imageWidget._label = label;
        } else {
            this.imageWidget.set_style(`
                background-image: url("file://${this.currentImagePath}");
                background-size: cover;
                border-radius: ${radius_percent * size / 2}px;
            `);
        }
    };
}

// --- MAIN EXTENSION CLASS ---
export default class Picture_desktop_widget_extension extends Extension {
    enable() {
        this.settings = this.getSettings();
        this.widgets = [];

        this.loadWidgets();

        // Listen for changes
        this._settingsChangedId = this.settings.connect('changed::widgets-config', () => {
            this.reloadWidgets();
        });
    }

    disable() {
        this.clearWidgets();

        if (this._settingsChangedId) {
            this.settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        this.settings = null;
    }

    loadWidgets() {
        try {
            let jsonString = this.settings.get_string('widgets-config');
            let configs = JSON.parse(jsonString);
            
            configs.forEach(config => {
                let widgetInstance = new PictureWidgetInstance(config);
                widgetInstance.enable();
                this.widgets.push(widgetInstance);
            });
        } catch (e) {
            log(`Error loading widgets: ${e}`);
        }
    }

    clearWidgets() {
        this.widgets.forEach(w => w.disable());
        this.widgets = [];
    }

    reloadWidgets() {
        this.clearWidgets();
        this.loadWidgets();
    }
}