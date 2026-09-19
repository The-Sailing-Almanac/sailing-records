# API Request Validation Architecture

All public-facing API endpoints use Zod schemas enforced via Express validation middleware to validate request bodies, URL path parameters, and query strings.

## Middleware Wrapper

`apps/api/src/middleware/validate.ts` exports a middleware factory:
```typescript
function validate(schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body')
```

If validation fails, the middleware returns a structured `ApiErrorResponse` (HTTP 400):
```json
{
  "error": "Zod error message list here...",
  "code": "VALIDATION_ERROR",
  "statusCode": 400
}
```

## Validation Schemas

### 1. Subscription Ingestion (`POST /api/subscribe`)
Validates body properties for email newsletter subscription requests:
- **`email`**: String, must be a valid email format.
- **`frequency`**: Optional string array representing the preferred newsletter frequencies.

### 2. User Submissions (`POST /api/submissions`)
Validates public-submitted regattas, clubs, or articles:
- **`submission_type`**: Required string (e.g. `regatta`, `club`).
- **`entity_name_or_url`**: Required string containing the name or target URL.
- **`description`**: Optional string, maximum 600 characters.
- **`contact_email`**: Optional string, must be a valid email format if provided.
- **`suggested_tags`**: Optional string array.

### 3. Article Reactions (`POST /api/articles/:id/react`)
Validates path parameters and body:
- **`params.id`**: Must be a valid UUID.
- **`body.reaction`**: Enum string, must be either `"up"` or `"down"`.

### 4. Link Redirection (`GET /sendit/:hash`)
Validates path parameters:
- **`params.hash`**: String, alphanumeric pattern.
