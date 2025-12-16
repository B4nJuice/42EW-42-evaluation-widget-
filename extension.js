const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Me = ExtensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const Calendar = imports.ui.calendar;
const PopupMenu = imports.ui.popupMenu;
const Soup = imports.gi.Soup;
const St = imports.gi.St;
const ByteArray = imports.byteArray;

const { Connect } = Me.imports.connect.connect;

let _indicator = null;
let _label = null;
let _cookieCheckTimeoutId = null;
let _intraCookie = null;
const username = GLib.get_user_name();

function init() {
}

function enable() {
	_indicator = new PanelMenu.Button(0.0, 'no evaluation', false);

	const box = new St.BoxLayout({
		vertical: false,
		x_expand: true,
		x_align: Clutter.ActorAlign.CENTER,
		y_align: Clutter.ActorAlign.CENTER,
		style_class: 'bonjour-box',
	});

	_label = new St.Label({
		text: 'no evaluation',
		style: 'font-weight: 600; color: #ffffff;',
		x_align: Clutter.ActorAlign.CENTER,
	});

	box.add_child(_label);
	_indicator.add_child(box);

	Main.panel.addToStatusArea('42EW@B4nJuice', _indicator, 0, 'center');

	const menuItem = new PopupMenu.PopupMenuItem('Open Login Window');
	menuItem.connect('activate', () => {
		_executeCookieCapture();
	});
	_indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	_indicator.menu.addMenuItem(menuItem);

	log("[42EW] widget loaded");
	_validateAndLoginIfNeeded();
	_updateLabelFromEvaluations();
	setInterval(() => {
		try
		{
			test();
			_updateLabelFromEvaluations();
		}
		catch (e)
		{
			log(`[42EW] ${e}`);
		}
	}, 30000);
}

function _getCookieFilePath() {
    return GLib.build_filenamev([Me.path, 'utils', '.intra42_cookies.json']);
}

function _readCookieFile() {
    const path = _getCookieFilePath();
    try {
        try {
            const gfile = Gio.File.new_for_path(path);
            const info = gfile.query_info('standard::size,unix::mode,unix::uid', Gio.FileQueryInfoFlags.NONE, null);
            const size = info.get_size();
            let mode = null, uid = null;
            try { mode = info.get_attribute_uint32('unix::mode'); } catch(e) { mode = null; }
            try { uid = info.get_attribute_uint32('unix::uid'); } catch(e) { uid = null; }
        } catch (e) {
        }

        let [ok, contents] = GLib.file_get_contents(path);
        if (!ok) {
            return null;
        }
        if (!contents || contents.length === 0) {
            return null;
        }
        const str = imports.byteArray.toString(contents);
        return str;
    } catch (e) {
        return null;
    }
}

function _parseCookieFromFileContent(content) {
    try {
        const obj = JSON.parse(content);
        let arr = Array.isArray(obj) ? obj : obj.cookies || [];
        if (!Array.isArray(arr)) return null;
        const parts = arr.map(c => {
            if (c.name && c.value) return `${c.name}=${c.value}`;
            return null;
        }).filter(Boolean);
        if (parts.length) return parts.join('; ');
        return null;
    } catch (e) {
        return content.trim() || null;
    }
}

function _checkCookieValidity(cookieValue, callback) {
    const url = `https://translate.intra.42.fr/users/${username}/locations_stats.json`;
    let session = new Soup.Session();
    let message = Soup.Message.new('GET', url);
    message.request_headers.append('Cookie', `_intra_42_session_production=${cookieValue}`);

    session.queue_message(message, (sess, msg) => {
        if (msg.status_code === 200) {
            callback(true);
        } else {
            callback(false);
        }
    });
}

function _useCookie(cookieValue) {
    _intraCookie = cookieValue;
    _label.set_text('Connected');
    _label.set_style('color: #10b981; font-weight: 600;');
}

function _validateAndLoginIfNeeded() {
    _label.set_text('Checking cookie...');
    _label.set_style('color: #f59e0b; font-weight: 600;');

    const raw = _readCookieFile();
    if (!raw) {
        _executeCookieCapture();
        _checkCookieFileRepeatedly();
		log("[42EW] error when getting raw");
        return;
    }

    const cookie = _parseCookieFromFileContent(raw);
    if (!cookie) {
        _executeCookieCapture();
        _checkCookieFileRepeatedly();
		log("[42EW] error when getting cookie");
        return;
    }

    _checkCookieValidity(cookie, (valid) => {
        if (valid) {
            log('[42EW] valid cookie detected');
            _useCookie(cookie);
        } else {
            log('[42EW] invalid cookie -> restarting capture');
            _executeCookieCapture();
            _checkCookieFileRepeatedly();
        }
    });
}

function _checkCookieFileRepeatedly() {
    let attempts = 0;
    const maxAttempts = 120;
    if (_cookieCheckTimeoutId) {
        GLib.source_remove(_cookieCheckTimeoutId);
        _cookieCheckTimeoutId = null;
    }
    _cookieCheckTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
        attempts++;
        const raw = _readCookieFile();
        if (raw) {
            const cookie = _parseCookieFromFileContent(raw);
            if (cookie) {
                _checkCookieValidity(cookie, (valid) => {
                    if (valid) {
                        _useCookie(cookie);
                        if (_cookieCheckTimeoutId) {
                            GLib.source_remove(_cookieCheckTimeoutId);
                            _cookieCheckTimeoutId = null;
                        }
                    } else if (attempts >= maxAttempts) {
                        _label.set_text('Login timeout');
                        _label.set_style('color: #ef4444; font-weight: 600;');
                        GLib.source_remove(_cookieCheckTimeoutId);
                        _cookieCheckTimeoutId = null;
                    }
                });
                return GLib.SOURCE_REMOVE;
            }
        }
        if (attempts >= maxAttempts) {
            _label.set_text('Login timeout');
            _label.set_style('color: #ef4444; font-weight: 600;');
            _cookieCheckTimeoutId = null;
            return GLib.SOURCE_REMOVE;
        }
        return GLib.SOURCE_CONTINUE;
    });
}

function _updateLabelFromEvaluations() {
    const evalPath = GLib.build_filenamev([Me.path, 'evaluations.json']);
    try {
        let [ok, contents] = GLib.file_get_contents(evalPath);
        if (!ok || !contents) {
            _label.set_text('no evaluation');
            _label.set_style('color: #ffffff; font-weight: 600;');
            return;
        }
        const str = imports.byteArray.toString(contents);
        let arr = [];
        try {
            arr = JSON.parse(str);
            if (!Array.isArray(arr)) arr = [];
        } catch (e) {
            arr = [];
        }
        if (arr.length === 0) {
            _label.set_text('no evaluation');
            _label.set_style('color: #ffffff; font-weight: 600;');
            return;
        }
        let minEntry = null;
        let minTime = Infinity;
        for (let i = 0; i < arr.length; i++) {
            const e = arr[i];
            if (!e || !e.date) continue;
            const t = Date.parse(e.date);
            if (isNaN(t)) continue;
            if (t < minTime) {
                minTime = t;
                minEntry = e;
            }
        }
        if (!minEntry) {
            _label.set_text('no evaluation');
            _label.set_style('color: #ffffff; font-weight: 600;');
            return;
        }
        const now = Date.now();
        let diffMin = Math.round((minTime - now) / 60000);
        const user = minEntry.user || 'unknown';
		if (diffMin < 0)
		{
			_label.set_text(`evaluation with "${user}" ${diffMin} min ago !`);
        	_label.set_style('color: #b91010ff; font-weight: 600;');
		}
		else
		{
			_label.set_text(`evaluation with "${user}" in ${diffMin} min`);
			_label.set_style('color: #10b981; font-weight: 600;');
		}
    } catch (e) {
        _label.set_text('no evaluation');
        _label.set_style('color: #ffffff; font-weight: 600;');
    }
}

function test() {
    if (_intraCookie) {
		GLib.spawn_command_line_async(
			`node .local/share/gnome-shell/extensions/42EW@B4nJuice/fetch.js ${_intraCookie}`
		);
    }

    if (!Connect || !Connect.get_access_token) {
        log('[42EW] Connect.get_access_token not available');
        return;
    }
}

function get_api_data(url, token, callback) {
	let session = new Soup.Session();
	let message = Soup.Message.new('GET', url);

	message.request_headers.append('Authorization', `Bearer ${token}`);

	session.queue_message(message, (sess, msg) => {
		if (msg.status_code === 200) {
			try {
				let data = JSON.parse(msg.response_body.data);
				callback(data);
			} catch (e) {
				log(`Failed to parse JSON: ${e.message}`);
			}
		} else if (msg.status_code === 401) {
			log(`Unauthorized: Invalid or expired token.`);
			callback(401);
		} else {
			log(`HTTP error ${msg.status_code}: ${msg.reason_phrase}`);
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