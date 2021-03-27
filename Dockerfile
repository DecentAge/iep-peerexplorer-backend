FROM node:12
RUN mkdir -p /usr
WORKDIR /usr
COPY ./package.json /usr
RUN npm install --silent
COPY . /usr
#RUN npm run lint
EXPOSE 8992
ENTRYPOINT ["npm", "run"]
CMD ["start"]