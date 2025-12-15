import fs from "fs";

const url = "https://profile.intra.42.fr/";
const cookie = process.argv[2];
let text = '';

(async () => {
try {
	let response = await fetch(url, {
		method: "GET",
		headers: {
			"Cookie": `_intra_42_session_production=${cookie}`,
			"User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:146.0) Gecko/20100101 Firefox/146.0",
			"Accept": "text/html"
		}
	});

	text = await response.text();
	fs.writeFileSync("~/.local/share/gnome-shell/extensions/42EW@B4nJuice/response.html", text, "utf8");
	console.log(`[42EW] \n ${text}`);
} catch (e) {
	console.log("[42EW] Fetch error: " + e.message);
}
})()