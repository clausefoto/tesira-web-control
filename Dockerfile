FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json server.js ttp.js ./
COPY --chown=node:node public ./public
USER node
ENV PORT=8088
EXPOSE 8088
CMD ["node", "server.js"]
