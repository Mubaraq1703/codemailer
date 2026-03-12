const xlsx = require('xlsx');
const path = require('path');

const data = [
    { Name: 'John Doe', Email: 'john@example.com', Company: 'Tech Corp' },
    { Name: 'Jane Smith', Email: 'jane@example.com', Company: 'Design Studio' },
    { Name: 'Bob Johnson', Email: 'bob@example.com', Company: 'Marketing Inc' }
];

const ws = xlsx.utils.json_to_sheet(data);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Contacts');

const outputPath = path.join(process.cwd(), 'sample_contacts.xlsx');
xlsx.writeFile(wb, outputPath);

console.log(`Sample Excel file created at: ${outputPath}`);
