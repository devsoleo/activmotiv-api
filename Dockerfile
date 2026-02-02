FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install --quiet

COPY . .

RUN npm run build

FROM node:24-alpine AS production

WORKDIR /app

COPY ./package*.json .
COPY ./migrations ./migrations

RUN apk add --no-cache tzdata openssl
RUN npm install --quiet --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]