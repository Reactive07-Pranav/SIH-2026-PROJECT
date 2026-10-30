# Backend API Test Script for Windows PowerShell
# Run this from the backend directory

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Drug Test Backend API Tests" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 1. Health Check
Write-Host "1. Health Check" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get
$response | ConvertTo-Json
Write-Host "✓ Health check passed" -ForegroundColor Green
Write-Host ""

# 2. Login
Write-Host "2. Login Test (OP001)" -ForegroundColor Yellow
$loginBody = @{
    operatorId = "OP001"
    password = "test123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginResponse.token
Write-Host "✓ Login successful" -ForegroundColor Green
Write-Host "Token: $($token.Substring(0,50))..." -ForegroundColor Gray
Write-Host "Operator: $($loginResponse.name)" -ForegroundColor Gray
Write-Host ""

# 3. Register Device
Write-Host "3. Register Device" -ForegroundColor Yellow
$deviceBody = @{
    deviceId = "test-device-$(Get-Date -Format 'yyyyMMddHHmmss')"
    publicKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEtest..."
    deviceName = "Windows Test Device"
} | ConvertTo-Json

try {
    $deviceResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/operators/register-device" `
        -Method Post -Body $deviceBody -ContentType "application/json" `
        -Headers @{Authorization = "Bearer $token"}
    Write-Host "✓ Device registered: $($deviceResponse.deviceId)" -ForegroundColor Green
} catch {
    Write-Host "✗ Device registration: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 4. Submit Test Record
Write-Host "4. Submit Test Record" -ForegroundColor Yellow
$recordId = "test-record-$(Get-Date -Format 'yyyyMMddHHmmss')"
$recordBody = @{
    id = $recordId
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    latitude = 37.7749
    longitude = -122.4194
    operatorId = "OP001"
    deviceId = "test-device-001"
    imageHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    classification = "positive"
    deltaE = 8.5
    correctedRgb = "[255,100,50]"
    signature = "MEUCIQDTest+Signature+Base64+String+Here=="
} | ConvertTo-Json

try {
    $recordResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/records" `
        -Method Post -Body $recordBody -ContentType "application/json" `
        -Headers @{Authorization = "Bearer $token"}
    Write-Host "✓ Record submitted: $($recordResponse.id)" -ForegroundColor Green
    Write-Host "  Signature valid: $($recordResponse.signatureValid)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Record submission: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 5. List Records
Write-Host "5. List Records" -ForegroundColor Yellow
try {
    $listResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/records?limit=5" `
        -Method Get -Headers @{Authorization = "Bearer $token"}
    Write-Host "✓ Found $($listResponse.records.Count) records" -ForegroundColor Green

    if ($listResponse.records.Count -gt 0) {
        Write-Host "  Latest record:" -ForegroundColor Gray
        $latest = $listResponse.records[0]
        Write-Host "    ID: $($latest.id)" -ForegroundColor Gray
        Write-Host "    Classification: $($latest.classification)" -ForegroundColor Gray
        Write-Host "    Timestamp: $($latest.timestamp)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ List records: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 6. Get Single Record
Write-Host "6. Get Single Record" -ForegroundColor Yellow
try {
    $singleResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/records/$recordId" `
        -Method Get -Headers @{Authorization = "Bearer $token"}
    Write-Host "✓ Retrieved record: $($singleResponse.id)" -ForegroundColor Green
    Write-Host "  Classification: $($singleResponse.classification)" -ForegroundColor Gray
    Write-Host "  Delta E: $($singleResponse.deltaE)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Get record: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 7. Verify Record
Write-Host "7. Verify Record Signature" -ForegroundColor Yellow
$verifyBody = @{
    recordId = $recordId
} | ConvertTo-Json

try {
    $verifyResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/records/verify" `
        -Method Post -Body $verifyBody -ContentType "application/json" `
        -Headers @{Authorization = "Bearer $token"}
    Write-Host "✓ Verification complete" -ForegroundColor Green
    Write-Host "  Status: $($verifyResponse.status)" -ForegroundColor Gray
    Write-Host "  Verified: $($verifyResponse.verified)" -ForegroundColor Gray
    Write-Host "  Message: $($verifyResponse.message)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Verify record: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Backend API Tests Complete!" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
