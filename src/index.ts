import { Container, ContainerProxy, getContainer } from '@cloudflare/containers'
import { Hono } from 'hono'

type Bindings = {
  OUTBOUND_TEST_CONTAINER: DurableObjectNamespace<OutboundCookieContainer>
}

const TEST_CONTAINER_NAME = 'cookie-suppression-lab'
const OUTBOUND_TEST_HOST = 'cookie.test'

export class OutboundCookieContainer extends Container<Bindings> {
  defaultPort = 8080
  requiredPorts = [8080]
  sleepAfter = '5m'
  enableInternet = false
  allowedHosts = [OUTBOUND_TEST_HOST]
}

OutboundCookieContainer.outboundByHost = {
  [OUTBOUND_TEST_HOST]: async (request, _env, ctx) => {
    const url = new URL(request.url)
    const cookiesIssuedByHandler = [
      `outbound_handler_session=${crypto.randomUUID()}; Path=/; HttpOnly; SameSite=Lax`,
      'outbound_handler_visible=visible-from-outbound-handler; Path=/; SameSite=Lax',
    ]

    const headers = new Headers({
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-outbound-handler': OUTBOUND_TEST_HOST,
      'x-container-id': ctx.containerId,
    })

    for (const cookie of cookiesIssuedByHandler) {
      headers.append('set-cookie', cookie)
    }

    return new Response(
      JSON.stringify(
        {
          handledBy: 'OutboundCookieContainer.outboundByHost',
          host: url.host,
          path: url.pathname,
          search: url.search,
          containerId: ctx.containerId,
          cookieHeaderReceivedFromContainer: request.headers.get('cookie'),
          cookiesIssuedByHandler,
        },
        null,
        2,
      ),
      { headers },
    )
  },
}

export { ContainerProxy }

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cloudflare Container Cookie Suppression Test</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: #f6f7f9;
        color: #17202a;
      }
      main {
        width: min(960px, calc(100% - 32px));
        margin: 0 auto;
        padding: 40px 0;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 30px;
        line-height: 1.15;
      }
      p {
        margin: 0 0 20px;
        color: #52606d;
        line-height: 1.55;
      }
      button {
        border: 0;
        border-radius: 6px;
        background: #146ef5;
        color: white;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        padding: 11px 16px;
      }
      button:disabled {
        cursor: wait;
        opacity: 0.65;
      }
      pre {
        min-height: 260px;
        margin-top: 20px;
        overflow: auto;
        border: 1px solid #d6dbe1;
        border-radius: 8px;
        background: #101820;
        color: #d7f7ff;
        padding: 18px;
        font-size: 13px;
        line-height: 1.55;
      }
      code {
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Cloudflare Container Cookie Suppression Test</h1>
      <p>
        The browser calls this Worker, the Worker forwards to a Cloudflare Container,
        and the container calls <code>http://${OUTBOUND_TEST_HOST}</code>. That virtual host
        is intercepted by <code>outboundByHost</code>, which returns <code>Set-Cookie</code>
        headers back to the container.
      </p>
      <button id="run" type="button">Run outbound cookie test</button>
      <pre id="output">Click the button to run the test.</pre>
    </main>
    <script>
      const button = document.querySelector('#run');
      const output = document.querySelector('#output');

      button.addEventListener('click', async () => {
        button.disabled = true;
        output.textContent = 'Starting container and running outbound request...';

        try {
          const response = await fetch('/test', { credentials: 'include' });
          const text = await response.text();
          output.textContent = text;
        } catch (error) {
          output.textContent = String(error && error.stack ? error.stack : error);
        } finally {
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`)
})

app.all('/test', (c) => {
  const container = getContainer(c.env.OUTBOUND_TEST_CONTAINER, TEST_CONTAINER_NAME)
  return container.fetch(c.req.raw)
})

export default app
