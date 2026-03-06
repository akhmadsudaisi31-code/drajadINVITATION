import express from "express";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "";
const SHEET_RANGE = process.env.GOOGLE_SHEETS_RANGE || "attendees!A:G";
const SHEET_NAME = (SHEET_RANGE.split("!")[0] || "attendees").trim();
const SHEET_FULL_RANGE = `${SHEET_NAME}!A:G`;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
const PRIVATE_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
let accessTokenCache = null;
function normalizeParticipantCounts(input) {
    const adult = Math.max(1, Number(input.adult_count ?? input.count ?? 1));
    const child = Math.max(0, Number(input.child_count ?? 0));
    return {
        adult_count: adult,
        child_count: child,
        count: adult + child,
    };
}
function getErrorMessage(error) {
    if (error instanceof Error)
        return error.message;
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
function base64Url(input) {
    const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return source
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}
async function getGoogleAccessToken() {
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) {
        return accessTokenCache.token;
    }
    if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
        throw new Error("Google service account credentials are missing");
    }
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
        iss: SERVICE_ACCOUNT_EMAIL,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: GOOGLE_TOKEN_URL,
        exp: now + 3600,
        iat: now,
    };
    const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
    const signature = crypto
        .createSign("RSA-SHA256")
        .update(unsignedToken)
        .sign(PRIVATE_KEY);
    const assertion = `${unsignedToken}.${base64Url(signature)}`;
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion,
        }),
    });
    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Failed to get Google access token: ${errorText}`);
    }
    const tokenData = (await tokenResponse.json());
    accessTokenCache = {
        token: tokenData.access_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
    };
    return tokenData.access_token;
}
function validateGoogleSheetsConfig() {
    return Boolean(SPREADSHEET_ID && SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY);
}
async function fetchAttendeesFromSheet() {
    const token = await getGoogleAccessToken();
    const url = `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(SPREADSHEET_ID)}/values/${encodeURIComponent(SHEET_FULL_RANGE)}`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to read attendees from sheet: ${errorText}`);
    }
    const data = (await response.json());
    const rows = data.values || [];
    const attendees = rows
        .filter((row) => row.length >= 4)
        .filter((row, index) => {
        if (index !== 0)
            return true;
        return String(row[0]).toLowerCase() !== "id";
    })
        .map((row, index) => {
        const normalized = normalizeParticipantCounts({
            count: Number(row[3] || 0),
            adult_count: Number(row[5] || 0) || undefined,
            child_count: Number(row[6] || 0) || undefined,
        });
        return {
            id: row[0] || crypto.randomUUID(),
            name: row[1] || "",
            address: row[2] || "",
            ...normalized,
            created_at: row[4] || "",
            row_num: index + 1,
        };
    })
        .filter((a) => a.name.trim());
    // Keep latest entries first for UI consistency.
    return attendees.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
    });
}
async function findAttendeeRowById(attendeeId) {
    const token = await getGoogleAccessToken();
    const url = `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(SPREADSHEET_ID)}/values/${encodeURIComponent(SHEET_FULL_RANGE)}`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to read sheet rows for delete: ${errorText}`);
    }
    const data = (await response.json());
    const rows = data.values || [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (String(row[0] || "").toLowerCase() === "id")
            continue;
        if (row[0] === attendeeId) {
            // Spreadsheet rows are 1-based.
            return i + 1;
        }
    }
    return null;
}
async function clearAttendeeRow(rowNumber) {
    const token = await getGoogleAccessToken();
    const rowRange = `${SHEET_NAME}!A${rowNumber}:G${rowNumber}`;
    const url = `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(SPREADSHEET_ID)}/values/${encodeURIComponent(rowRange)}:clear`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to clear attendee row: ${errorText}`);
    }
}
async function updateAttendeeRow(rowNumber, attendee) {
    const token = await getGoogleAccessToken();
    const rowRange = `${SHEET_NAME}!A${rowNumber}:G${rowNumber}`;
    const normalized = normalizeParticipantCounts(attendee);
    const url = `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(SPREADSHEET_ID)}/values/${encodeURIComponent(rowRange)}?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            values: [[
                    attendee.id,
                    attendee.name,
                    attendee.address,
                    normalized.count,
                    attendee.created_at || new Date().toISOString(),
                    normalized.adult_count,
                    normalized.child_count,
                ]],
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update attendee row: ${errorText}`);
    }
}
async function appendAttendeesToSheet(attendees) {
    const token = await getGoogleAccessToken();
    const url = `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(SPREADSHEET_ID)}/values/${encodeURIComponent(SHEET_FULL_RANGE)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const values = attendees.map((attendee) => {
        const normalized = normalizeParticipantCounts(attendee);
        return [
            attendee.id,
            attendee.name,
            attendee.address,
            normalized.count,
            new Date().toISOString(),
            normalized.adult_count,
            normalized.child_count,
        ];
    });
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to append attendees to sheet: ${errorText}`);
    }
}
async function startServer() {
    const app = express();
    app.use(express.json());
    app.get("/api/attendees", async (_req, res) => {
        if (!validateGoogleSheetsConfig()) {
            return res.status(500).json({
                error: "Google Sheets config is missing. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
            });
        }
        try {
            const attendees = await fetchAttendeesFromSheet();
            res.json(attendees);
        }
        catch (error) {
            console.error("Error fetching attendees:", error);
            res.status(500).json({
                error: "Failed to fetch attendees",
                detail: getErrorMessage(error),
            });
        }
    });
    app.post("/api/attendees", async (req, res) => {
        if (!validateGoogleSheetsConfig()) {
            return res.status(500).json({
                error: "Google Sheets config is missing. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
            });
        }
        const { attendees } = req.body;
        if (!Array.isArray(attendees)) {
            return res.status(400).json({ error: "Invalid data format" });
        }
        try {
            await appendAttendeesToSheet(attendees
                .filter((attendee) => attendee?.name?.trim())
                .map((attendee) => ({
                id: crypto.randomUUID(),
                name: attendee.name,
                address: attendee.address || "",
                ...normalizeParticipantCounts(attendee),
            })));
            res.json({ success: true });
        }
        catch (error) {
            console.error("Error saving attendees:", error);
            res.status(500).json({
                error: "Failed to save attendees",
                detail: getErrorMessage(error),
            });
        }
    });
    app.delete("/api/attendees/:id", async (req, res) => {
        if (!validateGoogleSheetsConfig()) {
            return res.status(500).json({
                error: "Google Sheets config is missing. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
            });
        }
        const attendeeId = String(req.params.id || "").trim();
        if (!attendeeId) {
            return res.status(400).json({ error: "Attendee id is required" });
        }
        try {
            const rowNumber = await findAttendeeRowById(attendeeId);
            if (!rowNumber) {
                return res.status(404).json({ error: "Attendee not found" });
            }
            await clearAttendeeRow(rowNumber);
            res.json({ success: true });
        }
        catch (error) {
            console.error("Error deleting attendee:", error);
            res.status(500).json({
                error: "Failed to delete attendee",
                detail: getErrorMessage(error),
            });
        }
    });
    app.put("/api/attendees/:id", async (req, res) => {
        if (!validateGoogleSheetsConfig()) {
            return res.status(500).json({
                error: "Google Sheets config is missing. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
            });
        }
        const attendeeId = String(req.params.id || "").trim();
        const { name, address, count, adult_count, child_count, created_at } = req.body;
        if (!attendeeId) {
            return res.status(400).json({ error: "Attendee id is required" });
        }
        if (!String(name || "").trim()) {
            return res.status(400).json({ error: "Name is required" });
        }
        try {
            // Strict by id to prevent updates landing on another row.
            const rowNumber = await findAttendeeRowById(attendeeId);
            if (!rowNumber) {
                return res.status(404).json({ error: "Attendee not found" });
            }
            await updateAttendeeRow(rowNumber, {
                id: attendeeId,
                name: String(name).trim(),
                address: String(address || "").trim(),
                ...normalizeParticipantCounts({
                    count: Math.max(1, Number(count || 1)),
                    adult_count,
                    child_count,
                }),
                created_at: created_at ? String(created_at) : undefined,
            });
            res.json({ success: true });
        }
        catch (error) {
            console.error("Error updating attendee:", error);
            res.status(500).json({
                error: "Failed to update attendee",
                detail: getErrorMessage(error),
            });
        }
    });
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            configFile: false,
            plugins: [react(), tailwindcss()],
            define: {
                "process.env.GEMINI_API_KEY": JSON.stringify(process.env.GEMINI_API_KEY || ""),
            },
            resolve: {
                alias: {
                    "@app": path.resolve(__dirname, "."),
                },
            },
            server: {
                middlewareMode: true,
                hmr: process.env.DISABLE_HMR !== "true",
            },
            appType: "spa",
        });
        app.use(vite.middlewares);
    }
    else {
        app.use(express.static(path.join(__dirname, "dist")));
        app.get("*", (_req, res) => {
            res.sendFile(path.join(__dirname, "dist", "index.html"));
        });
    }
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
startServer();
