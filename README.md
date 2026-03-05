<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Undangan Drajad - Vercel + Google Apps Script

## Arsitektur Rekomendasi
- Frontend: Vercel (static React/Vite)
- Data daftar tamu: Google Spreadsheet via Google Apps Script Web App
- Env frontend: `VITE_APPS_SCRIPT_URL`

## 1) Setup Google Sheet
1. Buat Spreadsheet baru.
2. Nama tab/sheet: `attendees`.
3. Header baris pertama:
   `id | name | address | count | created_at`

## 2) Setup Google Apps Script
1. Buka spreadsheet -> `Extensions` -> `Apps Script`.
2. Copy isi file [`apps-script/Code.gs`](./apps-script/Code.gs) ke editor Apps Script.
3. `Deploy` -> `New deployment` -> type `Web app`.
4. Execute as: `Me`.
5. Who has access: `Anyone`.
6. Deploy dan copy URL `.../exec`.

## 3) Setup Environment
1. Copy env template:
   `cp .env.example .env.local`
2. Isi:
   `VITE_APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycb.../exec"`

## 4) Run Local
1. Install dependency:
   `npm install`
2. Jalankan:
   `npm run dev`

## 5) Deploy ke Vercel
1. Push repo ke GitHub.
2. Import project ke Vercel.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Tambahkan Environment Variable di Vercel:
   `VITE_APPS_SCRIPT_URL` (isi URL web app Apps Script)
6. Redeploy.

## Catatan
- Jika ubah kode Apps Script, lakukan `Deploy > Manage deployments > Edit > New version`.
- Endpoint Apps Script mendukung action: `list`, `create`, `update`, `delete`.
