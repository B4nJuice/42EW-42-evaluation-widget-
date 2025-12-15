const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const Main = imports.ui.main;

let _indicator = null;

function init() {
	// no initialization required for this minimal extension
}

function enable() {
	// create a simple panel button that shows "Bonjour"
	_indicator = new PanelMenu.Button(0.0, 'Bonjour', false);

	const label = new St.Label({
		text: 'Bonjour',
		style: 'font-weight: 600; color: #ffffff;'
	});

	_indicator.add_child(label);
	Main.panel.addToStatusArea('42EW@B4nJuice', _indicator);
}

function disable() {
	if (_indicator) {
		_indicator.destroy();
		_indicator = null;
	}
}
