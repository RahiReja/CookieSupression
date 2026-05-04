FROM node:22-slim

WORKDIR /app

COPY container/server.js ./server.js

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
