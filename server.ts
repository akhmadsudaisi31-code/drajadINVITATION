import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("attendees.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS attendees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    count INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/attendees", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM attendees ORDER BY created_at DESC").all();
      res.json(rows);
    } catch (error) {
      console.error("Error fetching attendees:", error);
      res.status(500).json({ error: "Failed to fetch attendees" });
    }
  });

  app.post("/api/attendees", (req, res) => {
    const { attendees } = req.body;
    
    if (!Array.isArray(attendees)) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    try {
      const insert = db.prepare("INSERT OR REPLACE INTO attendees (id, name, address, count) VALUES (?, ?, ?, ?)");
      
      const transaction = db.transaction((data) => {
        for (const attendee of data) {
          insert.run(attendee.id, attendee.name, attendee.address, attendee.count);
        }
      });

      transaction(attendees);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving attendees:", error);
      res.status(500).json({ error: "Failed to save attendees" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
