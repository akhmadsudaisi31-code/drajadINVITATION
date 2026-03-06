const SHEET_NAME = 'attendees';
const SHEET_HEADERS = ['id', 'name', 'address', 'count', 'created_at'];
const SUBMISSION_TOKEN_PREFIX = 'submitted_token:';

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
      createAttendees_(attendees, params.client_token);
      return jsonOutput({ success: true });
    }

    if (action === 'update') {
      updateAttendee_(params);
      return jsonOutput({ success: true });
    }

    if (action === 'delete') {
      deleteAttendee_(params.id, params.row_num);
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
    sheet.appendRow(SHEET_HEADERS);
    return;
  }

  const header = sheet.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0];
  if (String(header[0]).toLowerCase() !== 'id') {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  }
}

function listAttendees_() {
  const sheet = getSheet_();
  ensureHeader_(sheet);
  ensureUniqueIds_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).getValues();
  const attendees = [];
  values.forEach(function(row, index) {
    const rowNum = index + 2;
    if (!String(row[0] || '').trim() || !String(row[1] || '').trim()) return;
    attendees.push({
      id: String(row[0] || ''),
      name: String(row[1] || ''),
      address: String(row[2] || ''),
      count: Math.max(1, Number(row[3] || 1)),
      created_at: row[4] ? new Date(row[4]).toISOString() : '',
      row_num: rowNum
    });
  });

  attendees.sort(function(a, b) {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });

  return attendees;
}

function createAttendees_(attendees, clientToken) {
  const sheet = getSheet_();
  ensureHeader_(sheet);
  ensureUniqueIds_(sheet);
  const token = String(clientToken || '').trim();
  if (!token) throw new Error('client_token wajib diisi');

  if (!Array.isArray(attendees) || attendees.length === 0) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    if (isTokenSubmitted_(token)) {
      throw new Error('Anda sudah pernah mengisi konfirmasi kehadiran.');
    }

    const nowIso = new Date().toISOString();
    const rows = attendees
      .filter(function(a) { return a && String(a.name || '').trim(); })
      .map(function(a) {
        return [
          Utilities.getUuid(),
          String(a.name || '').trim(),
          String(a.address || '').trim(),
          Math.max(1, Number(a.count || 1)),
          nowIso
        ];
      });

    if (rows.length === 0) return;

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SHEET_HEADERS.length).setValues(rows);
    markTokenSubmitted_(token);
  } finally {
    lock.releaseLock();
  }
}

function updateAttendee_(params) {
  const id = String(params.id || '').trim();
  const rowNumParam = Number(params.row_num || 0);
  if (!id) throw new Error('id wajib diisi');

  const sheet = getSheet_();
  ensureHeader_(sheet);
  ensureUniqueIds_(sheet);
  const rowNum = findRowByRef_(sheet, id, rowNumParam);
  if (!rowNum) throw new Error('Data tamu tidak ditemukan');

  const current = sheet.getRange(rowNum, 1, 1, SHEET_HEADERS.length).getValues()[0];
  const persistedId = String(current[0] || id || Utilities.getUuid());
  const createdAt = String(params.created_at || '') || String(current[4] || new Date().toISOString());

  sheet.getRange(rowNum, 1, 1, SHEET_HEADERS.length).setValues([[
    persistedId,
    String(params.name || '').trim(),
    String(params.address || '').trim(),
    Math.max(1, Number(params.count || current[3] || 1)),
    createdAt
  ]]);
}

function deleteAttendee_(id, rowNumParam) {
  const attendeeId = String(id || '').trim();
  if (!attendeeId) throw new Error('id wajib diisi');

  const sheet = getSheet_();
  ensureHeader_(sheet);
  ensureUniqueIds_(sheet);
  const rowNum = findRowByRef_(sheet, attendeeId, Number(rowNumParam || 0));
  if (!rowNum) throw new Error('Data tamu tidak ditemukan');

  sheet.deleteRow(rowNum);
}

function findRowByRef_(sheet, id, rowNumParam) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  if (id) {
    // Strict mode: when id exists, never fallback to row number.
    // This prevents accidental edits/deletes to the wrong attendee.
    return findRowById_(sheet, id);
  }

  if (rowNumParam && rowNumParam >= 2 && rowNumParam <= lastRow) {
    return rowNumParam;
  }

  return null;
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

function ensureUniqueIds_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const idValues = idRange.getValues();
  const seen = {};
  let changed = false;

  for (var i = 0; i < idValues.length; i++) {
    const raw = String(idValues[i][0] || '').trim();
    if (!raw || seen[raw]) {
      idValues[i][0] = Utilities.getUuid();
      changed = true;
      continue;
    }
    seen[raw] = true;
  }

  if (changed) {
    idRange.setValues(idValues);
  }
}

function isTokenSubmitted_(token) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(SUBMISSION_TOKEN_PREFIX + token) === '1';
}

function markTokenSubmitted_(token) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(SUBMISSION_TOKEN_PREFIX + token, '1');
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
