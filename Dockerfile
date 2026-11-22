FROM node:24-alpine
WORKDIR /app
COPY server.mjs package.json ./
ENV DATA_DIR=/data
CMD ["node", "server.mjs"]
