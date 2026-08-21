FROM node:20-slim
WORKDIR /app
COPY package.json /app/package.json
RUN npm install
COPY . /app
CMD ["npm", "run", "dev"]
