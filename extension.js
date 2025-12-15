const { St, Clutter } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

class WidgetIndicator extends PanelMenu.Button {
  _init() {
    super._init(0.0, '42EW Widget');

    // label visible dans la barre
    this._label = new St.Label({
      text: '42EW',
      y_align: Clutter.ActorAlign.CENTER
    });
    this.add_child(this._label);

    // ajout d'un item de menu simple
    const item = new PopupMenu.PopupMenuItem('Dire Bonjour');
    item.connect('activate', () => {
      Main.notify('42EW Widget', 'Bonjour depuis le widget GNOME');
    });
    this.menu.addMenuItem(item);

    // applique le style défini dans styles.css
    this.add_style_class_name('widget-42ew');
  }

  setText(text) {
    this._label.text = text;
  }
}

let indicator = null;

function init() {
  // initialisation (vide)
}

function enable() {
  if (!indicator) {
    indicator = new WidgetIndicator();
    Main.panel.addToStatusArea('widget-42ew', indicator);

    // Indiquer visuellement et par notification que l'extension est activée
    try {
      indicator.setText('42EW (activé)');
    } catch (e) {
      // ignore si setText non disponible
    }
    Main.notify('42EW Widget', 'Extension activée');
    log('42EW Widget: enabled');
  }
}

function disable() {
  if (indicator) {
    Main.notify('42EW Widget', 'Extension désactivée');
    log('42EW Widget: disabled');

    indicator.destroy();
    indicator = null;
  }
}

// utilitaire simple pour vérifier l'état depuis d'autres scripts
function isEnabled() {
  return indicator !== null;
}
