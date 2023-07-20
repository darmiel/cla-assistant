# SPDX-FileCopyrightText: 2022 SAP SE or an SAP affiliate company and CLA-assistant contributors
#
# SPDX-License-Identifier: Apache-2.0

FROM --platform=linux/amd64 node:16-alpine

EXPOSE 5000

RUN addgroup -S cla-assistant
RUN adduser -S -D -G cla-assistant cla-assistant

COPY . /cla-assistant
WORKDIR /cla-assistant

RUN npm install
RUN npm run build
RUN npm prune --production

USER cla-assistant

CMD ["npm", "run", "start"]
