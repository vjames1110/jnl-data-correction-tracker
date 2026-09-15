FROM node:20-alpine

WORKDIR /app

RUN npm install -g npm@11.6.2

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
