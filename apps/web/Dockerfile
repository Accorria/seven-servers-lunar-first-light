FROM node:22-slim
WORKDIR /app
COPY apps/web /app
ARG SCIENCE_ORIGIN=
ENV SCIENCE_ORIGIN=$SCIENCE_ORIGIN
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
