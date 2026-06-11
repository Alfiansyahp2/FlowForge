# FlowForge Docker Setup Guide

Complete Docker containerization setup for FlowForge multi-tenant workflow orchestration platform.

## 🚀 Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 10GB disk space

### Basic Setup

1. **Clone and navigate to project:**
```bash
cd /path/to/flowforge
```

2. **Create environment file:**
```bash
cp .env.example .env
```

3. **Generate application key:**
```bash
php artisan key:generate
```

4. **Build and start services:**
```bash
make build
make up
```

5. **Run migrations:**
```bash
make migrate
make seed
```

6. **Access application:**
- **Frontend**: http://localhost:8000
- **API**: http://localhost:8000/api
- **Horizon Dashboard**: http://localhost:8080/horizon

## 🛠️ Available Services

### Development Stack
- **app** - Laravel PHP-FPM application
- **nginx** - Nginx web server
- **postgres** - PostgreSQL 16 database
- **redis** - Redis cache & queue
- **horizon** - Laravel Horizon queue dashboard
- **scheduler** - Laravel task scheduler
- **reverb** - Laravel Reverb WebSocket server

### Production Stack (Additional)
- **prometheus** - Metrics collection
- **grafana** - Monitoring dashboard

## 📋 Make Commands

### Development
```bash
make build        # Build containers
make up           # Start services
make down         # Stop services
make restart      # Restart services
make logs         # View logs
make shell        # Open app shell
```

### Database
```bash
make migrate      # Run migrations
make seed         # Seed database
make fresh        # Fresh installation
make db-fresh     # Migrate fresh with seed
make backup       # Backup database
```

### Testing & Quality
```bash
make test         # Run test suite
make cache        # Cache configuration
make clear        # Clear caches
```

### Production
```bash
make prod         # Start production stack
make monitor      # Start monitoring stack
make status       # Check service status
make stats        # Container resource usage
```

## 🔧 Configuration

### Environment Variables

Create `.env` file with:

```env
# Application
APP_NAME=FlowForge
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:your-generated-key
APP_URL=http://localhost:8000

# Database
DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=flowforge
DB_USERNAME=flowforge
DB_PASSWORD=your-secure-password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Laravel Reverb
REVERB_APP_ID=your-app-id
REVERB_APP_KEY=your-app-key
REVERB_APP_SECRET=your-app-secret

# Monitoring (Optional)
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

### Production Deployment

1. **Update environment for production:**
```bash
cp .env.example .env
# Edit .env with production values
```

2. **Build and start production stack:**
```bash
make prod
```

3. **Enable monitoring (optional):**
```bash
make monitor
```

## 🐛 Troubleshooting

### Container Issues

**Permission errors:**
```bash
sudo chown -R $USER:$USER storage bootstrap/cache
```

**Container won't start:**
```bash
make down
make build
make up
```

**Database connection issues:**
```bash
make ping
docker-compose logs postgres
```

### Performance Issues

**Slow container startup:**
- Check available RAM: `make stats`
- Reduce container limits in `docker-compose.yml`

**Database performance:**
- Check PostgreSQL logs: `make watch-logs SERVICE=postgres`
- Monitor queries: Enable query log in `.env`

### Network Issues

**Containers can't communicate:**
```bash
docker network inspect flowforge-network
docker-compose down
docker-compose up -d
```

### Volume Issues

**Clear all data:**
```bash
make clean
make fresh
```

## 📊 Monitoring

### Service Health

Check all services:
```bash
make status
```

Health check endpoint:
```bash
curl http://localhost:8000/health
```

### Logs

View all logs:
```bash
make logs
```

View specific service:
```bash
make watch-logs SERVICE=app
make watch-logs SERVICE=postgres
make watch-logs SERVICE=redis
```

### Resource Usage

Container stats:
```bash
make stats
```

## 🔒 Security

### Production Checklist

- [ ] Change all default passwords
- [ ] Set `APP_DEBUG=false`
- [ ] Use strong `APP_KEY`
- [ ] Enable SSL/TLS (HTTPS)
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Enable monitoring alerts
- [ ] Review security headers

### SSL/TLS Setup

Add SSL certificates to `docker/nginx/ssl/`:
```bash
mkdir -p docker/nginx/ssl
# Copy your certificates to this directory
# cert.pem and key.pem
```

Update `docker-compose.prod.yml` to enable HTTPS.

## 🔄 CI/CD Integration

Docker containers work seamlessly with CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Build and test
  run: |
    docker-compose build
    docker-compose run app php artisan test

- name: Deploy
  run: |
    docker-compose -f docker-compose.prod.yml up -d
```

## 📈 Scaling

### Horizontal Scaling

```bash
# Scale app containers
docker-compose up -d --scale app=3

# Scale queue workers
docker-compose up -d --scale horizon=2
```

### Load Balancing

For production, add a load balancer:

```yaml
# In docker-compose.prod.yml
nginx:
  ports:
    - "80:80"
  deploy:
    replicas: 2
```

## 💾 Backup & Recovery

### Database Backup

```bash
make backup
```

### Restore Backup

```bash
docker-compose exec postgres psql -U flowforge flowforge < backup_file.sql
```

### Volume Backup

```bash
docker run --rm -v flowforge_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz /data
```

## 🚀 Performance Optimization

### PHP-FPM Tuning

Edit `docker/nginx/default.conf`:
```nginx
fastcgi_buffers 32 32k;
fastcgi_buffer_size 64k;
```

### PostgreSQL Tuning

Edit `docker/postgres/postgresql.conf`:
```ini
shared_buffers = 256MB
effective_cache_size = 1GB
max_connections = 100
```

### Redis Configuration

```yaml
redis:
  command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Laravel Deployment Guide](https://laravel.com/docs/deployment)
- [Nginx Configuration](https://nginx.org/en/docs/)

## 🆘 Support

For issues specific to FlowForge:
1. Check application logs: `make logs`
2. Check service status: `make status`
3. Review this documentation
4. Check FlowForge GitHub issues

---

**Built with ❤️ for production deployment**