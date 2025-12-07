# PulseEngine API Reference

Complete API documentation for PulseEngine backend services.

## Base URL

```
Local: http://localhost:54321/functions/v1/gateway
Production: https://your-project.supabase.co/functions/v1/gateway
```

## Authentication

Most endpoints require authentication using JWT tokens from Supabase Auth.

### Headers

```http
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### Getting a Token

Use Supabase Auth:

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

const token = data.session.access_token
```

## Rate Limiting

- **Default**: 100 requests per minute
- **Tool Execution**: 20 requests per minute

Rate limit headers included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets

## Response Format

### Success Response

```json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

### Error Response

```json
{
  "error": "Error message",
  "status": 400,
  "requestId": "uuid",
  "details": { ... },
  "timestamp": "2025-12-07T08:58:35.833Z"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## System Endpoints

### Health Check

Check API health status.

```http
GET /health
```

**Authentication**: Not required

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-07T08:58:35.833Z"
}
```

### Version

Get API version information.

```http
GET /version
```

**Authentication**: Not required

**Response**:
```json
{
  "version": "v1.0.0",
  "api": "PulseEngine"
}
```

---

## Tool Endpoints

### List Tools

Get a list of available tools.

```http
GET /api/v1/tools
```

**Authentication**: Required

**Query Parameters**:
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 10, max: 100)
- `category` (string, optional): Filter by category
- `search` (string, optional): Search in name/description

**Example Request**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:54321/functions/v1/gateway/api/v1/tools?page=1&limit=10"
```

**Response**:
```json
{
  "tools": [
    {
      "id": "uuid",
      "name": "Data Processor",
      "description": "Process and transform data",
      "type": "data_processor",
      "category": "utilities",
      "version": "1.0.0",
      "enabled": true,
      "configuration": {},
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "totalPages": 1
  }
}
```

### Get Tool

Get details of a specific tool.

```http
GET /api/v1/tools/:id
```

**Authentication**: Required

**Path Parameters**:
- `id` (uuid, required): Tool ID

**Example Request**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:54321/functions/v1/gateway/api/v1/tools/tool-uuid"
```

**Response**:
```json
{
  "id": "uuid",
  "name": "Data Processor",
  "description": "Process and transform data",
  "type": "data_processor",
  "category": "utilities",
  "version": "1.0.0",
  "enabled": true,
  "configuration": {
    "timeout": 30000
  },
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### Execute Tool

Execute a tool with given parameters.

```http
POST /api/v1/tools/:id/execute
```

**Authentication**: Required

**Path Parameters**:
- `id` (uuid, required): Tool ID

**Request Body**:
```json
{
  "parameters": {
    "param1": "value1",
    "param2": 123
  }
}
```

**Example Request**:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"parameters": {"data": [1,2,3]}}' \
  "http://localhost:54321/functions/v1/gateway/api/v1/tools/tool-uuid/execute"
```

**Response**:
```json
{
  "executionId": "uuid",
  "status": "completed",
  "result": {
    "processed": true,
    "inputCount": 3,
    "timestamp": "2025-12-07T08:58:35.833Z"
  }
}
```

**Possible Status Values**:
- `pending`: Execution queued
- `running`: Currently executing
- `completed`: Successfully completed
- `failed`: Execution failed
- `cancelled`: Execution cancelled

---

## Data Endpoints

Generic CRUD endpoints for data management.

### List Resources

Get a list of resources.

```http
GET /api/v1/data/:resource
```

**Authentication**: Required

**Path Parameters**:
- `resource` (string, required): Resource name (e.g., 'users', 'projects')

**Query Parameters**:
- `page` (integer, optional): Page number
- `limit` (integer, optional): Items per page

**Example Request**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:54321/functions/v1/gateway/api/v1/data/tool_executions"
```

**Response**:
```json
[
  {
    "id": "uuid",
    "tool_id": "tool-uuid",
    "user_id": "user-uuid",
    "parameters": {},
    "result": {},
    "status": "completed",
    "started_at": "2025-12-07T08:58:35.833Z",
    "completed_at": "2025-12-07T08:58:36.833Z"
  }
]
```

### Get Resource

Get a specific resource by ID.

```http
GET /api/v1/data/:resource/:id
```

**Authentication**: Required

**Path Parameters**:
- `resource` (string, required): Resource name
- `id` (uuid, required): Resource ID

**Example Request**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:54321/functions/v1/gateway/api/v1/data/tool_executions/execution-uuid"
```

### Create Resource

Create a new resource.

```http
POST /api/v1/data/:resource
```

**Authentication**: Required

**Path Parameters**:
- `resource` (string, required): Resource name

**Request Body**: Resource data (JSON)

**Example Request**:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Tool", "type": "custom"}' \
  "http://localhost:54321/functions/v1/gateway/api/v1/data/tools"
```

**Response**:
```json
{
  "id": "uuid",
  "name": "My Tool",
  "type": "custom",
  "created_at": "2025-12-07T08:58:35.833Z"
}
```

### Update Resource

Update an existing resource.

```http
PUT /api/v1/data/:resource/:id
```

**Authentication**: Required

**Path Parameters**:
- `resource` (string, required): Resource name
- `id` (uuid, required): Resource ID

**Request Body**: Updated resource data (JSON)

**Example Request**:
```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}' \
  "http://localhost:54321/functions/v1/gateway/api/v1/data/tools/tool-uuid"
```

### Delete Resource

Delete a resource.

```http
DELETE /api/v1/data/:resource/:id
```

**Authentication**: Required

**Path Parameters**:
- `resource` (string, required): Resource name
- `id` (uuid, required): Resource ID

**Example Request**:
```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:54321/functions/v1/gateway/api/v1/data/tools/tool-uuid"
```

**Response**: 204 No Content

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `VALIDATION_ERROR` | Validation failed | Input validation error |
| `AUTHENTICATION_ERROR` | Authentication failed | Invalid or missing credentials |
| `AUTHORIZATION_ERROR` | Not authorized | Insufficient permissions |
| `NOT_FOUND` | Resource not found | Requested resource doesn't exist |
| `TOOL_DISABLED` | Tool is disabled | Tool is not enabled for execution |
| `EXECUTION_FAILED` | Execution failed | Tool execution failed |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | Too many requests |
| `INTERNAL_ERROR` | Internal server error | Server error |

---

## Using the API with JavaScript

### Setup

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'http://localhost:54321',
  'your-anon-key'
)

// Sign in
const { data: authData } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

const token = authData.session.access_token
```

### List Tools

```javascript
const response = await fetch(
  'http://localhost:54321/functions/v1/gateway/api/v1/tools',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
)

const { tools } = await response.json()
```

### Execute Tool

```javascript
const response = await fetch(
  `http://localhost:54321/functions/v1/gateway/api/v1/tools/${toolId}/execute`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parameters: {
        data: [1, 2, 3]
      }
    })
  }
)

const result = await response.json()
```

### Using the Service Layer

PulseEngine provides a service layer for easier API calls:

```javascript
import toolService from './services/tools'

// List tools
const data = await toolService.getTools({ page: 1, limit: 10 })

// Execute tool
const result = await toolService.executeTool('tool-id', {
  param1: 'value'
})

// Get execution history
const history = await toolService.getToolHistory('tool-id')
```

---

## Webhooks (Future)

Webhooks for real-time notifications will be available in a future release.

## SDK Support

Official SDKs will be available for:
- JavaScript/TypeScript ✅ (via Supabase client)
- Python (planned)
- Go (planned)
- Ruby (planned)

---

## Market Data Endpoints

### Get Real-Time Quotes

Fetch real-time stock quotes from Alpaca.

```http
GET /market-data/quotes?symbols=AAPL,TSLA,MSFT
```

**Authentication**: Required

**Query Parameters**:
- `symbols` (string, required): Comma-separated list of stock symbols (max 50)

**Response**:

```json
{
  "data": {
    "AAPL": {
      "ap": 178.23,
      "as": 100,
      "ax": "Q",
      "bp": 178.21,
      "bs": 200,
      "bx": "Q",
      "t": "2024-12-07T15:30:00Z"
    },
    "TSLA": {
      "ap": 242.15,
      "as": 150,
      "ax": "Q",
      "bp": 242.10,
      "bs": 300,
      "bx": "Q",
      "t": "2024-12-07T15:30:00Z"
    }
  }
}
```

**Rate Limits**:
- Free: 100 calls/day (15-minute delayed data)
- Pro: 1,000 calls/day (real-time data)
- Premium: 10,000 calls/day (real-time data)
- Enterprise: Unlimited

---

### Get Options Chain

Fetch options chain data from Tradier.

```http
GET /market-data/options-chain?symbol=SPY&expiration=2024-12-15
```

**Authentication**: Required

**Query Parameters**:
- `symbol` (string, required): Stock symbol (e.g., "SPY", "AAPL")
- `expiration` (string, optional): Expiration date in YYYY-MM-DD format. If omitted, returns all available expirations.

**Response**:

```json
{
  "data": [
    {
      "symbol": "SPY241215C00450000",
      "strike": 450,
      "option_type": "call",
      "expiration_date": "2024-12-15",
      "bid": 5.20,
      "ask": 5.30,
      "last": 5.25,
      "volume": 15420,
      "open_interest": 28500,
      "implied_volatility": 0.18,
      "delta": 0.65,
      "gamma": 0.012,
      "theta": -0.05,
      "vega": 0.15
    },
    {
      "symbol": "SPY241215P00450000",
      "strike": 450,
      "option_type": "put",
      "expiration_date": "2024-12-15",
      "bid": 3.10,
      "ask": 3.20,
      "last": 3.15,
      "volume": 12800,
      "open_interest": 22100,
      "implied_volatility": 0.16,
      "delta": -0.35,
      "gamma": 0.012,
      "theta": -0.04,
      "vega": 0.15
    }
  ]
}
```

**Tier Requirements**:
- Free: Not available
- Pro: Up to 5 symbols per day
- Premium: Up to 50 symbols per day
- Enterprise: Unlimited

---

### Get Gamma Exposure

Calculate gamma exposure and identify gamma walls.

```http
GET /market-data/gamma-exposure?symbol=SPY
```

**Authentication**: Required

**Query Parameters**:
- `symbol` (string, required): Stock symbol (e.g., "SPY", "QQQ")

**Response**:

```json
{
  "data": {
    "symbol": "SPY",
    "gamma_levels": [
      {
        "strike": 445,
        "call_gamma": 1250000,
        "put_gamma": 850000,
        "net_gamma": 400000
      },
      {
        "strike": 450,
        "call_gamma": 2850000,
        "put_gamma": 1920000,
        "net_gamma": 930000
      }
    ],
    "gamma_walls": [
      {
        "strike": 450,
        "call_gamma": 2850000,
        "put_gamma": 1920000,
        "net_gamma": 930000,
        "type": "resistance",
        "strength": 3.2
      },
      {
        "strike": 440,
        "call_gamma": 980000,
        "put_gamma": 2150000,
        "net_gamma": -1170000,
        "type": "support",
        "strength": 2.8
      }
    ],
    "total_call_gamma": 15280000,
    "total_put_gamma": 12450000,
    "net_gamma": 2830000
  }
}
```

**Interpretation**:
- **Positive net_gamma**: Resistance level (dealers will hedge by selling)
- **Negative net_gamma**: Support level (dealers will hedge by buying)
- **Strength**: Multiplier vs average gamma (higher = stronger wall)

**Tier Requirements**:
- Free: Not available
- Pro: SPY, QQQ only
- Premium: Any symbol, unlimited
- Enterprise: Advanced analytics included

**Note**: Gamma calculations use simplified estimation. Production implementation should use Black-Scholes model for accurate results.

---

## Support

- Documentation: https://github.com/jetgause/PulseEngine
- Issues: https://github.com/jetgause/PulseEngine/issues
- Supabase Docs: https://supabase.com/docs

## Changelog

### v1.0.0 (2025-12-07)
- Initial API release
- Tool management endpoints
- Tool execution engine
- Data CRUD endpoints
- Authentication and authorization
- Rate limiting
- Error handling
