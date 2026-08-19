import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { initializeSpreadsheet } from "./db/sheets";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import subjectRoutes from "./routes/subjects";
import examRoutes from "./routes/exams";
import attemptRoutes from "./routes/attempts";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/attempts", attemptRoutes);

// Serve static frontend files in production
if (process.env.NODE_ENV === "production") {
  // Try multiple possible dist locations for different hosting setups
  const possiblePaths = [
    path.join(process.cwd(), "dist"),
    path.join(__dirname, "../dist"),
    path.join(process.cwd(), "public"),
  ];

  let frontendPath = possiblePaths[0];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      frontendPath = p;
      break;
    }
  }

  console.log(`Serving static files from: ${frontendPath}`);
  app.use(express.static(frontendPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(frontendPath, "index.html"));
    }
  });
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Initialize spreadsheet and start server
async function start() {
  try {
    console.log("Initializing Google Sheets...");
    await initializeSpreadsheet();
    console.log("Google Sheets initialized successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
