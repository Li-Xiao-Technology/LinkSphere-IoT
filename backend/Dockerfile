FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --only=production

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
