# PulseEngine

A robust edge tools platform with backend logic management, designed for scalability and security.

## 🎯 Overview

PulseEngine is a modern web application that separates edge tools logic in the backend, ensuring security, consistency, and easy management. The system features:

- **Edge Tools Logic in Backend**: All tool logic stays server-side for security and maintainability
- **Robust API Management**: RESTful APIs with authentication, rate limiting, and comprehensive error handling
- **Advanced Data Handling**: PostgreSQL database with real-time subscriptions and caching
- **Frontend on Netlify**: React-based frontend with automatic CI/CD deployment
- **Backend on Supabase**: PostgreSQL, Edge Functions (Deno), and built-in authentication

## 🏗️ Architecture

```
Frontend (Netlify) → API Gateway (Supabase Edge Functions) → Backend Services
                                                           → Database (PostgreSQL)
                                                           → Storage
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase CLI (for backend development)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Backend Setup

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Start local Supabase:
```bash
cd backend
supabase start
```

3. Run migrations:
```bash
supabase db push
```

4. Deploy edge functions (optional for local development):
```bash
supabase functions deploy
```

## 📁 Project Structure

```
PulseEngine/
├── frontend/               # Frontend application (Netlify)
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API service layer
│   │   │   ├── api.js     # API client with interceptors
│   │   │   ├── auth.js    # Authentication service
│   │   │   ├── tools.js   # Tool management service
│   │   │   └── data.js    # Data handling service
│   │   ├── hooks/         # Custom React hooks
│   │   └── store/         # State management
│   ├── netlify.toml       # Netlify configuration
│   └── package.json
│
├── backend/                # Backend services (Supabase)
│   ├── supabase/
│   │   ├── functions/     # Edge Functions (Deno)
│   │   │   ├── api/       # API Gateway
│   │   │   ├── tools/     # Tool execution endpoints
│   │   │   └── data/      # Data handling
│   │   ├── migrations/    # Database migrations
│   │   └── config.toml    # Supabase configuration
│   ├── shared/            # Shared code
│   │   ├── types/         # TypeScript type definitions
│   │   ├── validators/    # Data validation schemas
│   │   └── constants/     # Shared constants
│   └── scripts/           # Deployment scripts
│
├── ARCHITECTURE.md        # Detailed architecture documentation
└── README.md             # This file
```

## 🔑 Key Features

### 1. Edge Tools Management

Tools are managed entirely in the backend with a plugin architecture:

```typescript
// Execute a tool via API
const result = await toolService.executeTool('tool-id', {
  parameter1: 'value',
  parameter2: 123
})
```

### 2. Robust API Management

- **Authentication**: JWT-based with Supabase Auth
- **Rate Limiting**: Configurable per-endpoint limits
- **Error Handling**: Standardized error responses
- **Request Validation**: Input validation at API level
- **Logging**: Comprehensive request/response logging

### 3. Data Handling

```typescript
// CRUD operations via data service
const users = await dataService.getAll('users', { page: 1, limit: 10 })
const user = await dataService.getById('users', 'user-id')
const newUser = await dataService.create('users', { name: 'John' })
```

### 4. Real-time Subscriptions

```typescript
// Subscribe to real-time updates
supabase
  .from('tool_executions')
  .on('INSERT', payload => {
    console.log('New execution:', payload.new)
  })
  .subscribe()
```

## 🔒 Security

- **Row Level Security (RLS)**: Database-level access control
- **JWT Authentication**: Secure token-based auth
- **Input Validation**: All inputs validated before processing
- **Rate Limiting**: Prevent API abuse
- **CORS Configuration**: Restricted to known origins
- **Environment Variables**: Sensitive data in env vars

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend
deno test
```

## 📦 Deployment

### Frontend (Netlify)

1. Connect your GitHub repository to Netlify
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add environment variables in Netlify dashboard
4. Deploy automatically on push to main branch

### Backend (Supabase)

1. Create a Supabase project
2. Link your local project:
```bash
supabase link --project-ref your-project-ref
```

3. Deploy migrations:
```bash
supabase db push
```

4. Deploy edge functions:
```bash
supabase functions deploy
```

## 🔧 Configuration

### Frontend Environment Variables

Create `.env` file in `frontend/`:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=your-api-url
```

### Backend Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=your-database-url
JWT_SECRET=your-jwt-secret
```

## 📊 Database Schema

### Tables

- **tools**: Tool definitions and configurations
- **tool_executions**: Tool execution history and results

See `backend/supabase/migrations/` for detailed schema.

## 🛠️ Development

### Adding a New Tool

1. Define tool in database:
```sql
INSERT INTO tools (name, description, type, category) 
VALUES ('My Tool', 'Description', 'custom', 'utilities');
```

2. Implement tool logic in `backend/supabase/functions/tools/execute.ts`

3. Tool becomes immediately available via API

### Adding a New API Endpoint

1. Update routing in `backend/supabase/functions/api/gateway.ts`
2. Implement handler function
3. Add validation if needed

## 📚 API Documentation

### Authentication

```
POST /auth/login
POST /auth/register
POST /auth/logout
```

### Tools

```
GET    /api/v1/tools              # List all tools
GET    /api/v1/tools/:id          # Get tool details
POST   /api/v1/tools/:id/execute  # Execute a tool
GET    /api/v1/tools/:id/history  # Get execution history
```

### Data

```
GET    /api/v1/data/:resource           # List resources
GET    /api/v1/data/:resource/:id       # Get resource
POST   /api/v1/data/:resource           # Create resource
PUT    /api/v1/data/:resource/:id       # Update resource
DELETE /api/v1/data/:resource/:id       # Delete resource
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/jetgause/PulseEngine/issues)
- Documentation: See [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🗺️ Roadmap

- [ ] WebSocket support for real-time tool execution
- [ ] Advanced caching strategies
- [ ] Multi-region deployment
- [ ] GraphQL API
- [ ] Tool marketplace
- [ ] Advanced monitoring and analytics

---

Built with ❤️ using React, Supabase, and Deno
