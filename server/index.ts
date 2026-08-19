import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { initializeSpreadsheet } from "./db/sheets.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import subjectRoutes from "./routes/subjects.js";
import examRoutes from "./routes/exams.js";
import attemptRoutes from "./routes/attempts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  // When compiled, __dirname = dist-server/, so project root = ../
  // Also check process.cwd() for different hosting setups
  const possiblePaths = [
    path.join(__dirname, "../dist"),       // dist-server/../dist = dist/
    path.join(process.cwd(), "dist"),      // project root/dist
    path.join(__dirname, "../../dist"),     // fallback: deeper nesting
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
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
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
