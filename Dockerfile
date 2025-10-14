# Use official Node 18 image
FROM node:18

# Set working directory inside container
WORKDIR /usr/src/app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm install

# Install nodemon globally for auto-reload
RUN npm install -g nodemon

# Copy source code
COPY . .

# Expose backend port
EXPOSE 5000

# Default command - use nodemon for dev
CMD ["npm", "run", "dev"]
