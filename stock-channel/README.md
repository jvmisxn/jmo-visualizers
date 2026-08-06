# JMO Market Scan

Weather Channel-style market visualizer for OBS browser sources.

Open `index.html` directly or use the hosted GitHub Pages path once deployed:

`https://jvmisxn.github.io/jmo-visualizers/stock-channel/`

The visualizer works without credentials by using a realistic local tick simulation. To enable Finnhub WebSocket trades, open it once with:

`#finnhub=YOUR_TOKEN`

The token is stored in browser localStorage for that OBS/browser profile. Use `#token=YOUR_TOKEN` as a shorter alias. Query params still work for compatibility, but the hash form is preferred because it is not sent to GitHub Pages as part of the HTTP request.
