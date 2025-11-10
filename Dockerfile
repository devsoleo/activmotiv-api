FROM node:24-alpine

WORKDIR /app

COPY . .

RUN apk add --no-cache tzdata
RUN apk add --no-cache openssl && npm install --quiet --production

EXPOSE 3000 
ENV NODE_ENV=production

CMD ["npm", "start"]