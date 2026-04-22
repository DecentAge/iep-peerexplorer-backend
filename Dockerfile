FROM node:22-alpine3.21 AS builder
WORKDIR /app
COPY ./package.json /app
RUN apk add --no-cache --virtual .gyp python3 make g++
RUN npm install
COPY . /app
RUN npm run-script update-version --release_version=$(cat release-version.txt)
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.12.1/wait /app
RUN chmod +x /app/wait

FROM node:22-alpine3.21
WORKDIR /app
RUN apk add --no-cache bash
COPY --from=builder /app /app

EXPOSE 8992
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD /app/wait && npm run start
