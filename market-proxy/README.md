# JMO Market Proxy

Cloudflare Worker proxy for Finnhub quotes.

The public visualizer calls this Worker; the Worker calls Finnhub with the private `FINNHUB_TOKEN` secret. The browser receives quote data only, never the API token.

## Required Secrets

- `FINNHUB_TOKEN`

## Deploy

```sh
npx wrangler secret put FINNHUB_TOKEN --config market-proxy/wrangler.toml
npx wrangler deploy --config market-proxy/wrangler.toml
```

After deploy, set `JMO_MARKET_PROXY_URL` in `stock-channel/config.js` to the Worker `/quotes` URL.
