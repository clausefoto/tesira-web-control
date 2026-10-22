FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json server.js ttp.js settings.js ./
COPY --chown=node:node public ./public
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
ENV PORT=8088 SETTINGS_FILE=/data/settings.json
EXPOSE 8088
CMD ["node", "server.js"]
