# 🔧 AI-RAG Backend

> **The server that powers your AI research assistant. Handles file uploads, AI conversations, and infographic generation.**

[![Express.js](https://img.shields.io/badge/Express.js-5.1.0-green.svg)](https://expressjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-Latest-green.svg)](https://nodejs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-5.12.1-orange.svg)](https://openai.com/)

---

## 🚀 Quick Start

### What You Need
- **Node.js** (version 16 or higher)
- **OpenAI API key** (get one at [openai.com](https://openai.com))

### Get Running

```bash
# Install dependencies
npm install

# Start the server
node server.js

# Server will be available at http://localhost:5000
```

### Optional Configuration

Create a `.env` file in the backend directory:

```env
# Optional: Set default OpenAI API key
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Customize server port
PORT=5000
```

---

## 📊 How Data is Stored

### **Projects** - Organize your research
```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Chats** - Your conversations
```sql
CREATE TABLE chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT DEFAULT 'Untitled',
  messages TEXT,
  project_id INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### **Files** - Your uploaded documents
```sql
CREATE TABLE pdfs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER,
  filename TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  mimetype TEXT,
  file_content BLOB,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
```

---

## 🔗 API Endpoints

### **Chat Management**

**Get all chats**
```http
GET /chats
```

**Create a new chat**
```http
POST /chats
{
  "title": "New Chat",
  "project_id": 1
}
```

**Rename a chat**
```http
PUT /chats/:chatId
{
  "title": "Updated Chat Title"
}
```

**Delete a chat**
```http
DELETE /chats/:chatId
```

**Save messages**
```http
POST /chats/:chatId/messages
{
  "messages": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"}
  ]
}
```

### **Project Management**

**Get all projects**
```http
GET /projects
```

**Create a project**
```http
POST /projects
{
  "name": "New Project"
}
```

**Update project name**
```http
PUT /projects/:projectId
{
  "name": "Updated Project Name"
}
```

**Delete a project**
```http
DELETE /projects/:projectId
```

### **File Operations**

**Upload a file**
```http
POST /upload/:chatId
Content-Type: multipart/form-data
```

**Get chat files**
```http
GET /chats/:chatId/pdfs
```

**Download a file**
```http
GET /files/:fileId/download
```

**View a file**
```http
GET /files/:fileId/view
```

### **AI Services**

**Ask a question**
```http
POST /api/ask
{
  "question": "What are the main findings?",
  "chatId": 1
}
```

**Generate infographic**
```http
POST /api/generate-infographic
{
  "chatId": 1
}
```

**Set API key**
```http
POST /api/set-openai-key
{
  "apikey": "sk-your-openai-api-key"
}
```

---

## 🛠️ How It Works

### **Core Technologies**
- **Express.js** - Web framework for handling requests
- **SQLite** - Simple database for storing data locally
- **OpenAI** - AI models for understanding and creating content
- **PDF-Parse** - Extract text from PDF documents
- **Multer** - Handle file uploads

### **Key Features**

**PDF Processing**
```javascript
// Extract text from uploaded PDFs
const pdfData = await pdf(fileBuffer);
const pdfText = pdfData.text;

// Use the text for AI conversations
const context = `Document content: ${pdfText}`;
```

**AI Integration**
```javascript
// Initialize OpenAI client
let openai = null;

// Set API key at runtime
app.post('/api/set-openai-key', (req, res) => {
  const apiKey = req.body.apikey;
  openai = new OpenAI({ apiKey });
  res.json({ success: true });
});
```

**Database Operations**
```javascript
// Safe database queries with error handling
const chatRow = await new Promise((resolve, reject) => {
  db.get('SELECT * FROM chats WHERE id = ?', [chatId], (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});
```

### **File Storage**
- **Local storage** - All files stored in SQLite database
- **No cloud dependencies** - Complete privacy and control
- **Automatic cleanup** - Files deleted when chats are deleted
- **Secure handling** - File type and size validation

### **Security Features**
- Input validation and sanitization
- File type restrictions (PDF and images only)
- Size limits (50MB maximum)
- Secure file path handling
- CORS configuration for frontend access

---

## 🔧 Development

### **Running in Development**

```bash
# Install dependencies
npm install

# Start with auto-restart (if nodemon installed)
npx nodemon server.js

# Or start normally
node server.js
```

### **Testing the API**

```bash
# Test server health
curl http://localhost:5000/chats

# Test file upload
curl -X POST -F "file=@document.pdf" http://localhost:5000/upload/1

# Test AI Q&A
curl -X POST -H "Content-Type: application/json" \
  -d '{"question":"Hello","chatId":1}' \
  http://localhost:5000/api/ask
```

### **Database Management**

```bash
# Access SQLite database
sqlite3 files.db

# View tables
.tables

# View schema
.schema

# Export data
.mode csv
.headers on
.output export.csv
SELECT * FROM chats;
```

---

## 🐛 Common Issues

### **OpenAI API Problems**
```javascript
// Check if API key is set
console.log('OpenAI client initialized:', !!openai);

// Verify API key format
if (!apiKey.startsWith('sk-')) {
  return res.status(400).json({ error: 'Invalid API key format' });
}
```

### **File Upload Issues**
```javascript
// Check file size
if (file.size > 50 * 1024 * 1024) {
  return res.status(400).send('File too large');
}

// Check file type
const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
if (!allowedTypes.includes(file.mimetype)) {
  return res.status(400).send('Invalid file type');
}
```

### **Database Issues**
- Make sure you have write permissions in the backend directory
- Check that SQLite is properly installed
- Verify the database file can be created

---

## 📄 License

This project is open source and available under the **MIT License**.

---

## 🤝 Contributing

### **Backend Development Guidelines**

- ✅ Use async/await for database operations
- ✅ Implement proper error handling
- ✅ Validate all input data
- ✅ Use prepared statements for SQL queries
- ✅ Follow RESTful API conventions
- ✅ Add helpful error messages
- ✅ Use proper HTTP status codes

### **Code Example**

```javascript
// Good error handling
try {
  const result = await processRequest(req.body);
  res.json(result);
} catch (error) {
  console.error('Error processing request:', error);
  res.status(500).json({ error: 'Something went wrong' });
}
```

---

<div align="center">

### 🔧 **Backend Ready**

**[API Documentation](#-api-endpoints)** • **[Database Schema](#-how-data-is-stored)** • **[Development Guide](#-development)**

Built with Express.js, SQLite, and OpenAI integration.

</div>