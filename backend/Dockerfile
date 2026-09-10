FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY . .
EXPOSE 5050
CMD ["node", "server.js"]
