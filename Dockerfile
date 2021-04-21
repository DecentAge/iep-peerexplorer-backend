FROM node:12
RUN mkdir -p /usr
WORKDIR /usr
COPY ./package.json /usr
RUN npm install --silent
COPY . /usr
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.8.0/wait /wait
RUN chmod +x /wait
#RUN npm run lint
EXPOSE 8992

CMD /wait && npm run start
