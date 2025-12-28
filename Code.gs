// Google Apps Script (Code.gs)
// Cấu hình:
const CONFIG = {
  SHEET_ID: 'REPLACE_WITH_YOUR_SHEET_ID',
  ADMIN_PASSWORD: 'change-me',
  // optional: nếu bạn muốn GAS kiểm tra open/close thời gian, set ở đây (ISO strings) hoặc lưu vào Properties
  OPEN_TIME: '',   // e.g. '2025-12-28T08:00:00'
  CLOSE_TIME: '',  // e.g. '2025-12-28T10:00:00'
  EXPORT_XLSX: true, // nếu true sẽ tạo file xlsx copy (Drive Advanced API may be needed)
  XLSX_FOLDER_ID: '' // nếu muốn lưu file xlsx vào folder
};

function doGet(e){
  return ContentService.createTextOutput(JSON.stringify({status:'ready'})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  try{
    const body = e.postData && e.postData.type === 'application/json' ? JSON.parse(e.postData.contents) : {};
    // kiểm tra open/close
    const now = new Date();
    const open = CONFIG.OPEN_TIME ? new Date(CONFIG.OPEN_TIME) : null;
    const close = CONFIG.CLOSE_TIME ? new Date(CONFIG.CLOSE_TIME) : null;
    if(open && now < open) return jsonResponse({error: 'Bai chua mo', detail: {open: CONFIG.OPEN_TIME}});
    if(close && now > close) return jsonResponse({error: 'Bai da dong', detail: {close: CONFIG.CLOSE_TIME}});

    // append to sheet
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName('Responses') || ss.insertSheet('Responses');
    // ensure header
    if(sheet.getLastRow() === 0) sheet.appendRow(['timestamp','name','email','score','total','answers_json']);

    const row = [
      body.timestamp || new Date().toISOString(),
      body.name || '',
      body.email || '',
      body.score || '',
      body.total || '',
      JSON.stringify(body.answers || [])
    ];
    sheet.appendRow(row);

    // optionally create XLSX copy (requires Advanced Drive service or UrlFetch with access token)
    if(CONFIG.EXPORT_XLSX){
      try{
        exportSheetToXlsx(ss);
      }catch(ex){
        // ignore export errors but report
        Logger.log('Export error: ' + ex);
      }
    }

    return jsonResponse({status:'ok'});
  }catch(err){
    return jsonResponse({error: err.toString()});
  }
}

function jsonResponse(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Export spreadsheet to XLSX and save to Drive.
 * Option A (simpler): use Drive REST export endpoint via UrlFetch with ScriptApp.getOAuthToken()
 * This method doesn't require enabling Advanced Drive service.
 */
function exportSheetToXlsx(ss){
  const ssId = ss.getId();
  const url = "https://docs.google.com/feeds/download/spreadsheets/Export?key=" + ssId + "&exportFormat=xlsx";
  const token = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  });
  if(res.getResponseCode() !== 200){
    throw new Error('Export failed: ' + res.getResponseCode());
  }
  const blob = res.getBlob().setName(`responses-${new Date().toISOString().replace(/[:.]/g,'-')}.xlsx`);
  if(CONFIG.XLSX_FOLDER_ID){
    const folder = DriveApp.getFolderById(CONFIG.XLSX_FOLDER_ID);
    folder.createFile(blob);
  } else {
    DriveApp.createFile(blob);
  }
}