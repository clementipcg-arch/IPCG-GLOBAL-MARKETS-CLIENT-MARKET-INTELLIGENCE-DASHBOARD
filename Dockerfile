# IPCG Global Markets – production image (no runtime npm dependencies)
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY config ./config
COPY public ./public
COPY scripts/demo-data.js ./scripts/demo-data.js
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/robots.txt >/dev/null || exit 1
CMD ["node", "server/index.js"]
