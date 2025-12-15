const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const ExtensionUtils = imports.misc.extensionUtils;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;


const Me = ExtensionUtils.getCurrentExtension();

const { Debug } = Me.imports.utils.debug;

let _indicator = null;
let _label = null;

function init() {
	// minimal
}

function enable() {
	_indicator = new PanelMenu.Button(0.0, 'Bonjour', false);

	const box = new St.BoxLayout({
		vertical: false,
		x_expand: true,
		x_align: Clutter.ActorAlign.CENTER,
		y_align: Clutter.ActorAlign.CENTER,
		style_class: 'bonjour-box',
	});

	_label = new St.Label({
		text: 'Bonjour',
		style: 'font-weight: 600; color: #ffffff;',
		x_align: Clutter.ActorAlign.CENTER,
	});

	box.add_child(_label);
	_indicator.add_child(box);

	// add to center of panel
	Main.panel.addToStatusArea('42EW@B4nJuice', _indicator, 0, 'center');

	// add menu item to manually open login window
	const menuItem = new PopupMenu.PopupMenuItem('Open Login Window');
	menuItem.connect('activate', () => {
		_executeCookieCapture();
	});
	_indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	_indicator.menu.addMenuItem(menuItem);

	// automatically open login window on enable
	log("[42EW] widget chargé");
	_executeCookieCapture();
	Connect.get_access_token(CLIENT_ID, CLIENT_SECRET, (token) => {
		if (token) {
			const apiUrl = `https://api.intra.42.fr/v2/me`;
			get_api_data(apiUrl, token, (data)=> {
				log(JSON.stringify(data));
			});
		}
	});
}

function get_api_data(url, token, callback) {
	let session = new Soup.Session();
	let message = Soup.Message.new('GET', url);

	message.request_headers.append('Authorization', `Bearer ${token}`);

	session.queue_message(message, (sess, msg) => {
		if (msg.status_code === 200) {
			try {
				let data = JSON.parse(msg.response_body.data);
				Debug.logSuccess(`Received JSON data:\n${JSON.stringify(data, null, 2)}`);
				callback(data);
			} catch (e) {
				Debug.logError(`Failed to parse JSON: ${e.message}`);
			}
		} else if (msg.status_code === 401) {
			Debug.logError(`Unauthorized: Invalid or expired token.`);
			callback(401);
		} else {
			Debug.logError(`HTTP error ${msg.status_code}: ${msg.reason_phrase}`);
		}
	});
}

function disable() {
	if (_indicator) {
		_indicator.destroy();
		_indicator = null;
		_label = null;
	}
}

function _executeCookieCapture() {
	_label.set_text('Opening login window...');
	_label.set_style('color: #3b82f6; font-weight: 600;');

	// script located inside the extension folder: connect/capture_cookies.py
	const scriptPath = GLib.build_filenamev([Me.path, 'connect', 'capture_cookies.py']);
	const scriptFile = Gio.File.new_for_path(scriptPath);

	if (!scriptFile.query_exists(null)) {
		_label.set_text('Login script not found');
		_label.set_style('color: #ef4444; font-weight: 600;');
		log(`Login script not found at: ${scriptPath}`);
		return;
	}

	try {
		const argv = ['python3', scriptPath];
		let [success, pid] = GLib.spawn_async(
			null,
			argv,
			null,
			GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
			null
		);

		if (success) {
			_label.set_text('Login in progress...');
			_label.set_style('color: #3b82f6; font-weight: 600;');

			GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status) => {
				log(`Cookie capture process exited with status ${status}`);
				try {
					GLib.spawn_close_pid(pid);
				} catch (e) {
					// ignore
				}
			});
		} else {
			_label.set_text('Failed to start login');
			_label.set_style('color: #ef4444; font-weight: 600;');
			log('Failed to spawn cookie capture script');
		}
	} catch (e) {
		_label.set_text('Login Failed');
		_label.set_style('color: #ef4444; font-weight: 600;');
		log(`Failed to execute cookie capture: ${e}`);
	}
}