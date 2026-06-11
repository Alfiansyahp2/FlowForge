# FlowForge Development Guide

Complete development setup, guidelines, and best practices for contributing to FlowForge.

## 🚀 Quick Start

### Prerequisites
- **PHP**: 8.3+
- **Composer**: 2.x
- **Node.js**: 20+
- **PostgreSQL**: 16+
- **Redis**: 7+
- **Docker**: 20.10+ (optional but recommended)

### Initial Setup

```bash
# Clone repository
git clone https://github.com/your-username/flowforge.git
cd flowforge

# Install backend dependencies
composer install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Environment setup
cp .env.example .env
php artisan key:generate

# Database setup
php artisan migrate
php artisan db:seed

# Build frontend
cd frontend && npm run build && cd ..

# Start development server
php artisan serve
```

**Access:** http://localhost:8000

## 🏗️ Project Structure

```
flowforge/
├── app/                          # Laravel application
│   ├── Broadcasting/            # WebSocket channels
│   ├── Console/Commands/       # Artisan commands
│   ├── Events/                 # Domain events
│   ├── Http/                   # HTTP layer
│   │   ├── Controllers/Api/   # API controllers
│   │   ├── Middleware/        # Custom middleware
│   │   ├── Requests/         # Form requests
│   │   └── Resources/        # API resources
│   ├── Models/                # Eloquent models
│   ├── Services/              # Business logic
│   └── WorkflowEngine/       # Workflow orchestration
├── database/
│   ├── migrations/           # Database migrations
│   └── seeders/             # Database seeders
├── frontend/                  # React application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API clients
│   │   └── types/           # TypeScript types
│   └── package.json
├── routes/                   # Route definitions
├── tests/                    # Test suites
│   ├── Unit/                # Unit tests
│   └── Feature/             # Feature tests
├── docker/                   # Docker configurations
├── Dockerfile               # Container definition
├── docker-compose.yml       # Services orchestration
└── Makefile                 # Convenient commands
```

## 🧪 Testing

### Backend Tests

```bash
# Run all tests
./vendor/bin/pest

# Run with coverage
./vendor/bin/pest --coverage

# Run specific test suite
./vendor/bin/pest --testsuite=Unit

# Run specific test
./vendor/bin/pest --filter=CycleDetectorTest
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Type checking
npm run type-check
```

### Testing Guidelines

**Unit Tests:**
- Test individual components in isolation
- Mock external dependencies
- Aim for 80%+ coverage

**Integration Tests:**
- Test component interactions
- Use database transactions
- Clean up after tests

**E2E Tests:**
- Test complete user workflows
- Use real browser environment
- Keep tests maintainable

## 📝 Code Style

### PHP Standards

**Follow PSR-12 coding standards:**

```bash
# Check code style
./vendor/bin/pint --test

# Fix code style
./vendor/bin/pint
```

**Key Principles:**
- Use 4 spaces for indentation
- Maximum line length: 120
- Use strict types for methods
- Add return type declarations

### TypeScript Standards

```bash
cd frontend

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🔧 Development Workflow

### Branch Strategy

```
main          → Production code
develop       → Integration branch
feature/*     → Feature development
bugfix/*      → Bug fixes
hotfix/*      → Production hotfixes
```

### Commit Messages

**Format:**
```
type(scope): subject

body

footer
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples:**
```bash
git commit -m "feat(workflow): add parallel execution support"
git commit -m "fix(auth): resolve token expiration issue"
git commit -m "docs(api): update authentication endpoints"
```

### Pull Request Guidelines

**Before PR:**
1. Create feature branch from `develop`
2. Make atomic commits
3. Write descriptive commit messages
4. Update documentation
5. Add tests for new features

**PR Title Format:**
```
[Feature] Add parallel workflow execution
[Fix] Resolve tenant isolation bug
[Docs] Update API documentation
```

**PR Description:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
```

## 🛠️ Common Development Tasks

### Adding New API Endpoint

**1. Create Controller Method:**
```php
// app/Http/Controllers/Api/NewController.php
public function index(Request $request) {
    $query = Model::query();
    // Your logic here
    return ModelResource::collection($query->paginate());
}
```

**2. Add Route:**
```php
// routes/api.php
Route::get('/new-endpoint', [NewController::class, 'index']);
```

**3. Create Form Request (if needed):**
```bash
php artisan make:request StoreNewRequest
```

**4. Add Tests:**
```php
// tests/Feature/NewEndpointTest.php
public function it_can_list_items() {
    $response = $this->get('/api/new-endpoint');
    $response->assertStatus(200);
}
```

### Adding New Workflow Node Type

**1. Define Node Type:**
```php
// app/WorkflowEngine/WorkflowValidator.php
const SUPPORTED_NODE_TYPES = [
    // ... existing types
    'custom_type',
];
```

**2. Add Required Fields:**
```php
const REQUIRED_NODE_FIELDS = [
    // ... existing fields
    'custom_type' => ['required_field', 'another_field'],
];
```

**3. Implement Handler:**
```php
// app/WorkflowEngine/WorkflowExecutor.php
private function executeCustomTypeNode(array $node, array &$context): array {
    $data = $node['data'];
    // Your logic here
    return ['result' => $output];
}
```

**4. Add Handler Mapping:**
```php
private const NODE_HANDLERS = [
    // ... existing handlers
    'custom_type' => 'executeCustomTypeNode',
];
```

**5. Add Tests:**
```php
// tests/Unit/WorkflowEngine/CustomNodeTest.php
public function it_executes_custom_node() {
    // Test implementation
}
```

## 🔍 Debugging

### Backend Debugging

**Enable Debug Mode:**
```env
# .env
APP_DEBUG=true
LOG_CHANNEL=stack
LOG_LEVEL=debug
```

**Use Laravel Debugbar:**
```bash
composer require barryvdh/laravel-debugbar --dev
```

**Common Issues:**

**Database Connection:**
```bash
# Check connection
php artisan tinker
>>> DB::connection()->getPdo();

# Test query
>>> DB::table('users')->count();
```

**Queue Issues:**
```bash
# Check queue status
php artisan queue:failed

# Retry failed jobs
php artisan queue:retry all
```

### Frontend Debugging

**React DevTools:**
```bash
npm install --save-dev react-devtools
```

**Network Debugging:**
```typescript
// frontend/src/services/api.ts
api.interceptors.request.use((config) => {
    console.log('API Request:', config);
    return config;
});
```

## 📊 Performance Optimization

### Backend Optimization

**Database Queries:**
```php
// Eager loading
$workflows = Workflow::with(['versions', 'creator'])->get();

// Query optimization
$workflows = Workflow::select(['id', 'name'])->where('status', 'active')->get();
```

**Caching Strategy:**
```php
// Cache expensive operations
Cache::remember('workflows.active', 3600, function () {
    return Workflow::where('status', 'active')->get();
});
```

### Frontend Optimization

**Code Splitting:**
```typescript
// Lazy load components
const WorkflowEditor = lazy(() => import('./pages/WorkflowEditorPage'));
```

**Memoization:**
```typescript
// Expensive computations
const result = useMemo(() => {
    return heavyComputation(data);
}, [data]);
```

## 🔒 Security Development

### Input Validation

**Always Validate:**
```php
// Use Form Requests
public function store(StoreWorkflowRequest $request) {
    $validated = $request->validated();
    // Process validated data
}
```

### Authorization

**Check Permissions:**
```php
// Gate definitions
Gate::define('create-workflows', function ($user) {
    return $user->can('create workflows');
});

// Middleware
Route::post('/workflows', [WorkflowController::class, 'store'])
    ->middleware('can:create workflows');
```

### Security Best Practices

**❌ Never:**
- Use `eval()` with user input
- Expose sensitive data in logs
- Trust client-side validation
- Hardcode credentials

**✅ Always:**
- Validate and sanitize input
- Use parameterized queries
- Implement rate limiting
- Keep dependencies updated

## 🐳 Docker Development

### Quick Commands

```bash
# Build containers
make build

# Start services
make up

# View logs
make logs

# Open shell
make shell

# Run migrations
make migrate

# Run tests
make test
```

### Common Docker Issues

**Permission Errors:**
```bash
sudo chown -R $USER:$USER storage bootstrap/cache
```

**Container Won't Start:**
```bash
make down
make build
make up
```

**Database Connection:**
```bash
make ping
docker-compose logs postgres
```

## 📈 Monitoring & Logging

### Application Logging

**Log Levels:**
```php
use Illuminate\Support\Facades\Log;

Log::debug('Detailed debug information');
Log::info('Informational message');
Log::warning('Warning message');
Log::error('Error message');
```

**Custom Channels:**
```php
// config/logging.php
'channels' => [
    'workflow' => [
        'driver' => 'daily',
        'path' => storage_path('logs/workflow.log'),
    ],
],
```

### Performance Monitoring

**Query Logging:**
```php
DB::enableQueryLog();
// ... run queries
$queries = DB::getQueryLog();
Log::debug('Queries', $queries);
```

**Memory Profiling:**
```bash
composer require --dev laravel/telescope
php artisan telescope:install
```

## 🚢 Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Database migrations prepared
- [ ] Environment variables configured
- [ ] Backup strategy confirmed
- [ ] Rollback plan documented

### Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
composer install --no-dev --optimize-autoloader
cd frontend && npm ci --production && npm run build && cd ..

# 3. Run migrations
php artisan migrate --force

# 4. Clear caches
php artisan cache:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 5. Restart services
php artisan horizon:terminate
docker-compose restart
```

### Rollback Plan

```bash
# Revert migrations
php artisan migrate:rollback --step=1

# Restore previous code
git checkout <previous-commit>

# Restart services
docker-compose restart
```

## 📚 Resources

### Documentation
- [Laravel Documentation](https://laravel.com/docs)
- [React Documentation](https://react.dev)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

### Tools
- [Laravel Telescope](https://laravel.com/docs/telescope)
- [Laravel Horizon](https://laravel.com/docs/horizon)
- [React DevTools](https://react.dev/learn/react-developer-tools)

---

**Last Updated:** 2025-01-11  
**Development Team:** FlowForge Team  
**Version:** 1.0