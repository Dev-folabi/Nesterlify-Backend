ARG NODE_VERSION=20.13.1

# Use node image for base image for all stages.
FROM node:${NODE_VERSION}-alpine as base

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire project
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose the port your app runs on
EXPOSE 8081

# Start the app
CMD ["npm", "start"]
