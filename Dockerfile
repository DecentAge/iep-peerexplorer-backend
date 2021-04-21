FROM node:12

WORKDIR /app
COPY ./package.json ./
RUN npm install --silent
COPY . /app
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.8.0/wait /wait
RUN chmod +x /wait
#RUN npm run lint
EXPOSE 8992

CMD /wait && npm run start
