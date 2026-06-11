# Multi-stage Dockerfile for FlowForge
# Stage 1: Build backend dependencies
FROM composer:2.8 AS backend-builder

WORKDIR /app

# Copy composer files
COPY composer.json composer.lock ./

# Install dependencies (including dev for build)
RUN composer install \
    --no-interaction \
    --no-plugins \
    --no-scripts \
    --prefer-dist \
    --optimize-autoloader \
    --no-dev

# Stage 2: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Stage 3: Production application
FROM php:8.3-fpm-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libzip-dev \
    zip \
    unzip \
    postgresql-client \
    icu-dev \
    oniguruma-dev

# Install PHP extensions
RUN docker-php-ext-configure zip \
    && docker-php-ext-install pdo_pgsql pdo_mysql zip exif pcntl mbstring gd intl bcmath opcache

# Install Redis extension
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps

# Install Composer
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY . .

# Copy backend dependencies from builder
COPY --from=backend-builder /app/vendor/ ./vendor/

# Copy frontend build from frontend builder
COPY --from=frontend-builder /app/dist/ ./public/

# Set proper permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html/storage \
    && chmod -R 755 /var/www/html/bootstrap/cache

# Generate application key
RUN apk add --no-cache php83-peast && composer install --working-dir=/var/www/html --no-dev
RUN php artisan key:generate
RUN php artisan config:cache
RUN php artisan route:cache
RUN php artisan view:cache

# Expose port 9000 for PHP-FPM
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD php-fpm-healthcheck || exit 1

# Start PHP-FPM
CMD ["php-fpm"]