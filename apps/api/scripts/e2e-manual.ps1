# E2E Test Script for Solicitudes Academicas API
$baseUrl = "http://localhost:3000/api"
$testResults = @()

function Write-Test {
    param([string]$test, [string]$status, [string]$details = "")
    $icon = if ($status -eq "PASS") { "[OK]" } else { "[FAIL]" }
    $color = if ($status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "$icon $test" -ForegroundColor $color
    if ($details) { Write-Host "  $details" -ForegroundColor Gray }
    $script:testResults += @{ test = $test; status = $status; details = $details }
}

function Invoke-Api {
    param(
        [string]$method,
        [string]$endpoint,
        [object]$body = $null,
        [string]$token = $null
    )
    
    $uri = "$baseUrl$endpoint"
    $requestHeaders = @{ "Content-Type" = "application/json" }
    if ($token) { $requestHeaders["Authorization"] = "Bearer $token" }
    
    $params = @{
        Uri = $uri
        Method = $method
        Headers = $requestHeaders
        UseBasicParsing = $true
        TimeoutSec = 10
    }
    
    if ($body) { $params["Body"] = ($body | ConvertTo-Json) }
    
    try {
        $response = Invoke-WebRequest @params
        return @{ success = $true; data = ($response.Content | ConvertFrom-Json); statusCode = $response.StatusCode }
    } catch {
        $statusCode = 0
        if ($_.Exception.Response) { $statusCode = [int]$_.Exception.Response.StatusCode }
        return @{ success = $false; error = $_.Exception.Message; statusCode = $statusCode }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "E2E TEST SUITE - SOLICITUDES ACADEMICAS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# AUTHENTICATION
Write-Host "1. AUTHENTICATION" -ForegroundColor Yellow

$result = Invoke-Api -method "POST" -endpoint "/auth/login" -body @{ email = "admin@ul.edu.co"; password = "admin123" }
if ($result.success) { $adminToken = $result.data.accessToken; Write-Test "Admin login" "PASS" } else { Write-Test "Admin login" "FAIL" $result.error }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "POST" -endpoint "/auth/login" -body @{ email = "coordinador@ul.edu.co"; password = "coordinador123" }
if ($result.success) { $coordinatorToken = $result.data.accessToken; Write-Test "Coordinator login" "PASS" } else { Write-Test "Coordinator login" "FAIL" $result.error }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "POST" -endpoint "/auth/login" -body @{ email = "funcionario@ul.edu.co"; password = "funcionario123" }
if ($result.success) { $staffToken = $result.data.accessToken; Write-Test "Staff login" "PASS" } else { Write-Test "Staff login" "FAIL" $result.error }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "POST" -endpoint "/auth/login" -body @{ email = "estudiante@ul.edu.co"; password = "estudiante123" }
if ($result.success) { $studentToken = $result.data.accessToken; $studentId = $result.data.user.id; Write-Test "Student login" "PASS" } else { Write-Test "Student login" "FAIL" $result.error }
Start-Sleep -Seconds 1

# STUDENT FLOW
Write-Host "`n2. STUDENT FLOW" -ForegroundColor Yellow

$result = Invoke-Api -method "GET" -endpoint "/requests/types" -token $studentToken
if ($result.success -and $result.data.Count -gt 0) { $requestTypeId = $result.data[0].id; Write-Test "Get request types" "PASS" "$($result.data.Count) types" } else { Write-Test "Get request types" "FAIL" }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "POST" -endpoint "/requests" -token $studentToken -body @{ title = "E2E Test Request"; description = "Test description"; requestTypeId = $requestTypeId }
if ($result.success -and $result.data.status -eq "DRAFT") { $requestId = $result.data.id; Write-Test "Create request (DRAFT)" "PASS" "ID: $requestId" } else { Write-Test "Create request" "FAIL" $result.error }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "GET" -endpoint "/requests/$requestId" -token $studentToken
if ($result.success) { Write-Test "Get request detail" "PASS" } else { Write-Test "Get request detail" "FAIL" }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "POST" -endpoint "/requests/$requestId/submit" -token $studentToken
if ($result.success -and $result.data.status -eq "SUBMITTED") { Write-Test "Submit request" "PASS" } else { Write-Test "Submit request" "FAIL" $result.error }
Start-Sleep -Seconds 1

# STAFF FLOW
Write-Host "`n3. STAFF FLOW" -ForegroundColor Yellow

$result = Invoke-Api -method "PATCH" -endpoint "/requests/$requestId/status" -token $staffToken -body @{ newStatus = "IN_REVIEW"; comment = "In review" }
if ($result.success) { Write-Test "Change to IN_REVIEW" "PASS" } else { Write-Test "Change to IN_REVIEW" "FAIL" $result.error }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "PATCH" -endpoint "/requests/$requestId/status" -token $staffToken -body @{ newStatus = "PENDING_DOCUMENTS"; comment = "Need more documents" }
if ($result.success) { Write-Test "Change to PENDING_DOCUMENTS" "PASS" } else { Write-Test "Change to PENDING_DOCUMENTS" "FAIL" $result.error }
Start-Sleep -Seconds 1

# VALIDATION TESTS
Write-Host "`n4. VALIDATION (Comment Requirements)" -ForegroundColor Yellow

$result = Invoke-Api -method "PATCH" -endpoint "/requests/$requestId/status" -token $coordinatorToken -body @{ newStatus = "REJECTED"; comment = "" }
if (-not $result.success -and $result.statusCode -eq 400) { Write-Test "Reject with empty comment" "PASS" "Blocked (400)" } else { Write-Test "Reject with empty comment" "FAIL" "Should be blocked" }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "PATCH" -endpoint "/requests/$requestId/status" -token $coordinatorToken -body @{ newStatus = "REJECTED"; comment = "     " }
if (-not $result.success -and $result.statusCode -eq 400) { Write-Test "Reject with whitespace" "PASS" "Blocked (400)" } else { Write-Test "Reject with whitespace" "FAIL" "Should be blocked" }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "PATCH" -endpoint "/requests/$requestId/status" -token $coordinatorToken -body @{ newStatus = "REJECTED"; comment = "short" }
if (-not $result.success -and $result.statusCode -eq 400) { Write-Test "Reject with short comment" "PASS" "Blocked (400)" } else { Write-Test "Reject with short comment" "FAIL" "Should be blocked" }
Start-Sleep -Seconds 1

# COORDINATOR FLOW
Write-Host "`n5. COORDINATOR FLOW" -ForegroundColor Yellow

$result = Invoke-Api -method "PATCH" -endpoint "/requests/$requestId/status" -token $staffToken -body @{ newStatus = "IN_REVIEW"; comment = "Documents received" }
if ($result.success) { Write-Test "Back to IN_REVIEW" "PASS" } else { Write-Test "Back to IN_REVIEW" "FAIL" }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "PATCH" -endpoint "/requests/$requestId/status" -token $coordinatorToken -body @{ newStatus = "APPROVED"; comment = "Approved after review" }
if ($result.success -and $result.data.status -eq "APPROVED") { Write-Test "Approve request" "PASS" } else { Write-Test "Approve request" "FAIL" $result.error }
Start-Sleep -Seconds 2

$result = Invoke-Api -method "GET" -endpoint "/requests/$requestId/official-documents" -token $coordinatorToken
if ($result.success -and $result.data.data.Count -gt 0) { $docId = $result.data.data[0].id; Write-Test "Auto-generate document" "PASS" "Doc: $docId" } else { Write-Test "Auto-generate document" "FAIL" "No document generated" }
Start-Sleep -Seconds 1

# ADMIN FLOW
Write-Host "`n6. ADMIN FLOW" -ForegroundColor Yellow

$result = Invoke-Api -method "GET" -endpoint "/users" -token $adminToken
if ($result.success) { Write-Test "Get all users" "PASS" "$($result.data.data.Count) users" } else { Write-Test "Get all users" "FAIL" }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "GET" -endpoint "/users/stats" -token $adminToken
if ($result.success) { Write-Test "Get user stats" "PASS" } else { Write-Test "Get user stats" "FAIL" }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "GET" -endpoint "/requests/stats" -token $adminToken
if ($result.success) { Write-Test "Get request stats" "PASS" } else { Write-Test "Get request stats" "FAIL" }
Start-Sleep -Seconds 1

# PERMISSION TESTS
Write-Host "`n7. PERMISSION TESTS" -ForegroundColor Yellow

$result = Invoke-Api -method "GET" -endpoint "/users" -token $studentToken
if (-not $result.success -and $result.statusCode -eq 403) { Write-Test "Student blocked from /users" "PASS" } else { Write-Test "Student blocked from /users" "FAIL" }
Start-Sleep -Seconds 1

$result = Invoke-Api -method "PATCH" -endpoint "/requests/$requestId/status" -token $studentToken -body @{ newStatus = "IN_REVIEW" }
if (-not $result.success -and $result.statusCode -eq 403) { Write-Test "Student blocked from status change" "PASS" } else { Write-Test "Student blocked from status change" "FAIL" }
Start-Sleep -Seconds 1

# HEALTH
Write-Host "`n8. HEALTH CHECK" -ForegroundColor Yellow
$result = Invoke-Api -method "GET" -endpoint "/health"
if ($result.success) { Write-Test "Health check" "PASS" } else { Write-Test "Health check" "FAIL" }

# SUMMARY
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passed = ($testResults | Where-Object { $_.status -eq "PASS" }).Count
$failed = ($testResults | Where-Object { $_.status -eq "FAIL" }).Count
$total = $testResults.Count

Write-Host "Total: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

if ($failed -eq 0) { Write-Host "`nALL TESTS PASSED" -ForegroundColor Green } else { Write-Host "`nSOME TESTS FAILED" -ForegroundColor Red }
