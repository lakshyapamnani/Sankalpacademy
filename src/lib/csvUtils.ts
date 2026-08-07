// CSV Utility functions for parsing student import CSVs and generating sample CSV templates

export interface ParsedCSVStudent {
  name: string;
  email: string;
  batchName: string;
  password?: string;
  phoneNo?: string;
  parentWhatsApp?: string;
  collegeName?: string;
  studentClass?: string;
  whatsappNo?: string;
  dob?: string;
  isValid: boolean;
  errorReason?: string;
}

/**
 * Parses raw CSV string into structured array of ParsedCSVStudent.
 * Handles quoted fields, escaped quotes, trailing whitespace, and line breaks.
 */
export function parseStudentCSV(csvText: string): ParsedCSVStudent[] {
  const lines = parseCSVRows(csvText);
  if (lines.length === 0) return [];

  // First line is headers
  const headers = lines[0].map(h => normalizeHeaderKey(h));

  const results: ParsedCSVStudent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    // Skip empty lines
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
      continue;
    }

    const rowObj: Record<string, string> = {};
    headers.forEach((headerKey, colIndex) => {
      if (headerKey && colIndex < row.length) {
        rowObj[headerKey] = row[colIndex].trim();
      }
    });

    const name = rowObj.name || rowObj.fullname || rowObj.studentname || "";
    const email = rowObj.email || rowObj.emailaddress || "";
    const batchName = rowObj.batch || rowObj.batchname || rowObj.batchid || "";
    const password = rowObj.password || rowObj.pass || "student123";
    const phoneNo = rowObj.phoneno || rowObj.phone || rowObj.phonenumber || rowObj.mobile || "";
    const parentWhatsApp = rowObj.parentwhatsapp || rowObj.parentphone || rowObj.parentmobile || "";
    const collegeName = rowObj.collegename || rowObj.college || rowObj.school || "";
    const studentClass = rowObj.studentclass || rowObj.class || rowObj.grade || "";
    const whatsappNo = rowObj.whatsappno || rowObj.whatsapp || "";
    const dob = rowObj.dob || rowObj.dateofbirth || "";

    const errors: string[] = [];
    if (!name) errors.push("Missing name");
    if (!email) errors.push("Missing email");
    else if (!email.includes("@")) errors.push("Invalid email format");
    if (!batchName) errors.push("Missing batch name");

    results.push({
      name,
      email,
      batchName,
      password: password || "student123",
      phoneNo: phoneNo || undefined,
      parentWhatsApp: parentWhatsApp || undefined,
      collegeName: collegeName || undefined,
      studentClass: studentClass || undefined,
      whatsappNo: whatsappNo || undefined,
      dob: dob || undefined,
      isValid: errors.length === 0,
      errorReason: errors.length > 0 ? errors.join(", ") : undefined,
    });
  }

  return results;
}

/**
 * Standard CSV line & field parser handling quotes and commas inside quotes.
 */
function parseCSVRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = "";
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped double quotes "" inside quotes
        currentVal += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentVal);
      currentVal = "";
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n in CRLF
      }
      currentRow.push(currentVal);
      rows.push(currentRow);
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Normalizes header string to lower-case alphanumeric key for mapping.
 */
function normalizeHeaderKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Downloads a sample CSV format template file.
 */
export function downloadStudentCSVTemplate() {
  const headers = [
    "Full Name",
    "Email",
    "Batch Name",
    "Password",
    "Phone Number",
    "Parent WhatsApp",
    "College Name",
    "Class/Grade",
    "WhatsApp Number",
    "Date of Birth"
  ];

  const sampleRows = [
    [
      "Rahul Sharma",
      "rahul.sharma@example.com",
      "Batch 2025 A",
      "rahul123",
      "9876543210",
      "9876543211",
      "National College",
      "12th Science",
      "9876543210",
      "2006-05-15"
    ],
    [
      "Priya Patel",
      "priya.patel@example.com",
      "Batch 2025 B",
      "priya123",
      "9876543212",
      "9876543213",
      "City High School",
      "11th Commerce",
      "9876543212",
      "2007-08-20"
    ]
  ];

  const csvContent = [
    headers.join(","),
    ...sampleRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "student_import_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
