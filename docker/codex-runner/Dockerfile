FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git ripgrep \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g @openai/codex

ENV CODEX_HOME=/home/node/.codex
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /workspace

COPY --chown=node:node entrypoint.sh /usr/local/bin/codex-runner
RUN chmod +x /usr/local/bin/codex-runner

USER node

ENTRYPOINT ["codex-runner"]
