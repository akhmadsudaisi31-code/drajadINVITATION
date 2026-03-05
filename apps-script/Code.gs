const SHEET_NAME = 'attendees';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'list') return jsonOutput({ success: true, data: listAttendees_() });
  return jsonOutput({ success: false, error: 'Unknown action' });
}

function doPost(e) {
  try {
    const params = parseParams_(e);
    const action = params.action || 'create';

    if (action === 'create') {
      const attendees = JSON.parse(params.attendees || '[]');
      createAttendees_(attendees);
      return jsonOutput({ success: true });
    }

    if (action === 'update') {
      updateAttendee_(params);
      return jsonOutput({ success: true });
    }

    if (action === 'delete') {
      deleteAttendee_(params.id);
      return jsonOutput({ success: true });
    }

    return jsonOutput({ success: false, error: 'Unknown action' });
  } catch (error) {
    return jsonOutput({ success: false, error: String(error && error.message ? error.message : error) });
  }
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" tidak ditemukan');
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'name', 'address', 'count', 'created_at']);
    return;
  }

  const header = sheet.getRange(1, 1, 1, 5).getValues()[0];
  if (String(header[0]).toLowerCase() !== 'id') {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, 5).setValues([['id', 'name', 'address', 'count', 'created_at']]);
  }
}

function listAttendees_() {
  const sheet = getSheet_();
  ensureHeader_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const attendees = values
    .filter(function(row) {
      return String(row[0] || '').trim() && String(row[1] || '').trim();
    })
    .map(function(row) {
      return {
        id: String(row[0] || ''),
        name: String(row[1] || ''),
        address: String(row[2] || ''),
        count: Number(row[3] || 1),
        created_at: row[4] ? new Date(row[4]).toISOString() : ''
      };
    });

  attendees.sort(function(a, b) {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });

  return attendees;
}

function createAttendees_(attendees) {
  const sheet = getSheet_();
  ensureHeader_(sheet);

  if (!Array.isArray(attendees) || attendees.length === 0) return;

  const nowIso = new Date().toISOString();
  const rows = attendees
    .filter(function(a) { return a && String(a.name || '').trim(); })
    .map(function(a) {
      return [
        String(a.id || Utilities.getUuid()),
        String(a.name || '').trim(),
        String(a.address || '').trim(),
        Math.max(1, Number(a.count || 1)),
        nowIso
      ];
    });

  if (rows.length === 0) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
}

function updateAttendee_(params) {
  const id = String(params.id || '').trim();
  if (!id) throw new Error('id wajib diisi');

  const sheet = getSheet_();
  ensureHeader_(sheet);
  const rowNum = findRowById_(sheet, id);
  if (!rowNum) throw new Error('Data tamu tidak ditemukan');

  const current = sheet.getRange(rowNum, 1, 1, 5).getValues()[0];
  const createdAt = String(params.created_at || '') || String(current[4] || new Date().toISOString());

  sheet.getRange(rowNum, 1, 1, 5).setValues([[
    id,
    String(params.name || '').trim(),
    String(params.address || '').trim(),
    Math.max(1, Number(params.count || 1)),
    createdAt
  ]]);
}

function deleteAttendee_(id) {
  const attendeeId = String(id || '').trim();
  if (!attendeeId) throw new Error('id wajib diisi');

  const sheet = getSheet_();
  ensureHeader_(sheet);
  const rowNum = findRowById_(sheet, attendeeId);
  if (!rowNum) throw new Error('Data tamu tidak ditemukan');

  sheet.deleteRow(rowNum);
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < idValues.length; i++) {
    if (String(idValues[i][0] || '') === id) return i + 2;
  }
  return null;
}

function parseParams_(e) {
  const params = (e && e.parameter) ? Object.assign({}, e.parameter) : {};

  if (e && e.postData && e.postData.contents) {
    const raw = String(e.postData.contents || '');
    const type = String(e.postData.type || '');

    if (type.indexOf('application/json') >= 0) {
      const json = JSON.parse(raw || '{}');
      Object.keys(json).forEach(function(k) { params[k] = json[k]; });
    } else {
      const pairs = raw.split('&');
      pairs.forEach(function(pair) {
        if (!pair) return;
        const idx = pair.indexOf('=');
        const k = idx >= 0 ? pair.substring(0, idx) : pair;
        const v = idx >= 0 ? pair.substring(idx + 1) : '';
        params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
      });
    }
  }

  return params;
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
