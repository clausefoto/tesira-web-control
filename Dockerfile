FROM node:24-alpine
LABEL org.opencontainers.image.source="https://github.com/clausefoto/tesira-web-control" \
      org.opencontainers.image.description="Mobile web volume control for Biamp Tesira DSPs" \
      org.opencontainers.image.licenses="MIT"
RUN apk add --no-cache su-exec
WORKDIR /app
COPY --chown=node:node package.json server.js ttp.js settings.js ./
COPY --chown=node:node public ./public
COPY docker-entrypoint.sh /usr/local/bin/tesira-entrypoint
RUN chmod 755 /usr/local/bin/tesira-entrypoint && mkdir -p /data && chown node:node /data
VOLUME /data
ENV PORT=8088 SETTINGS_FILE=/data/settings.json
EXPOSE 8088
ENTRYPOINT ["tesira-entrypoint"]
CMD ["node", "server.js"]
