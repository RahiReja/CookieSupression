## The Code is written with AI but the bug is actually there. It is just a reproducable example.

## Cloudflare Container outbound cookie test

This app starts a Cloudflare Container and forwards `/test` to it. The container
then makes an outbound HTTP request to `http://cookie.test/issue-cookie`.
`cookie.test` is intercepted by `OutboundCookieContainer.outboundByHost`, which
returns JSON plus two `Set-Cookie` headers back to the container.

The container responds to the browser with JSON showing whether those
`Set-Cookie` headers were visible from inside the container. A suppressed
result should look like this:

```json
{
  "cookieSuppressionCheck": {
    "setCookieHeaderCountSeenByContainer": 0,
    "setCookieHeadersWereVisibleToContainer": false
  }
}
```

## Run locally

Cloudflare Containers local development requires Docker or a compatible local
container engine.

```txt
pnpm install
pnpm run dev
```

Open the Wrangler dev URL and click **Run outbound cookie test**.

## Deploy

```txt
pnpm run deploy
```

After changing `wrangler.jsonc`, regenerate Worker runtime types:

```txt
pnpm run cf-typegen
```
