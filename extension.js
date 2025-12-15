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
	_validateAndLoginIfNeeded();
	setInterval(() => {
		try
		{
			test();
		}
		catch (e)
		{
			log(`42EW ${e}`);
		}
	}, 5000);
}

function get_api_data_with_cookie(url, cookie, callback) {
    let session = new Soup.Session();
    let message = Soup.Message.new('GET', url);

    if (cookie) {
        message.request_headers.append('Cookie', cookie);
    }

    session.queue_message(message, (sess, msg) => {
        if (msg.status_code === 200) {
            try {
                let data = JSON.parse(msg.response_body.data);
                callback(null, data);
            } catch (e) {
                callback(new Error(`Failed to parse JSON: ${e.message}`));
            }
        } else if (msg.status_code === 401) {
            callback(new Error('Unauthorized: invalid/expired cookie'));
        } else {
            callback(new Error(`HTTP error ${msg.status_code}: ${msg.reason_phrase}`));
        }
    });
}

function _getCookieFilePath() {
    return GLib.build_filenamev([Me.path, 'utils', '.intra42_cookies.json']);
}

function _readCookieFile() {
    const candidates = [
        _getCookieFilePath(),
        GLib.build_filenamev([Me.path, '.intra42_cookies.json']),
        GLib.build_filenamev([GLib.get_home_dir(), '.intra42_cookies.json']),
    ];

    for (let i = 0; i < candidates.length; i++) {
        const path = candidates[i];
        try {
            // debug log pour savoir quel chemin on teste
            log(`[42EW] trying cookie file: ${path}`);
            let [ok, contents] = GLib.file_get_contents(path);
            if (!ok || !contents) {
                log(`[42EW] no contents at ${path}`);
                continue;
            }
            // contents est un Uint8Array / byteArray
            return imports.byteArray.toString(contents);
        } catch (e) {
            log(`[42EW] failed to read ${path}: ${e}`);
            // essayer le chemin suivant
        }
    }

    // aucun fichier lisible trouvé
    return null;
}

function _parseCookieFromFileContent(content) {
    // Supporte JSON export (array d'objets) ou chaîne brute
    try {
        const obj = JSON.parse(content);
        // JSON export attendu : { cookies: [...] } ou array [...]
        let arr = Array.isArray(obj) ? obj : obj.cookies || [];
        if (!Array.isArray(arr)) return null;
        // construire "name=value; name2=value2"
        const parts = arr.map(c => {
            if (c.name && c.value) return `${c.name}=${c.value}`;
            // parfois cookie field different, fallback:
            return null;
        }).filter(Boolean);
        if (parts.length) return parts.join('; ');
        return null;
    } catch (e) {
        // not json => assume raw cookie string
        return content.trim() || null;
    }
}

function _checkCookieValidity(cookieValue, callback) {
    // Request vers un endpoint web qui accepte les cookies de session
    const url = `https://translate.intra.42.fr/users/${username}/locations_stats.json`;
    let session = new Soup.Session();
    let message = Soup.Message.new('GET', url);
    message.request_headers.append('Cookie', cookieValue);

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
    _label.set_text('Connecté');
    _label.set_style('color: #10b981; font-weight: 600;');

    // exemple : récupérer /v2/me via cookie (ou utiliser un endpoint html autorisé)
    get_api_data_with_cookie('https://api.intra.42.fr/v2/me', cookieValue, (err, data) => {
        if (!err && data) {
            log(`[42EW] user via cookie: ${JSON.stringify(data)}`);
        } else {
            // si l'API v2 nécessite OAuth, la requête peut échouer -> utiliser endpoints web avec cookie
            log(`[42EW] get_api_data_with_cookie error: ${err && err.message}`);
        }
    });
}

function _validateAndLoginIfNeeded() {
    _label.set_text('Vérification cookie...');
    _label.set_style('color: #f59e0b; font-weight: 600;');

    const raw = _readCookieFile();
    if (!raw) {
        // pas de fichier -> lancer capture
        _executeCookieCapture();
        _checkCookieFileRepeatedly();
		log("[42EW] error when getting raw t'as capté ou pas ??");
        return;
    }

    const cookie = _parseCookieFromFileContent(raw);
    if (!cookie) {
        _executeCookieCapture();
        _checkCookieFileRepeatedly();
		log("[42EW] error when getting cookie t'as capté ou pas ??");
        return;
    }

    _checkCookieValidity(cookie, (valid) => {
        if (valid) {
            log('[42EW] cookie valide détecté');
            _useCookie(cookie);
        } else {
            log('[42EW] cookie invalide -> relancer capture');
            _executeCookieCapture();
            _checkCookieFileRepeatedly();
        }
    });
}

function _checkCookieFileRepeatedly() {
    let attempts = 0;
    const maxAttempts = 120; // 4 minutes
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
                // stop loop here; validation callback gère la suppression du timeout
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

function test() {
    // si on a déjà un cookie de session, privilégier la requête avec cookie
    if (_intraCookie) {
        get_api_data_with_cookie('https://api.intra.42.fr/v2/me', _intraCookie, (err, data) => {
            if (!err && data) {
                log(`[42EW] user via cookie: ${JSON.stringify(data)}`);
                try {
                    const dataPath = GLib.build_filenamev([Me.path, 'data.json']);
                    GLib.file_set_contents(dataPath, JSON.stringify(data, null, 2));
                } catch (e) {
                    log(`[42EW] failed to save data: ${e}`);
                }
            } else {
                log(`[42EW] cookie request failed: ${err && err.message}`);
            }
        });
        return;
    }

    // otherwise try to get an access token
    if (!Connect || !Connect.get_access_token) {
        log('[42EW] Connect.get_access_token not available');
        return;
    }

    Connect.get_access_token(CLIENT_ID, CLIENT_SECRET, (a, b) => {
        // adapter à la signature possible : (token) ou (err, token)
        let token = (typeof b === 'undefined') ? a : b;
        let err = (typeof b === 'undefined') ? null : a;

        if (err) {
            log(`[42EW] token error: ${err}`);
            return;
        }
        if (!token) {
            log('[42EW] no token received');
            return;
        }

        const apiUrl = 'https://api.intra.42.fr/v2/me';
        get_api_data(apiUrl, token, (data) => {
            if (data === 401) {
                log('[42EW] Unauthorized: token invalid/expired');
                return;
            }
            if (!data) {
                log('[42EW] empty response from API');
                return;
            }
            log(`[42EW] ${JSON.stringify(data)}`);
            try {
                const dataPath = GLib.build_filenamev([Me.path, 'data.json']);
                GLib.file_set_contents(dataPath, JSON.stringify(data, null, 2));
            } catch (e) {
                log(`[42EW] failed to save data: ${e}`);
            }
        });
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