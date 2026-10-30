# Backend API Test Script
# Copy these commands to test each endpoint

# 1. Health Check
echo "=== Health Check ==="
curl http://localhost:3000/health

# 2. Login (get JWT token)
echo ""
echo "=== Login Test ==="
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"operatorId\":\"OP001\",\"password\":\"test123\"}"

# Save the token from above response, then use it below
# Replace YOUR_TOKEN_HERE with the actual token

# 3. Register a device (requires token)
echo ""
echo "=== Register Device ==="
curl -X POST http://localhost:3000/api/operators/register-device \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d "{\"deviceId\":\"test-device-001\",\"publicKey\":\"test-public-key-base64\",\"deviceName\":\"Test Device\"}"

# 4. Submit a test record (requires token)
echo ""
echo "=== Submit Record ==="
curl -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d "{\"id\":\"test-record-001\",\"timestamp\":\"2026-09-07T06:00:00Z\",\"latitude\":37.7749,\"longitude\":-122.4194,\"operatorId\":\"OP001\",\"deviceId\":\"test-device-001\",\"imageHash\":\"abc123...\",\"classification\":\"positive\",\"deltaE\":8.5,\"correctedRgb\":\"[255,0,0]\",\"signature\":\"test-signature-base64\"}"

# 5. List records (requires token)
echo ""
echo "=== List Records ==="
curl http://localhost:3000/api/records \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 6. Get single record (requires token)
echo ""
echo "=== Get Single Record ==="
curl http://localhost:3000/api/records/test-record-001 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 7. Verify record signature (requires token)
echo ""
echo "=== Verify Record ==="
curl -X POST http://localhost:3000/api/records/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d "{\"recordId\":\"test-record-001\"}"
