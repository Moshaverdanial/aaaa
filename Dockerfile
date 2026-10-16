FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
ENV NODE_ENV=production PORT=3000 DAL_DATA_DIR=/data TRUST_PROXY=1
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/meta >/dev/null || exit 1
CMD ["node", "--no-warnings", "server/index.js"]
