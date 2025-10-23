# Time-table-generator
# Automated Timetable Generator

Automated timetable generation using Node.js, Express, MongoDB with CSV upload support.

## Prerequisites

- Node.js (v14+)
- MongoDB (v4.4+)

## Quick Setup

1. **Install MongoDB and start it**:
```bash
mongod
```

2. **Create project structure**:
```bash
mkdir timetable-generator
cd timetable-generator
mkdir views uploads public
```

3. **Install dependencies**:
```bash
npm install
```

4. **Start application**:
```bash
npm start
```

5. **Open browser**: `http://localhost:3000`

## CSV Format

**courses.csv**:
```csv
code,name,faculty,duration,type
CS201,Operating System,Dr. John Doe,1,Lecture
CS201L,Operating System Lab,Dr. John Doe,2,Lab
```

**faculty.csv**:
```csv
name,department,availability
Dr. John Doe,Computer Science,All days
```

**rooms.csv**:
```csv
number,capacity,type
C1,60,Classroom
L1,30,Lab
```

## Features

- Even distribution of classes across all days
- No faculty/room conflicts
- Smart room allocation (Labs → Lab rooms)
- Consecutive slots for multi-hour classes
- Color-coded view (Blue=Lectures, Red=Labs, Green=Tutorials)
- CSV export and print support

## Usage

1. Upload courses, faculty, and rooms CSV files
2. Click "Generate Timetable"
3. View, download, or print the timetable

## Troubleshooting

**MongoDB error**: Ensure MongoDB is running (`mongod`)

**Upload fails**: Check CSV format matches exactly with headers

**Generation fails**: Upload all 3 CSV files first

**Undefined error**: Ensure no empty cells in CSV files

## File Structure
```
timetable-generator/
├── server.js
├── package.json
├── views/
│   ├── index.ejs
│   └── timetable.ejs
└── uploads/
```

---

**Note**: Make sure all CSV column headers match exactly (case-sensitive)
