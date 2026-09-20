$ErrorActionPreference = "SilentlyContinue"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:8877/")
$listener.Start()
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.RawUrl
    if (-not $path) { $path = "/" }
    $ctx.Response.StatusCode = 302
    $ctx.Response.RedirectLocation = "http://127.0.0.1:8787$path"
    $body = [Text.Encoding]::UTF8.GetBytes("TQS Trading Intelligence: http://127.0.0.1:8787")
    $ctx.Response.ContentLength64 = $body.Length
    $ctx.Response.OutputStream.Write($body,0,$body.Length)
    $ctx.Response.OutputStream.Close()
  } catch { Start-Sleep -Milliseconds 250 }
}
