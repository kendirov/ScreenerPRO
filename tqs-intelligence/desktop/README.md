# TQS Intelligence Desktop

Native Windows shell for the existing TQS Intelligence runtime.

## Runtime contract

- The desktop app owns the TQS supervisor for the lifetime of the visible session.
- The supervisor process is assigned to a Windows Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`.
- Closing the app performs graceful stop, writes the owner stop marker, then closes the Job Object so the entire owned process tree is terminated by Windows.
- Startup removes the owner stop marker and cleans stale TQS runtime processes before starting a new owned session.
- A single-instance mutex prevents duplicate desktop sessions.
- Existing Cockpit on `127.0.0.1:8787` is embedded through WebView2; analytical code remains in `tqs-intelligence`.

## Verification

```powershell
dotnet build .\TQS.Desktop\TQS.Desktop.csproj -c Release
.\TQS.Desktop\bin\Release\net8.0-windows\TQS.Desktop.exe --lifecycle-smoke
```

The lifecycle smoke test must report:

- started = true
- online_before_stop = true
- offline_after_stop = true
- pass = true

Generated runtime evidence is written to `data/desktop-lifecycle-smoke.json`.
