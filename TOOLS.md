# Edge Tools Logic Architecture

## Overview

PulseEngine implements a unique architecture where all tool logic resides in the backend, providing several key advantages:

1. **Security**: Business logic and sensitive operations stay server-side
2. **Consistency**: Single source of truth for tool implementations
3. **Versioning**: Easy to update tools without frontend changes
4. **Control**: Centralized management and monitoring

## Tool Architecture

### Tool Definition

Each tool is defined in the database with:

```sql
CREATE TABLE tools (
    id UUID PRIMARY KEY,
    name VARCHAR(255),           -- Human-readable name
    description TEXT,            -- Tool description
    type VARCHAR(100),           -- Tool type (data_processor, api_caller, etc.)
    category VARCHAR(100),       -- Category for organization
    version VARCHAR(50),         -- Semantic version
    enabled BOOLEAN,             -- Enable/disable tool
    configuration JSONB,         -- Tool-specific configuration
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Tool Types

#### 1. Data Processor
Processes and transforms data.

**Example Configuration:**
```json
{
  "input_schema": {
    "data": "array",
    "transformations": "array"
  },
  "output_schema": {
    "processed": "boolean",
    "result": "array"
  }
}
```

#### 2. API Caller
Calls external APIs with configurable parameters.

**Example Configuration:**
```json
{
  "endpoint_template": "https://api.example.com/{resource}",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer ${API_KEY}"
  },
  "timeout": 30000
}
```

#### 3. Calculator
Performs mathematical operations.

**Example Configuration:**
```json
{
  "operations": ["sum", "multiply", "average", "min", "max"],
  "precision": 2
}
```

#### 4. Custom
User-defined custom tools.

**Example Configuration:**
```json
{
  "handler": "custom_function_name",
  "parameters": {
    "param1": "string",
    "param2": "number"
  }
}
```

## Tool Execution Flow

```
1. Client Request
   ↓
2. API Gateway (Authentication, Rate Limiting)
   ↓
3. Tool Validation (Check if tool exists and is enabled)
   ↓
4. Parameter Validation (Validate input parameters)
   ↓
5. Create Execution Record (Track in database)
   ↓
6. Execute Tool Logic (Backend processing)
   ↓
7. Update Execution Record (Store results)
   ↓
8. Return Response to Client
```

## Implementing a New Tool

### Step 1: Define Tool in Database

```sql
INSERT INTO tools (
    name,
    description,
    type,
    category,
    version,
    configuration
) VALUES (
    'Email Validator',
    'Validates email addresses',
    'custom',
    'utilities',
    '1.0.0',
    '{"regex": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"}'::jsonb
);
```

### Step 2: Implement Tool Logic

In `backend/supabase/functions/tools/execute.ts`:

```typescript
async function executeToolLogic(tool: any, parameters: Record<string, any>): Promise<any> {
  switch (tool.type) {
    case 'email_validator':
      return validateEmail(parameters, tool.configuration)
    
    // ... other tool types
    
    default:
      throw new Error(`Unknown tool type: ${tool.type}`)
  }
}

function validateEmail(params: any, config: any): any {
  const { email } = params
  const regex = new RegExp(config.regex)
  
  return {
    valid: regex.test(email),
    email: email,
    timestamp: new Date().toISOString()
  }
}
```

### Step 3: Test Tool

```bash
curl -X POST https://your-project.supabase.co/functions/v1/tools/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "email-validator-id",
    "parameters": {
      "email": "test@example.com"
    }
  }'
```

## Tool Execution Tracking

All tool executions are tracked:

```sql
CREATE TABLE tool_executions (
    id UUID PRIMARY KEY,
    tool_id UUID,
    user_id UUID,
    parameters JSONB,
    result JSONB,
    status VARCHAR(50),     -- pending, running, completed, failed
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

### Query Execution History

```typescript
// Get user's execution history
const { data, error } = await supabase
  .from('tool_executions')
  .select('*')
  .eq('user_id', userId)
  .order('started_at', { ascending: false })
  .limit(10)
```

## Tool Plugin System

### Plugin Interface

Tools can be implemented as plugins:

```typescript
interface ToolPlugin {
  name: string
  version: string
  execute(parameters: any, context: ExecutionContext): Promise<any>
  validate(parameters: any): ValidationResult
  getSchema(): ParameterSchema
}
```

### Plugin Example

```typescript
class DataProcessorPlugin implements ToolPlugin {
  name = 'data_processor'
  version = '1.0.0'

  async execute(parameters: any, context: ExecutionContext): Promise<any> {
    const { data, transformations } = parameters
    
    // Apply transformations
    let result = data
    for (const transform of transformations) {
      result = this.applyTransform(result, transform)
    }
    
    return {
      processed: true,
      result,
      transformations_applied: transformations.length
    }
  }

  validate(parameters: any): ValidationResult {
    if (!Array.isArray(parameters.data)) {
      return { valid: false, errors: ['data must be an array'] }
    }
    return { valid: true }
  }

  getSchema(): ParameterSchema {
    return {
      data: { type: 'array', required: true },
      transformations: { type: 'array', required: false }
    }
  }

  private applyTransform(data: any[], transform: string): any[] {
    // Implementation details
    return data
  }
}
```

## Tool Security

### 1. Input Validation

All inputs are validated before execution:

```typescript
function validateToolParameters(tool: Tool, params: any): void {
  const schema = tool.configuration.input_schema
  
  for (const [key, type] of Object.entries(schema)) {
    if (!(key in params)) {
      throw new ValidationError(`Missing required parameter: ${key}`)
    }
    
    if (typeof params[key] !== type) {
      throw new ValidationError(`Invalid type for ${key}: expected ${type}`)
    }
  }
}
```

### 2. Execution Limits

- **Timeout**: 30 seconds default
- **Concurrent Executions**: 10 per user
- **Rate Limiting**: 20 executions per minute

### 3. Resource Isolation

Each tool execution runs in an isolated context:
- Separate memory space
- Limited CPU time
- Restricted file system access
- No direct database access (uses API)

## Tool Monitoring

### Metrics Tracked

- Execution count
- Success/failure rate
- Average execution time
- Error types and frequencies
- Resource usage

### Query Metrics

```sql
-- Tool usage statistics
SELECT 
    t.name,
    COUNT(*) as execution_count,
    AVG(EXTRACT(EPOCH FROM (te.completed_at - te.started_at))) as avg_duration,
    SUM(CASE WHEN te.status = 'completed' THEN 1 ELSE 0 END) as success_count,
    SUM(CASE WHEN te.status = 'failed' THEN 1 ELSE 0 END) as failure_count
FROM tool_executions te
JOIN tools t ON te.tool_id = t.id
WHERE te.started_at > NOW() - INTERVAL '7 days'
GROUP BY t.id, t.name
ORDER BY execution_count DESC;
```

## Best Practices

1. **Keep Tools Stateless**: Tools should not maintain state between executions
2. **Use Idempotent Operations**: Same input should produce same output
3. **Handle Errors Gracefully**: Return meaningful error messages
4. **Log Execution Details**: Help with debugging and monitoring
5. **Version Your Tools**: Use semantic versioning
6. **Document Parameters**: Provide clear parameter descriptions
7. **Test Thoroughly**: Unit test tool logic
8. **Monitor Performance**: Track execution times and resource usage

## Advanced Features

### 1. Tool Chaining

Execute multiple tools in sequence:

```typescript
async function chainTools(toolIds: string[], initialParams: any) {
  let result = initialParams
  
  for (const toolId of toolIds) {
    result = await executeTool(toolId, result)
  }
  
  return result
}
```

### 2. Conditional Execution

Execute tools based on conditions:

```typescript
const workflow = {
  steps: [
    { tool: 'validator', condition: null },
    { tool: 'processor', condition: 'validator.valid === true' },
    { tool: 'sender', condition: 'processor.success === true' }
  ]
}
```

### 3. Parallel Execution

Execute multiple tools in parallel:

```typescript
const results = await Promise.all([
  executeTool('tool1', params1),
  executeTool('tool2', params2),
  executeTool('tool3', params3)
])
```

## Troubleshooting

### Common Issues

**Tool execution timeout**
- Increase timeout limit in tool configuration
- Optimize tool logic
- Consider breaking into smaller operations

**Parameter validation errors**
- Check parameter schema in tool configuration
- Ensure all required parameters are provided
- Verify parameter types match schema

**Rate limit exceeded**
- Reduce execution frequency
- Request rate limit increase
- Implement client-side caching

## Future Enhancements

- [ ] WebAssembly support for compute-intensive tools
- [ ] Distributed tool execution
- [ ] Tool marketplace
- [ ] Visual tool builder
- [ ] Real-time execution streaming
- [ ] Tool versioning and rollback
