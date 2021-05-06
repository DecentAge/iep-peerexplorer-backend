FROM node:12
WORKDIR /app
COPY ./package.json /app
RUN npm install --silent
COPY . /app
RUN npm run-script update-version --release_version=$(cat release-version.txt) 
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.8.0/wait /wait
RUN chmod +x /wait
#RUN npm run lint
EXPOSE 8992
CMD /wait && npm run start