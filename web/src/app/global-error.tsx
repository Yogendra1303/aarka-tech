"use client";

// Last-resort screen when the app shell itself fails, so the window is never blank.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FDFDF1", color: "#11110F", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>Aarka Tech could not load</h1>
          <p style={{ fontSize: 14, opacity: 0.75 }}>Your data is unchanged. Reload, or try again.</p>
          <p style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => location.reload()} style={{ background: "#EC5E27", color: "white", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600 }}>Reload</button>
            <button onClick={reset} style={{ background: "transparent", border: "1px solid #ccc", borderRadius: 8, padding: "10px 16px" }}>Try again</button>
          </p>
        </div>
      </body>
    </html>
  );
}
