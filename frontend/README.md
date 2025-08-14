# 🎨 AI-RAG Frontend

> **The beautiful interface for your AI research assistant. Modern, responsive, and easy to use.**

[![React](https://img.shields.io/badge/React-19.1.0-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Latest-green.svg)](https://nodejs.org/)
[![FontAwesome](https://img.shields.io/badge/FontAwesome-6.7.2-lightgrey.svg)](https://fontawesome.com/)

---

## 🎯 What You'll Find Here

### 🎨 **Beautiful User Interface**
- **Works on any device** - desktop, tablet, or mobile
- **Dark and light themes** - choose what works best for you
- **Smooth animations** - pleasant interactions throughout
- **Loading indicators** - know when things are happening

### 📱 **Easy to Use**

#### **Sidebar Navigation**
- **Organize with projects** - group related research together
- **Find anything quickly** - search across all your work
- **Manage files easily** - view and organize your documents
- **Switch themes** - dark or light mode with one click

#### **Chat Interface**
- **Natural conversations** - chat with your documents
- **Upload files easily** - drag and drop or click to upload
- **Edit your questions** - improve and refine your queries
- **Smart suggestions** - AI helps you ask better questions

#### **Project Organization**
- **Create project folders** - keep related work together
- **Nested conversations** - chats within projects
- **Quick actions** - create new chats with one click
- **Bulk management** - handle multiple items efficiently

---

## 🚀 Get Started

### What You Need
- **Node.js** (version 16 or higher)
- **Backend server** running on `http://localhost:5000`

### Quick Setup

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Your app will open at http://localhost:3000
```

### Build for Production

```bash
# Create an optimized build
npm run build

# The build will be in the 'build' folder
```

---

## 🏗️ How It's Built

### **Main Components**

#### **App.js** - The Heart of the Application
```javascript
// Core state management
const [chats, setChats] = useState([]);
const [projects, setProjects] = useState([]);
const [activeChatIndex, setActiveChatIndex] = useState(null);
const [darkMode, setDarkMode] = useState(false);
```

#### **What It Does**
- **Manages state** - keeps track of chats, projects, and settings
- **Handles API calls** - communicates with the backend
- **Manages user interactions** - handles clicks, uploads, and form submissions
- **Controls themes** - switches between dark and light modes
- **Handles files** - uploads, views, and manages documents

### **Component Structure**

```
App.js
├── Sidebar
│   ├── Search
│   ├── Action Buttons
│   ├── Projects
│   ├── Chats
│   └── Theme Toggle
├── Chat Area
│   ├── Header
│   ├── Messages
│   └── Input Area
└── Modals
    ├── Settings
    ├── File Viewer
    └── Confirmation Dialogs
```

---

## 🎨 Design Features

### **Responsive Design**

**Desktop Layout**
```css
.app {
  display: grid;
  grid-template-columns: 260px 1fr;
  height: 100vh;
  overflow: hidden;
}
```

**Mobile Friendly**
- **Collapsible sidebar** - saves space on small screens
- **Touch optimized** - easy to use on phones and tablets
- **Readable text** - appropriate sizes for all devices
- **Efficient layout** - maximizes content area

### **Theme System**

**CSS Variables**
```css
:root {
  --primary-color: #9ca3af;
  --secondary-color: #6b7280;
  --background-light: #ffffff;
  --background-dark: #111827;
  --text-light: #374151;
  --text-dark: #f3f4f6;
}
```

**Theme Switching**
```javascript
const toggleDarkMode = () => {
  setDarkMode((prev) => !prev);
};

useEffect(() => {
  document.documentElement.classList.toggle("dark", darkMode);
}, [darkMode]);
```

### **Interactive Elements**

**Hover Effects**
```css
.chat-history-item:hover {
  background: var(--hover-light);
  transform: translateX(2px);
  transition: all 0.2s ease;
}
```

**Loading States**
```javascript
const [generatingInfographic, setGeneratingInfographic] = useState(false);

// Loading indicator
{generatingInfographic ? (
  <span style={{ animation: 'pulse 1.5s infinite' }}>🔄</span>
) : (
  "Infographic"
)}
```

---

## 🔧 Technical Details

### **Core Technologies**
- **React 19.1.0** - Modern UI framework
- **FontAwesome 6.7.2** - Beautiful icons
- **CSS Variables** - Flexible theming system
- **Fetch API** - Communication with backend

### **State Management**

#### **Application State**
```javascript
// Chat and project management
const [chats, setChats] = useState([]);
const [projects, setProjects] = useState([]);
const [activeChatIndex, setActiveChatIndex] = useState(null);
const [activeProjectId, setActiveProjectId] = useState(null);

// UI state
const [darkMode, setDarkMode] = useState(false);
const [menuOpenIndex, setMenuOpenIndex] = useState(null);
const [showSettings, setShowSettings] = useState(false);

// File management
const [pdfsMap, setPdfsMap] = useState({});
const [selectedPdf, setSelectedPdf] = useState(null);
```

#### **API Communication**
```javascript
// Fetch chats with project information
const fetchChats = useCallback(async (preserveActiveChat = false) => {
  try {
    const res = await fetch("http://localhost:5000/chats");
    const data = await res.json();
    setChats(data);
  } catch (err) {
    setError("Failed to load chats");
  }
}, []);
```

### **File Handling**

#### **File Upload**
```javascript
const handleFileChange = async (e) => {
  const file = e.target.files[0];
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`http://localhost:5000/upload/${activeChat.id}`, {
    method: "POST",
    body: formData,
  });
};
```

#### **File Display**
```javascript
// PDF viewer modal
{selectedPdf && (
  <div className="modal-overlay">
    <div className="modal-content pdf-viewer-modal">
      <iframe
        src={`http://localhost:5000/files/${selectedPdf.id}/view`}
        title={selectedPdf.filename}
        width="100%"
        height="600px"
      />
    </div>
  </div>
)}
```

---

## 🎨 Styling System

### **CSS Architecture**

#### **Base Styles**
```css
/* Modern CSS Reset and Variables */
:root {
  --primary-color: #9ca3af;
  --secondary-color: #6b7280;
  /* ... more variables */
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

#### **Component Styles**
```css
/* Sidebar styling */
.sidebar {
  background: var(--sidebar-light);
  border-right: 1px solid var(--border-light);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100vh;
  overflow-y: auto;
}

/* Message styling */
.message {
  max-width: 80%;
  padding: 1rem 1.5rem;
  border-radius: 1rem;
  position: relative;
  line-height: 1.6;
}
```

### **Responsive Design**

#### **Grid Layout**
```css
.app {
  display: grid;
  grid-template-columns: 260px 1fr;
  height: 100vh;
  overflow: hidden;
}

@media (max-width: 768px) {
  .app {
    grid-template-columns: 1fr;
  }
}
```

#### **Flexible Components**
```css
.chat-window {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
```

---

## 🔍 Search Functionality

### **Global Search**

#### **Search State**
```javascript
const [searchQuery, setSearchQuery] = useState("");
const [showSearchResults, setShowSearchResults] = useState(false);
```

#### **Search Logic**
```javascript
const getSearchResults = () => {
  if (!searchQuery.trim()) return [];
  
  const query = searchQuery.toLowerCase();
  return chats.filter(chat => 
    chat.title.toLowerCase().includes(query) ||
    (chat.messages && chat.messages.some(msg => {
      if (typeof msg.content === 'string') {
        return msg.content.toLowerCase().includes(query);
      }
      return false;
    }))
  );
};
```

#### **Search Interface**
```javascript
<div className="search-container">
  <FontAwesomeIcon icon={faSearch} className="search-icon" />
  <input
    type="text"
    placeholder="Search chats..."
    value={searchQuery}
    onChange={(e) => handleSearch(e.target.value)}
    className="search-input"
  />
</div>
```

---

## 📱 Project Management

### **Project Organization**

#### **Project Structure**
```javascript
// Project container with nested chats
<div className="project-container">
  <div className="project-item">
    <FontAwesomeIcon icon={faFolder} />
    <span className="project-name">{project.name}</span>
    <button className="project-new-chat-button">
      <FontAwesomeIcon icon={faPlus} />
    </button>
  </div>
  
  {/* Nested chats */}
  <div className="project-chats">
    {projectChats.map((chat) => (
      <div className="project-chat-item">
        <span className="chat-title">{chat.title}</span>
      </div>
    ))}
  </div>
</div>
```

#### **Bulk Operations**
```javascript
// Bulk selection state
const [selectedProjects, setSelectedProjects] = useState([]);
const [selectedChats, setSelectedChats] = useState([]);

// Bulk delete functionality
const confirmBulkDelete = async () => {
  for (const chatId of selectedChats) {
    await fetch(`http://localhost:5000/chats/${chatId}`, { 
      method: 'DELETE' 
    });
  }
  setChats((prev) => prev.filter((chat) => !selectedChats.includes(chat.id)));
};
```

---

## 🎨 Infographic Display

### **Infographic Viewer**

#### **Multiple Styles**
```javascript
const [selectedInfographic, setSelectedInfographic] = useState('primary');

// Style selector
<div className="infographic-style-selector">
  <button
    className={`style-btn ${selectedInfographic === 'primary' ? 'active' : ''}`}
    onClick={() => setSelectedInfographic('primary')}
  >
    Style 1
  </button>
  <button
    className={`style-btn ${selectedInfographic === 'alternative' ? 'active' : ''}`}
    onClick={() => setSelectedInfographic('alternative')}
  >
    Style 2
  </button>
</div>
```

#### **Download Functionality**
```javascript
const handleDownloadInfographic = async (imageUrl) => {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `infographic-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

---

## 🔧 Development

### **Development Commands**

```bash
# Start development server
npm start

# Run tests
npm test

# Build for production
npm run build

# Eject from Create React App
npm run eject
```

### **Code Organization**

#### **File Structure**
```
src/
├── App.js              # Main application component
├── App.css             # Main styles
├── index.js            # Application entry point
├── index.css           # Global styles
└── components/         # Reusable components (if any)
```

#### **Component Patterns**
```javascript
// Functional components with hooks
function App() {
  const [state, setState] = useState(initialState);
  
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  const handleEvent = useCallback(() => {
    // Event handlers
  }, [dependencies]);
  
  return (
    <div className="app">
      {/* JSX */}
    </div>
  );
}
```

### **Best Practices**

#### **Performance Optimization**
```javascript
// Memoized callbacks
const handleSend = useCallback(async (customInput) => {
  // Implementation
}, [dependencies]);

// Conditional rendering
{activeChat && (
  <div className="chat-content">
    {/* Content */}
  </div>
)}
```

#### **Error Handling**
```javascript
// Try-catch in async functions
try {
  const response = await fetch(url);
  const data = await response.json();
  setState(data);
} catch (error) {
  setError("Failed to load data");
  console.error("Error:", error);
}
```

---

## 🐛 Common Issues

### **CORS Errors**
- Make sure the backend CORS is configured to allow requests from `http://localhost:3000`

### **API Connection Issues**
```javascript
// Check if backend is running on correct port
const API_BASE_URL = 'http://localhost:5000';

// Test connection
fetch(`${API_BASE_URL}/chats`)
  .then(response => response.json())
  .catch(error => console.error('API Error:', error));
```

### **File Upload Issues**
```javascript
// Check file size and type
const maxFileSize = 50 * 1024 * 1024; // 50MB
const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

if (file.size > maxFileSize) {
  setError("File too large");
  return;
}
```

---

## 📄 License

This project is open source and available under the **MIT License**.

---

## 🤝 Contributing

### **Frontend Development Guidelines**

- ✅ Use functional components with hooks
- ✅ Implement proper error boundaries
- ✅ Follow React best practices
- ✅ Use CSS variables for theming
- ✅ Ensure responsive design
- ✅ Add proper accessibility attributes
- ✅ Optimize for performance

### **Code Example**

```javascript
// Example of proper component structure
const ChatItem = ({ chat, isActive, onClick }) => {
  const handleClick = useCallback(() => {
    onClick(chat.id);
  }, [chat.id, onClick]);

  return (
    <div 
      className={`chat-item ${isActive ? 'active' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <span className="chat-title">{chat.title}</span>
    </div>
  );
};
```

---

<div align="center">

### 🎨 **Frontend Ready**

**[UI Features](#-what-youll-find-here)** • **[Component Architecture](#-how-its-built)** • **[Styling System](#-styling-system)**

Built with React 19, modern CSS, and professional UI/UX design.

</div>