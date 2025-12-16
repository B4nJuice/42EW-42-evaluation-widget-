import HTMLParser from 'node-html-parser';
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
		const responsePath = path.join(__dirname, "response.html");
		fs.writeFileSync(responsePath, text, "utf8");
		text = fs.readFileSync("./message.html");
		const parsedHTML = HTMLParser.parse(text);
		const items = parsedHTML.querySelectorAll(
			"#collapseEvaluations .project-item"
		);

		const results = items.map(item => {
			const user = item.querySelector("a[data-user-link]")?.innerText;
			const dateSpan = item.querySelector("span[data-long-date]");

			return {
				user,
				date: dateSpan?.getAttribute("data-long-date"),
				displayDate: dateSpan?.text.trim()
			};
		});

		const evalPath = path.join(__dirname, "evaluations.json");
		let evaluationJson = [];
		if (fs.existsSync(evalPath)) {
			try {
				const raw = fs.readFileSync(evalPath, "utf8");
				evaluationJson = JSON.parse(raw) || [];
				if (!Array.isArray(evaluationJson)) evaluationJson = [];
			} catch (err) {
				evaluationJson = [];
			}
		}

		results.forEach(element => {
			if (!element.user && !element.date) return;

			const exists = evaluationJson.some(e =>
				e.user === element.user && e.date === element.date
			);

			if (!exists) {
				evaluationJson.push(element);
			}
		});

		// write back formatted JSON
		fs.writeFileSync(evalPath, JSON.stringify(evaluationJson, null, 2), "utf8");

	} catch (e) {
		console.log("[42EW] Fetch error: " + e.message);
	}
})()