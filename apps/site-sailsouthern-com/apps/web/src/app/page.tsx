import React from "react";

export default function LoadingPage() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      width: "100vw",
      background: "#0a0f1d",
      color: "#ffffff",
      fontFamily: "sans-serif"
    }}>
      <h1 style={{
        fontSize: "64px",
        fontWeight: 800,
        letterSpacing: "0.05em",
        margin: 0
      }}>
        Loading...
      </h1>
    </div>
  );
}
