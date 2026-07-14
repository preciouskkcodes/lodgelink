$SUPABASE_URL = 'https://zomcrvfekwihqrrqvifi.supabase.co'
$SUPABASE_KEY = 'sb_publishable_lC9xUJnLXMF5saz5Y6JYag_JGzmP6fD'

$headers = @{
    'apikey'        = $SUPABASE_KEY
    'Authorization' = "Bearer $SUPABASE_KEY"
    'Content-Type'  = 'application/json'
    'Prefer'        = 'return=representation'
}

# Test with the exact payload our fixed app.js now sends (no checkin/checkout)
$body = '{"listing_id":"8e5c4eae-79cf-4301-9d65-978000bfdbca","guest_name":"Test Guest Fix","guest_phone":"08012345678","guests":1,"nights":2,"price_per_night":15000,"total_cost":30000,"reservation_fee":2000,"program":"test","status":"pending"}'

Write-Host "=== Testing FIXED INSERT (no checkin/checkout) ===" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "$SUPABASE_URL/rest/v1/reservations" `
        -Method POST -Headers $headers -Body $body -UseBasicParsing

    Write-Host "SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)"
    
    # Clean up test record
    $inserted = $response.Content | ConvertFrom-Json
    if ($inserted -and $inserted[0].id) {
        $testId = $inserted[0].id
        Write-Host ""
        Write-Host "Cleaning up test record id: $testId" -ForegroundColor Gray
        Invoke-WebRequest -Uri "$SUPABASE_URL/rest/v1/reservations?id=eq.$testId" `
            -Method DELETE -Headers $headers -UseBasicParsing | Out-Null
        Write-Host "Test record deleted." -ForegroundColor Gray
    }
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $responseStream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($responseStream)
    $errorBody = $reader.ReadToEnd()
    Write-Host "STILL FAILING! HTTP: $statusCode" -ForegroundColor Red
    Write-Host "Error: $errorBody" -ForegroundColor Yellow
}
