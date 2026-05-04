const http = require('node:http');

const PORT = Number(process.env.PORT || 8080);
const OUTBOUND_HOST = 'cookie.test';

function getHeaderValues(rawHeaders, headerName) {
  const values = [];

  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index].toLowerCase() === headerName.toLowerCase()) {
      values.push(rawHeaders[index + 1]);
    }
  }

  return values;
}

function requestOutboundCookieSource(requestId, browserCookieHeader) {
  return new Promise((resolve, reject) => {
    const upstreamRequest = http.request(
      {
        host: OUTBOUND_HOST,
        method: 'GET',
        path: `/issue-cookie?requestId=${encodeURIComponent(requestId)}`,
        headers: {
          accept: 'application/json',
          cookie: [
            `container_request_id=${requestId}`,
            `browser_cookie_header_present=${browserCookieHeader ? 'yes' : 'no'}`,
          ].join('; '),
          'x-container-request-id': requestId,
        },
      },
      (upstreamResponse) => {
        const chunks = [];

        upstreamResponse.on('data', (chunk) => {
          chunks.push(chunk);
        });

        upstreamResponse.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf8');
          let parsedBody = bodyText;

          try {
            parsedBody = JSON.parse(bodyText);
          } catch {
            // Keep the raw body when the handler returns non-JSON.
          }

          resolve({
            statusCode: upstreamResponse.statusCode,
            headers: upstreamResponse.headers,
            rawHeaders: upstreamResponse.rawHeaders,
            setCookieHeadersSeenByContainer: getHeaderValues(
              upstreamResponse.rawHeaders,
              'set-cookie',
            ),
            body: parsedBody,
          });
        });
      },
    );

    upstreamRequest.on('error', reject);
    upstreamRequest.end();
  });
}

const server = http.createServer(async (request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
    return;
  }

  const requestId = crypto.randomUUID();

  try {
    const outboundResult = await requestOutboundCookieSource(
      requestId,
      request.headers.cookie || '',
    );

    const result = {
      message: 'Container completed outbound request through outboundByHost.',
      requestId,
      container: {
        inboundMethod: request.method,
        inboundUrl: request.url,
        inboundCookieHeaderFromBrowser: request.headers.cookie || null,
      },
      outboundRequest: {
        url: `http://${OUTBOUND_HOST}/issue-cookie?requestId=${requestId}`,
        host: OUTBOUND_HOST,
      },
      outboundResponseSeenByContainer: outboundResult,
      cookieSuppressionCheck: {
        setCookieHeaderCountSeenByContainer:
          outboundResult.setCookieHeadersSeenByContainer.length,
        setCookieHeadersWereVisibleToContainer:
          outboundResult.setCookieHeadersSeenByContainer.length > 0,
      },
    };

    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    response.writeHead(502, {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(
      `${JSON.stringify(
        {
          message: 'Container outbound request failed.',
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      )}\n`,
    );
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`cookie suppression test container listening on ${PORT}`);
});
