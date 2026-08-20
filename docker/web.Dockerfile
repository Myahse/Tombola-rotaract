FROM node:22-alpine AS build
WORKDIR /src
ARG APP=frontend
ARG VITE_API_URL=
ARG VITE_WS_URL=
ARG VITE_PUBLIC_SITE=
ARG VITE_PLATFORM_DOMAIN=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_PUBLIC_SITE=$VITE_PUBLIC_SITE
ENV VITE_PLATFORM_DOMAIN=$VITE_PLATFORM_DOMAIN
COPY ${APP}/package.json ${APP}/package-lock.json* ./${APP}/
RUN npm install --prefix ${APP}
COPY ${APP} ./${APP}
RUN npm run build --prefix ${APP} && mv ${APP}/dist /out

FROM nginx:1.27-alpine
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out /usr/share/nginx/html
