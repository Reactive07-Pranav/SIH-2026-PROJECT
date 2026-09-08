# Drug Test Evidence Backend

Backend API server for the field drug-test evidentiary logging system.

## Setup

```bash
npm install
npm run seed    # Create test operators
npm start       # Production
npm run dev     # Development with nodemon
```

## Environment Variables

Copy `.env` and configure:
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Secret for JWT signing
- `JWT_EXPIRES_IN` - Token expiration (default: 24h)
- `DB_PATH` - SQLite database path

## API Endpoints

### Authentication

**POST /auth/login**
```json
{
  "operatorId": "your-registered-operator-id",
  "password": "your-password"
}
```
Returns: `{ token, operatorId, name }`

**POST /auth/register**
```json
{
  "operatorId": "your-unique-operator-id",
  "password": "your-secure-password",
  "name": "Officer Name",
  "badgeNumber": "B11111",
  "department": "Patrol"
}
```

### Operators

**POST /api/operators/register-device** (authenticated)
```json
{
  "deviceId": "device-uuid",
  "publicKey": "base64-encoded-DER-public-key",
  "deviceName": "Samsung Galaxy S21"
}
```

**GET /api/operators/** (authenticated)  
List registered devices for the authenticated operator.

### Records

**POST /api/records** (authenticated)
```json
{
  "id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "operatorId": "OP001",
  "deviceId": "device-uuid",
  "imageHash": "sha256-hex",
  "classification": "positive",
  "deltaE": 8.5,
  "correctedRgb": "[255,0,0]",
  "signature": "base64-ecdsa-signature"
}
```

**GET /api/records** (authenticated)  
Query params: `page`, `limit`, `classification`, `startDate`, `endDate`

**GET /api/records/:id** (authenticated)  
Get a single record by ID.

**POST /api/records/verify** (authenticated)
```json
{
  "recordId": "uuid"
}
```
Returns signature verification status.

### Health

**GET /health**  
Server health check.

## Test Credentials

No default operator credentials are shipped with the app. Register a new operator before logging in.

## Database Schema

### operators
- `id` TEXT PRIMARY KEY
- `password_hash` TEXT
- `name` TEXT
- `badge_number` TEXT
- `department` TEXT
- `created_at` TEXT
- `active` INTEGER

### devices
- `id` TEXT PRIMARY KEY
- `operator_id` TEXT (FK)
- `public_key` TEXT (base64 DER)
- `device_name` TEXT
- `registered_at` TEXT
- `active` INTEGER

### test_records
- `id` TEXT PRIMARY KEY
- `timestamp` TEXT
- `latitude` REAL
- `longitude` REAL
- `operator_id` TEXT (FK)
- `device_id` TEXT
- `image_hash` TEXT
- `classification` TEXT
- `delta_e` REAL
- `corrected_rgb` TEXT (JSON array)
- `signature` TEXT (base64)
- `signature_valid` INTEGER
- `received_at` TEXT

### audit_log
- `id` INTEGER PRIMARY KEY
- `action` TEXT
- `operator_id` TEXT
- `record_id` TEXT
- `details` TEXT
- `ip_address` TEXT
- `timestamp` TEXT

## Security

- JWT authentication required for all `/api` endpoints
- ECDSA P-256 signature verification for record integrity
- Password hashing with bcrypt (10 rounds)
- Audit logging for all critical operations
- Device public keys stored and validated
