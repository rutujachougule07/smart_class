const XLSX = require('xlsx');

try {
  const wb1 = XLSX.readFile('Student_Data.xlsx');
  console.log('=== Student_Data.xlsx Sheets ===', wb1.SheetNames);
  wb1.SheetNames.forEach(sheetName => {
    console.log(`\nSheet: ${sheetName}`);
    const data = XLSX.utils.sheet_to_json(wb1.Sheets[sheetName]);
    console.log(data);
  });
} catch (e) {
  console.log('Error reading Student_Data.xlsx:', e.message);
}

try {
  const wb2 = XLSX.readFile('Demo_School_Data.xlsx');
  console.log('\n=== Demo_School_Data.xlsx Sheets ===', wb2.SheetNames);
  wb2.SheetNames.forEach(sheetName => {
    console.log(`\nSheet: ${sheetName}`);
    const data = XLSX.utils.sheet_to_json(wb2.Sheets[sheetName]);
    console.log(data);
  });
} catch (e) {
  console.log('Error reading Demo_School_Data.xlsx:', e.message);
}
