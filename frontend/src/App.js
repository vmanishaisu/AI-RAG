import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperclip, faGear, faImage, faEye, faEyeSlash, faFolder, faPlus, faSearch, faFilePen, faFolderPlus, faArrowDown, faFilePdf, faArrowUp } from "@fortawesome/free-solid-svg-icons";

function App() {
  const [chats, setChats] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeChatIndex, setActiveChatIndex] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [input, setInput] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpenIndex, setMenuOpenIndex] = useState(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameTargetIndex, setRenameTargetIndex] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [showBulkDeleteProjectsModal, setShowBulkDeleteProjectsModal] = useState(false);
  const [selectedProjectChats, setSelectedProjectChats] = useState({}); // Track selected chats for each project
  const [showBulkDeleteProjectChatsModal, setShowBulkDeleteProjectChatsModal] = useState(false);
  const [bulkDeleteProjectId, setBulkDeleteProjectId] = useState(null);
  const [fileMenuOpenId, setFileMenuOpenId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [followupsByChat, setFollowupsByChat] = useState({});
  const [generatingInfographic, setGeneratingInfographic] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [infographicUrl, setInfographicUrl] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [alternativeInfographicUrl, setAlternativeInfographicUrl] = useState(null);
  const [selectedInfographic, setSelectedInfographic] = useState('primary');
  const [greetingMessage, setGreetingMessage] = useState("");
  const [pdfsMap, setPdfsMap] = useState({}); // Store PDFs for each chat
  const [expandedPdfLists, setExpandedPdfLists] = useState({}); // Track which PDF lists are expanded
  const [selectedPdf, setSelectedPdf] = useState(null); // Track selected PDF for viewing
  

  
  // Search functionality state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Project management state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [showRenameProjectModal, setShowRenameProjectModal] = useState(false);
  const [renameProjectValue, setRenameProjectValue] = useState("");
  const [renameProjectId, setRenameProjectId] = useState(null);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState(null);
  const [projectMenuOpenId, setProjectMenuOpenId] = useState(null);

  // Track initialization to prevent multiple calls
  const isInitializedRef = useRef(false);

  // Generate random placeholder messages for empty chats
  const getRandomPlaceholder = () => {
    const placeholders = [
      "Hi! 👋 What's on your mind today?",
      "Ask me anything about your documents! 📚",
      "Ready to explore your PDFs? 🔍",
      "What would you like to know? 🤔",
      "Upload a PDF and let's dive in! 📄",
      "Curious about something? Just ask! 💭",
      "I'm here to help with your research! 🧠",
      "What questions do you have? ❓",
      "Let's analyze your documents together! 📊",
      "Ready to discover insights? 💡"
    ];
    return placeholders[Math.floor(Math.random() * placeholders.length)];
  };

  const activeChat = activeChatIndex !== null ? chats[activeChatIndex] : null;

  // Project management functions
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5000/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      setError("Failed to load projects");
    }
  }, []); 

  const fetchChats = useCallback(async (preserveActiveChat = false) => {
    
    setChatsLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:5000/chats");
     
      
      if (!res.ok) {
        console.error("❌ Response not OK:", res.status, res.statusText);
        throw new Error(`Failed to load chats: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
     
      // If we need to preserve the active chat, find the current active chat ID
      let activeChatId = null;
      if (preserveActiveChat && activeChatIndex !== null && chats[activeChatIndex]) {
        activeChatId = chats[activeChatIndex].id;
      }
      
      setChats(data);
      
      // Extract follow-up questions from messages and populate followupsByChat
      const newFollowupsByChat = {};
      data.forEach(chat => {
        if (chat.messages && Array.isArray(chat.messages)) {
          const followupMessage = chat.messages.find(msg => msg && msg.role === 'followup-questions');
          if (followupMessage && Array.isArray(followupMessage.content)) {
            newFollowupsByChat[chat.id] = followupMessage.content;
          }
        }
      });
      setFollowupsByChat(newFollowupsByChat);
      
      // If we need to preserve the active chat, find the new index
      if (preserveActiveChat && activeChatId) {
        const newActiveIndex = data.findIndex(chat => chat.id === activeChatId);

        if (newActiveIndex !== -1) {
          setActiveChatIndex(newActiveIndex);
        }
      }

      // Download the list of PDFs for every chat and store them in state
      const newPdfsMap = {};
      await Promise.all(
        data.map(async (chat) => {
          try {
            const resPdfs = await fetch(`http://localhost:5000/chats/${chat.id}/pdfs`);
            if (resPdfs.ok) {
              const pdfs = await resPdfs.json();
              newPdfsMap[chat.id] = pdfs;
            } else {
              newPdfsMap[chat.id] = [];
            }
          } catch (pdfErr) {
            newPdfsMap[chat.id] = [];
          }
        })
      );
      setPdfsMap(newPdfsMap);
      
    } catch (err) {
      console.error("❌ Error in fetchChats:", err);
      console.error("❌ Error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      setError("Failed to load chats");
    } finally {
      setChatsLoading(false);
    }
  }, []); 

  // Close the chat menu when user clicks outside of it
  const menuRef = React.useRef();
  useEffect(() => {
    if (menuOpenIndex === null) return;
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpenIndex(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenIndex]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // eslint-disable-next-line no-use-before-define
  useEffect(() => {
    // Prevent multiple initialization calls
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    
    let isMounted = true;
    
    const initializeApp = async () => {
      if (isMounted) {
        await fetchChats();
        await fetchProjects();
        // Initialize greeting message once when component mounts
        setGreetingMessage(getRandomPlaceholder());
      }
    };
    
    initializeApp();
    
    return () => {
      isMounted = false;
      isInitializedRef.current = false; // Reset for potential remount
    };
  }, []); 
  // Auto-select first project if none is selected
  useEffect(() => {
    if (activeProjectId === null && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

  useEffect(() => {
    if (activeChatIndex !== null && (activeChatIndex < 0 || activeChatIndex >= chats.length)) {
      setActiveChatIndex(null);
    }
  }, [chats, activeChatIndex]);



  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleNewProject = async () => {
    if (!newProjectName.trim() || isCreatingProject) return;
    
    // Creating new project
    setIsCreatingProject(true);
    
    // Add a small delay to prevent rapid successive calls
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const res = await fetch("http://localhost:5000/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      const newProject = await res.json();
              // Project created successfully
      setProjects(prev => [newProject, ...prev]);
      setShowNewProjectModal(false);
      setNewProjectName("");
      setActiveProjectId(newProject.id);
    } catch (err) {
      setError("Failed to create project");
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleRenameProject = async () => {
    if (!renameProjectId || !renameProjectValue.trim()) return;
    
    try {
      const res = await fetch(`http://localhost:5000/projects/${renameProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameProjectValue.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename project");
      setProjects(prev => prev.map(p => 
        p.id === renameProjectId ? { ...p, name: renameProjectValue.trim() } : p
      ));
      setShowRenameProjectModal(false);
      setRenameProjectValue("");
      setRenameProjectId(null);
    } catch (err) {
      setError("Failed to rename project");
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return;
    
    try {
      const res = await fetch(`http://localhost:5000/projects/${deleteProjectId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete project");
      setProjects(prev => {
        const updatedProjects = prev.filter(p => p.id !== deleteProjectId);
        // Auto-select the first remaining project if the deleted one was active
        if (activeProjectId === deleteProjectId && updatedProjects.length > 0) {
          setActiveProjectId(updatedProjects[0].id);
        }
        return updatedProjects;
      });
      setChats(prev => prev.filter(chat => chat.project_id !== deleteProjectId));
      if (activeProjectId === deleteProjectId) {
        setActiveChatIndex(null);
      }
      setShowDeleteProjectModal(false);
      setDeleteProjectId(null);
    } catch (err) {
      setError("Failed to delete project");
    }
  };

  const handleProjectClick = (projectId) => {

    
          setActiveProjectId(projectId);    
      // Find the first chat in this project and auto-select it
      const projectChats = chats.filter(chat => chat.project_id === projectId);
    
    
    if (projectChats.length > 0) {
      // Find the index of the first chat in the full chats array
      const firstChatIndex = chats.findIndex(chat => chat.id === projectChats[0].id);
      
      if (firstChatIndex !== -1) {
        setActiveChatIndex(firstChatIndex);
        
      }
    } else {
      // If no chats exist in this project, clear the active chat
      setActiveChatIndex(null);
      
    }
  };

  const handleNewChatInProject = async (projectId) => {

    
    try {
      const res = await fetch(`http://localhost:5000/projects/${projectId}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const newChat = await res.json();
      
      // Ensure the project is active first
      setActiveProjectId(projectId);

      
      // Re-fetch all chats to ensure we have the latest state
      await fetchChats();
      
      // Find the newly created chat in the full chats array and set it as active
      const updatedChats = await fetch("http://localhost:5000/chats").then(res => res.json());
      const newChatIndex = updatedChats.findIndex(chat => chat.id === newChat.id);
      
      if (newChatIndex !== -1) {
        setActiveChatIndex(newChatIndex);
      }
      
      // Clear input and set up the new chat
      setInput("");
      setFollowupsByChat(prev => ({
        ...prev,
        [newChat.id]: []
      }));
      setGreetingMessage(getRandomPlaceholder());
    } catch (err) {
      setError("Failed to create new chat in project");
    }
  };

  // Get filtered chats based on active project

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const handleSend = async (customInput) => {
    const question = customInput !== undefined ? customInput : input;
    if (!question.trim()) return;
    

    
    setUploadMessage("");
    const userMessage = { role: "user", content: question };
    const assistantReply = { role: "assistant", content: "Processing your query..." };
    const updatedChats = [...chats];

    if (activeChatIndex === null) {

      try {
        // Use the project-specific endpoint if a project is selected
        const endpoint = activeProjectId 
          ? `http://localhost:5000/projects/${activeProjectId}/chats`
          : "http://localhost:5000/chats";
        
        const requestBody = activeProjectId 
          ? { title: "New Chat" }
          : { title: "New Chat", project_id: activeProjectId };
        

        
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!res.ok) throw new Error("Failed to create chat");
        const newChat = await res.json();

        newChat.messages = [userMessage, assistantReply];
        
        // Re-fetch chats to ensure we have the latest state with correct project associations
        await fetchChats();
        
        // Find the newly created chat and set it as active
        const updatedChats = await fetch("http://localhost:5000/chats").then(res => res.json());
        const newChatIndex = updatedChats.findIndex(chat => chat.id === newChat.id);

        
        if (newChatIndex !== -1) {
          setActiveChatIndex(newChatIndex);
        }
        
        await saveMessages(newChat.id, newChat.messages);
        // After creating a new chat, send the user's question to OpenAI
        fetchOpenAIAnswer(question, newChat.id, 1);
      } catch (err) {
        setError("Failed to create chat or send message");
      }
    } else {
      
      if (!updatedChats[activeChatIndex].messages) {
        updatedChats[activeChatIndex].messages = [];
      }
      updatedChats[activeChatIndex].messages.push(userMessage, assistantReply);
      setChats(updatedChats);
      try {
        await saveMessages(updatedChats[activeChatIndex].id, updatedChats[activeChatIndex].messages);
        // After saving a new message, send the user's question to OpenAI
        fetchOpenAIAnswer(question, updatedChats[activeChatIndex].id, updatedChats[activeChatIndex].messages.length - 1);
      } catch (err) {
        setError("Failed to save messages");
      }
    }

    setInput("");
  };

  // Get an answer from OpenAI and update the assistant's reply in the chat
  const fetchOpenAIAnswer = async (question, chatId, assistantMsgIndex) => {
    try {
      const res = await fetch("http://localhost:5000/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, chatId }),
      });
      if (!res.ok) throw new Error("Failed to get answer from OpenAI");
      const data = await res.json();
      
      // Update messages first
      setChats((prevChats) => {
        const chatsCopy = [...prevChats];
        const chatIdx = chatsCopy.findIndex((c) => c.id === chatId);
        if (chatIdx !== -1 && Array.isArray(chatsCopy[chatIdx].messages)) {
          chatsCopy[chatIdx].messages[assistantMsgIndex] = { role: "assistant", content: data.answer };
        }
        return chatsCopy;
      });
      
      setFollowupsByChat(prev => ({
        ...prev,
        [chatId]: data.followups || []
      }));
      
      // Save the updated messages to the backend after getting a response
      // Use functional update to get the most current state
      setChats((prevChats) => {
        const currentChat = prevChats.find(c => c.id === chatId);
        if (currentChat) {
          const updatedMessages = [...currentChat.messages];
          updatedMessages[assistantMsgIndex] = { role: "assistant", content: data.answer };
          // Save messages with the updated state
          saveMessages(chatId, updatedMessages);
        }
        return prevChats;
      });
    } catch (err) {
      setChats((prevChats) => {
        const chatsCopy = [...prevChats];
        const chatIdx = chatsCopy.findIndex((c) => c.id === chatId);
        if (chatIdx !== -1 && Array.isArray(chatsCopy[chatIdx].messages)) {
          chatsCopy[chatIdx].messages[assistantMsgIndex] = { role: "assistant", content: "Failed to get answer from OpenAI." };
        }
        return chatsCopy;
      });
      setFollowupsByChat(prev => ({
        ...prev,
        [chatId]: []
      }));
    }
  };

  const saveMessages = async (chatId, messages) => {
    try {
      const res = await fetch(`http://localhost:5000/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
                  if (!res.ok) throw new Error("Failed to save messages");
            
            const responseData = await res.json();
            
            // Update the chat title immediately if it was changed
            if (responseData.success && responseData.title) {
              setChats(prevChats => {
                const updatedChats = prevChats.map(chat => {
                  if (chat.id === chatId) {
                    return { ...chat, title: responseData.title };
                  }
                  return chat;
                });
                return updatedChats;
              });
            }
      
      return true;
    } catch (err) {
      setError("Failed to save messages");
      return false;
    }
  };

  const handleNewChat = async () => {

    
    try {
      // Clear any active project when creating a common chat
      setActiveProjectId(null);
      
      
      // Always use the common chats endpoint
      const endpoint = "http://localhost:5000/chats";
      const requestBody = { title: "New Chat" };
      
      
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const newChat = await res.json();
      
      
      // Re-fetch all chats to ensure we have the latest state
      await fetchChats();
      
      // Find the newly created chat and set it as active
      const updatedChats = await fetch("http://localhost:5000/chats").then(res => res.json());
      const newChatIndex = updatedChats.findIndex(chat => chat.id === newChat.id);      
      if (newChatIndex !== -1) {
        setActiveChatIndex(newChatIndex);
      }
      
      setInput("");
      setFollowupsByChat(prev => ({
        ...prev,
        [newChat.id]: []
      }));
      // Generate a new greeting for the new chat
      setGreetingMessage(getRandomPlaceholder());
    } catch (err) {
      console.error("❌ Error in handleNewChat:", err);
      setError("Failed to create new chat");
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChat) {
      setUploadMessage(file ? "❌ Please select a chat first." : "");
      return;
    }

    setUploadMessage("Uploading...");
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      //  Upload the file
      const res = await fetch(`http://localhost:5000/upload/${activeChat.id}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const uploadedFile = await res.json();
      setUploadMessage(""); // Clear "Uploading..." message on success

      // Update chat title if it was changed by the backend
      if (uploadedFile.title && uploadedFile.title !== activeChat.title) {
        setChats(prevChats => prevChats.map(chat => 
          chat.id === activeChat.id ? { ...chat, title: uploadedFile.title } : chat
        ));
      }

      //  Create a file message
      const fileMessage = {
        role: 'file',
        content: {
          name: uploadedFile.filename,
          type: file.type,
        }
      };

      // If there are followup questions, parse them and store as followup suggestions
      if (uploadedFile.researchAnalysis) {
        // Parse the questions from the research analysis text
        const questionsText = uploadedFile.researchAnalysis;
        const questions = questionsText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.match(/^\d+\./)) // Only lines that start with a number and period
          .map(line => line.replace(/^\d+\.\s*/, '')) // Remove the number and period
          .filter(question => question.length > 0); // Remove empty questions
                
        // Store the questions as followup suggestions for this chat
        setFollowupsByChat(prev => ({
          ...prev,
          [activeChat.id]: questions
        }));
        
        // Create a followup questions message to persist in database
        const followupMessage = {
          role: 'followup-questions',
          content: questions
        };
        
        // Add only the file message and followup questions message (no text response)
        const updatedChats = chats.map((chat, index) => {
          if (index === activeChatIndex) {
            const updatedMessages = [...(chat.messages || []), fileMessage, followupMessage];
            return { ...chat, messages: updatedMessages };
          }
          return chat;
        });
        
        setChats(updatedChats);
        const updatedChat = updatedChats[activeChatIndex];
        if (updatedChat) {
          await saveMessages(updatedChat.id, updatedChat.messages);
        }
      } else {
        // Add only the file message if no followup questions
        const updatedChats = chats.map((chat, index) => {
          if (index === activeChatIndex) {
            const updatedMessages = [...(chat.messages || []), fileMessage];
            return { ...chat, messages: updatedMessages };
          }
          return chat;
        });
        
        setChats(updatedChats);
        const updatedChat = updatedChats[activeChatIndex];
        if (updatedChat) {
          await saveMessages(updatedChat.id, updatedChat.messages);
        }
      }

      // 5. Refresh sidebar PDF list
      const resPdfs = await fetch(`http://localhost:5000/chats/${activeChat.id}/pdfs`);
      if (resPdfs.ok) {
        const pdfs = await resPdfs.json();
        setPdfsMap(prev => ({
          ...prev,
          [activeChat.id]: pdfs
        }));
      }
    } catch (err) {
      setUploadMessage("❌ Upload failed. Please try again.");
    } finally {
      // Reset the file input so the same file can be uploaded again
      e.target.value = null;
    }
  };

  // Delete chat and update the UI
  const handleDeleteChat = async (index) => {
    const chat = chats[index];
    if (!chat) return;
    try {
      const res = await fetch(`http://localhost:5000/chats/${chat.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete chat");
      setChats((prev) => prev.filter((_, i) => i !== index));
      setActiveChatIndex((prev) => {
        if (prev === index) return null;
        if (prev > index) return prev - 1;
        return prev;
      });
      setMenuOpenIndex(null);
      setShowDeleteModal(false);
    } catch (err) {
      setError("Failed to delete chat");
    }
  };

  // Rename a chat and update the UI
  const handleRenameChat = async () => {
    if (renameTargetIndex === null || !renameValue.trim()) return;
    const chat = chats[renameTargetIndex];
    try {
      const res = await fetch(`http://localhost:5000/chats/${chat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename chat");
      setChats((prev) => prev.map((c, i) => i === renameTargetIndex ? { ...c, title: renameValue.trim() } : c));
      setShowRenameModal(false);
      setMenuOpenIndex(null);
    } catch (err) {
      setError("Failed to rename chat");
    }
  };

  // Start editing a user message and update the assistant's reply after editing
  const handleEditMessage = async (messageIndex) => {
    if (!activeChat?.messages?.[messageIndex]) return;
    
    const updatedChats = [...chats];
    const chat = updatedChats[activeChatIndex];
    
    // Update the user's message
    chat.messages[messageIndex].content = editValue;
    
    // Get a new answer from OpenAI for the edited message
    try {
      await saveMessages(chat.id, chat.messages);
      // Send the edited question to OpenAI
      await fetchOpenAIAnswer(editValue, chat.id, messageIndex + 1);
    } catch (err) {
      setError("Failed to update message");
    }

    setEditingMessageIndex(null);
    setEditValue("");
  };

  // Handle toggling the selection checkbox for a chat
  const handleChatCheckbox = (chatId) => {
    setSelectedChats((prev) =>
      prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId]
    );
  };

  // Handle toggling the selection checkbox for a project
  const handleProjectCheckbox = (projectId) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  // Show the bulk delete confirmation modal
  const handleBulkDelete = async () => {
    setShowBulkDeleteModal(true);
  };

  // Show the bulk delete projects confirmation modal
  const handleBulkDeleteProjects = async () => {
    setShowBulkDeleteProjectsModal(true);
  };

  const confirmBulkDelete = async () => {
    for (const chatId of selectedChats) {
      await fetch(`http://localhost:5000/chats/${chatId}`, { method: 'DELETE' });
    }
    setChats((prev) => prev.filter((chat) => !selectedChats.includes(chat.id)));
    setSelectedChats([]);
    setActiveChatIndex(null);
    setMenuOpenIndex(null);
    setShowBulkDeleteModal(false);
  };

  const confirmBulkDeleteProjects = async () => {
    try {
      for (const projectId of selectedProjects) {
        await fetch(`http://localhost:5000/projects/${projectId}`, { method: 'DELETE' });
      }
      setProjects((prev) => prev.filter((project) => !selectedProjects.includes(project.id)));
      setSelectedProjects([]);
      setActiveProjectId(null);
      setProjectMenuOpenId(null);
      setShowBulkDeleteProjectsModal(false);
      // Refresh chats to remove any that were associated with deleted projects
      await fetchChats();
    } catch (error) {
      console.error('Error during bulk delete projects:', error);
    }
  };

  // Handle toggling the selection checkbox for a chat within a project
  const handleProjectChatCheckbox = (projectId, chatId) => {
    setSelectedProjectChats((prev) => {
      const currentSelected = prev[projectId] || [];
      const newSelected = currentSelected.includes(chatId)
        ? currentSelected.filter((id) => id !== chatId)
        : [...currentSelected, chatId];
      
      return {
        ...prev,
        [projectId]: newSelected
      };
    });
  };

  // Show the bulk delete project chats confirmation modal
  const handleBulkDeleteProjectChats = async (projectId) => {
    setBulkDeleteProjectId(projectId);
    setShowBulkDeleteProjectChatsModal(true);
  };

  const confirmBulkDeleteProjectChats = async () => {
    try {
      const projectChatIds = selectedProjectChats[bulkDeleteProjectId] || [];
      
      for (const chatId of projectChatIds) {
        await fetch(`http://localhost:5000/chats/${chatId}`, { method: 'DELETE' });
      }
      
      // Remove deleted chats from state
      setChats((prev) => prev.filter((chat) => !projectChatIds.includes(chat.id)));
      
      // Clear selection for this project
      setSelectedProjectChats((prev) => {
        const newState = { ...prev };
        delete newState[bulkDeleteProjectId];
        return newState;
      });
      
      // Clear active chat if it was deleted
      setActiveChatIndex((prev) => {
        if (prev !== null && projectChatIds.includes(chats[prev]?.id)) {
          return null;
        }
        return prev;
      });
      
      setShowBulkDeleteProjectChatsModal(false);
      setBulkDeleteProjectId(null);
    } catch (error) {
      console.error('Error during bulk delete project chats:', error);
    }
  };

  // Close the file menu if the user clicks outside of it
  const fileMenuRef = React.useRef();
  useEffect(() => {
    if (fileMenuOpenId === null) return;
    function handleClickOutside(event) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target)) {
        setFileMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fileMenuOpenId]);

  const handleSendFollowup = async (q) => {
    setInput(q);
    await handleSend(q);
  };

  const handleGenerateInfographic = async () => {
    if (!activeChat) {
      setError("Please select a chat first.");
      return;
    }

    setGeneratingInfographic(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/generate-infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: activeChat.id }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate infographic");
      }

      const data = await res.json();
      setInfographicUrl(data.imageUrl);
      setAlternativeInfographicUrl(data.alternativeImageUrl);
      setSelectedInfographic('primary');

      // Add infographic message to chat
      const infographicMessage = {
        role: 'infographic',
        content: {
          imageUrl: data.imageUrl,
          alternativeImageUrl: data.alternativeImageUrl,
          summary: data.summary
        }
      };

      const updatedChats = chats.map((chat, index) => {
        if (index === activeChatIndex) {
          const updatedMessages = [...(chat.messages || []), infographicMessage];
          return { ...chat, messages: updatedMessages };
        }
        return chat;
      });

      setChats(updatedChats);
      const updatedChat = updatedChats[activeChatIndex];
      if (updatedChat) {
        await saveMessages(updatedChat.id, updatedChat.messages);
      }

      // Show success message
      setError(""); // Clear any previous errors
    } catch (err) {
      setError(`Failed to generate high-resolution infographic: ${err.message}. Please ensure your OpenAI API key is valid and has sufficient credits.`);
    } finally {
      setGeneratingInfographic(false);
    }
  };

  const handleDownloadInfographic = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Create a better filename with timestamp and style indicator
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const styleIndicator = selectedInfographic === 'primary' ? 'style1' : 'style2';
      link.download = `high-res-infographic-${styleIndicator}-${timestamp}.png`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      setError('Failed to download infographic. Please try again.');
    }
  };

  // Search functionality
  const handleSearch = (query) => {
    setSearchQuery(query);
    setShowSearchResults(query.trim().length > 0);
  };

  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return chats.filter(chat => 
      chat.title.toLowerCase().includes(query) ||
      (chat.messages && chat.messages.some(msg => {
        // Handle different message content types
        if (!msg.content) return false;
        
        // If content is a string, search in it
        if (typeof msg.content === 'string') {
          return msg.content.toLowerCase().includes(query);
        }
        
        // If content is an object (file, infographic), search in relevant fields
        if (typeof msg.content === 'object') {
          // For file messages, search in filename
          if (msg.role === 'file' && msg.content.name) {
            return msg.content.name.toLowerCase().includes(query);
          }
          
          // For infographic messages, search in summary
          if (msg.role === 'infographic' && msg.content.summary) {
            return msg.content.summary.toLowerCase().includes(query);
          }
          

        }
        
        return false;
      }))
    );
  };

  const clearSearch = () => {
    setSearchQuery("");
    setShowSearchResults(false);
  };

  // Helper function to truncate chat titles to maximum 4 words
  const truncateTitle = (title) => {
    if (!title) return "Untitled";
    return title.length > 20 ? title.substring(0, 20) + "..." : title;
  };

  // Toggle PDF list expansion for a specific chat
  const togglePdfList = (chatId) => {
    setExpandedPdfLists(prev => ({
      ...prev,
      [chatId]: !prev[chatId]
    }));
  };

  // Handle PDF click to view
  const handlePdfClick = (pdf) => {
    setSelectedPdf(pdf);
  };

  // Close PDF viewer
  const closePdfViewer = () => {
    setSelectedPdf(null);
  };





  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Chat Assistant</h2>
        
        {/* Search Section */}
        <div className="search-section">
          <div className="search-container">
            <FontAwesomeIcon icon={faSearch} className="search-icon" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button 
                onClick={clearSearch}
                className="clear-search-button"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
        
        {/* Show search results or normal view */}
        {showSearchResults ? (
          /* Search Results Section */
          <div className="search-results-section">
            <div className="search-results-header">
              <h3>Search Results</h3>
              <span className="search-count">{getSearchResults().length} results</span>
            </div>
            
            {getSearchResults().map((chat) => {
              const actualIndex = chats.findIndex(c => c.id === chat.id);
              const project = chat.project_id ? projects.find(p => p.id === chat.project_id) : null;
              
              return (
                <div
                  key={chat.id}
                  className={`chat-history-item search-result-item ${actualIndex === activeChatIndex ? "active" : ""}`}
                  onClick={() => {
                    setActiveChatIndex(actualIndex);
                    clearSearch(); // Clear search when selecting a chat
                  }}
                >
                  <div className="chat-item-header">
                                                    <span className="chat-title">{truncateTitle(chat.title)}</span>
                    {project && (
                      <span className="project-badge">{project.name}</span>
                    )}
                    <button
                      className="chat-title-menu-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenIndex(menuOpenIndex === actualIndex ? null : actualIndex);
                      }}
                      title="Chat options"
                    >
                      &#8943;
                    </button>
                  </div>
                  
                  {menuOpenIndex === actualIndex && (
                    <div className="chat-menu" ref={menuRef}>
                      <div
                        className="chat-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowRenameModal(true);
                          setRenameValue(chat.title);
                          setRenameTargetIndex(actualIndex);
                          setMenuOpenIndex(null);
                        }}
                        style={{ color: 'black' }}
                      >
                        <span role="img" aria-label="Rename">✏️</span> Rename
                      </div>
                      <div
                        className="chat-menu-item delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteModal(true);
                          setDeleteTargetIndex(actualIndex);
                          setMenuOpenIndex(null);
                        }}
                      >
                        <span role="img" aria-label="Delete">🗑️</span> Delete
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {getSearchResults().length === 0 && (
              <div className="no-search-results">
                <p>No chats found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Action Buttons Section - Top of Sidebar */}
            <div className="action-buttons-section">
              <button onClick={handleNewChat} className="new-chat-button">
                <FontAwesomeIcon icon={faFilePen} style={{ marginRight: '0.5rem' }} />
                New chat
              </button>
            <button 
              onClick={() => setShowNewProjectModal(true)} 
              className="new-project-button"
              title="Create New Project"
            >
                <FontAwesomeIcon icon={faFolderPlus} style={{ marginRight: '0.5rem' }} />
                New project
            </button>
          </div>
          
            {/* Projects Section */}
            <div className="projects-section">
              <div className="projects-header">
                <h3>Projects</h3>
              </div>
              
              {/* Bulk Actions for Projects */}
              {selectedProjects.length > 0 && (
                <div className="bulk-actions">
                  <div className="select-all-container">
                    <input
                      type="checkbox"
                      checked={selectedProjects.length === projects.length && projects.length > 0}
                      onChange={() => {
                        if (selectedProjects.length === projects.length) {
                          setSelectedProjects([]);
                        } else {
                          setSelectedProjects(projects.map(project => project.id));
                        }
                      }}
                      className="select-all-checkbox"
                    />
                    <label className="select-all-label">
                      Select All
                    </label>
                  </div>
                  {selectedProjects.length > 0 && (
                    <button className="delete-all-button" onClick={handleBulkDeleteProjects}>
                      Delete All
                    </button>
                  )}
                </div>
              )}
              
              {/* Project List with Nested Chats */}
              {projects.map((project) => {
                // Get chats for this specific project
                const projectChats = chats.filter(chat => chat.project_id === project.id);
                
                return (
            <div key={project.id} className="project-container">
              <div 
                className={`project-item ${activeProjectId === project.id ? 'active' : ''}`}
                onClick={() => handleProjectClick(project.id)}
              >
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(project.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleProjectCheckbox(project.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="project-checkbox"
                      />
                <FontAwesomeIcon icon={faFolder} className="project-icon" />
                <span className="project-name">{project.name}</span>
                      <button
                        className="project-new-chat-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNewChatInProject(project.id);
                        }}
                        title="New Chat in Project"
                      >
                        <FontAwesomeIcon icon={faPlus} />
                      </button>
                <button
                  className="project-menu-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setProjectMenuOpenId(projectMenuOpenId === project.id ? null : project.id);
                  }}
                  title="Project options"
                >
                  &#8943;
                </button>
              </div>
              
              {projectMenuOpenId === project.id && (
                <div className="project-menu">
                  <div
                    className="project-menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRenameProjectModal(true);
                      setRenameProjectValue(project.name);
                      setRenameProjectId(project.id);
                      setProjectMenuOpenId(null);
                    }}
                  >
                    <span role="img" aria-label="Rename">✏️</span> Rename
                  </div>
                  <div
                          className="project-menu-item delete"
                    onClick={(e) => {
                      e.stopPropagation();
                            setShowDeleteProjectModal(true);
                            setDeleteProjectId(project.id);
                      setProjectMenuOpenId(null);
                    }}
                  >
                          <span role="img" aria-label="Delete">🗑️</span> Delete
                  </div>
                      </div>
                    )}
                    
                    {/* Project Chats */}
                    {projectChats.length > 0 && (
                      <div className="project-chats">
                        {/* Bulk Actions for Project Chats */}
                        {selectedProjectChats[project.id]?.length > 0 && (
                          <div className="bulk-actions">
                            <div className="select-all-container">
                              <input
                                type="checkbox"
                                checked={selectedProjectChats[project.id]?.length === projectChats.length && projectChats.length > 0}
                                onChange={() => {
                                  const currentSelected = selectedProjectChats[project.id] || [];
                                  if (currentSelected.length === projectChats.length) {
                                    setSelectedProjectChats(prev => ({
                                      ...prev,
                                      [project.id]: []
                                    }));
                                  } else {
                                    setSelectedProjectChats(prev => ({
                                      ...prev,
                                      [project.id]: projectChats.map(chat => chat.id)
                                    }));
                                  }
                                }}
                                className="select-all-checkbox"
                              />
                              <label className="select-all-label">
                                Select All
                              </label>
                            </div>
                            {selectedProjectChats[project.id]?.length > 0 && (
                              <button 
                                className="delete-all-button" 
                                onClick={() => handleBulkDeleteProjectChats(project.id)}
                              >
                                Delete All
                              </button>
                            )}
                          </div>
                        )}
                        
                        {projectChats.map((chat, index) => {
                          // Find the actual index in the full chats array
                          const actualIndex = chats.findIndex(c => c.id === chat.id);
                          
                          return (
                            <div
                              key={chat.id || index}
                              className={`project-chat-item ${actualIndex === activeChatIndex ? "active" : ""}`}
                              onClick={() => {
                                setActiveChatIndex(actualIndex);
                                setActiveProjectId(project.id);
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedProjectChats[project.id]?.includes(chat.id) || false}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleProjectChatCheckbox(project.id, chat.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="chat-checkbox"
                              />
                              <div className="chat-item-content">
                                <span className="chat-title">{truncateTitle(chat.title)}</span>
                                
                                {/* PDF List for this chat */}
                                {pdfsMap[chat.id] && pdfsMap[chat.id].length > 0 && (
                                  <div className="chat-pdfs-list">
                                    {pdfsMap[chat.id].map((pdf, pdfIndex) => (
                                      <div 
                                        key={pdf.id} 
                                        className="chat-pdf-item clickable"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePdfClick(pdf);
                                        }}
                                        title={`View ${pdf.filename}`}
                                      >
                                        <FontAwesomeIcon icon={faFilePdf} className="pdf-icon" />
                                        <span className="pdf-filename">{pdf.filename}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <button
                                className="chat-title-menu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                                  setMenuOpenIndex(menuOpenIndex === actualIndex ? null : actualIndex);
                                }}
                                title="Chat options"
                              >
                                &#8943;
                              </button>
                              
                              {menuOpenIndex === actualIndex && (
                                <div className="chat-menu" ref={menuRef}>
                                  <div
                                    className="chat-menu-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowRenameModal(true);
                                      setRenameValue(chat.title);
                                      setRenameTargetIndex(actualIndex);
                                      setMenuOpenIndex(null);
                                    }}
                                    style={{ color: 'black' }}
                                  >
                                    <span role="img" aria-label="Rename">✏️</span> Rename
                                  </div>
                                  <div
                                    className="chat-menu-item delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowDeleteModal(true);
                                      setDeleteTargetIndex(actualIndex);
                                      setMenuOpenIndex(null);
                    }}
                  >
                    <span role="img" aria-label="Delete">🗑️</span> Delete
                  </div>
                </div>
              )}
            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
        
            {/* Common Chats Section */}
        <div className="chats-section">
          <div className="chats-header">
            <h3>Chats</h3>
          </div>
          
              {/* Get chats that don't belong to any project */}
              {(() => {
                const commonChats = chats.filter(chat => !chat.project_id);
                const filteredCommonChats = commonChats;
                
                return (
                  <>
                    {selectedChats.length > 0 && (
            <div className="bulk-actions">
              <div className="select-all-container">
                <input
                  type="checkbox"
                            checked={selectedChats.length === filteredCommonChats.length && filteredCommonChats.length > 0}
                  onChange={() => {
                              if (selectedChats.length === filteredCommonChats.length) {
                      setSelectedChats([]);
                    } else {
                                setSelectedChats(filteredCommonChats.map(chat => chat.id));
                    }
                  }}
                  className="select-all-checkbox"
                />
                <label className="select-all-label">
                  Select All
                </label>
              </div>
              {selectedChats.length > 0 && (
                <button className="delete-all-button" onClick={handleBulkDelete}>
                  Delete All
                </button>
              )}
            </div>
          )}
        
        {showBulkDeleteModal && (
          <div className="modal-overlay" style={{ zIndex: 200 }}>
            <div className="modal-content">
              <h3>Confirm Delete</h3>
              <p>Are you sure you want to delete the selected chats?</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowBulkDeleteModal(false)}>Cancel</button>
                <button onClick={confirmBulkDelete} style={{ background: '#b91c1c', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4 }}>Delete</button>
              </div>
            </div>
          </div>
        )}

                    {showBulkDeleteProjectsModal && (
                      <div className="modal-overlay" style={{ zIndex: 200 }}>
                        <div className="modal-content">
                          <h3>Confirm Delete Projects</h3>
                          <p>Are you sure you want to delete the selected projects? This will also delete all chats associated with these projects.</p>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => setShowBulkDeleteProjectsModal(false)}>Cancel</button>
                            <button onClick={confirmBulkDeleteProjects} style={{ background: '#b91c1c', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4 }}>Delete</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {showBulkDeleteProjectChatsModal && (
                      <div className="modal-overlay" style={{ zIndex: 200 }}>
                        <div className="modal-content">
                          <h3>Confirm Delete Project Chats</h3>
                          <p>Are you sure you want to delete the selected chats from this project?</p>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => setShowBulkDeleteProjectChatsModal(false)}>Cancel</button>
                            <button onClick={confirmBulkDeleteProjectChats} style={{ background: '#b91c1c', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4 }}>Delete</button>
                          </div>
                        </div>
                      </div>
                    )}
        
        <div className="chat-list">
          {chatsLoading ? (
            <div style={{ textAlign: "center", margin: "1rem 0" }}>Loading chats...</div>
          ) : error ? (
            <div style={{ color: "red", textAlign: "center" }}>{error}</div>
          ) : (
                        filteredCommonChats.map((chat, index) => {
              // Find the actual index in the full chats array
              const actualIndex = chats.findIndex(c => c.id === chat.id);
                          
              return (
                <div
                  key={chat.id || index}
                  className={`chat-history-item ${actualIndex === activeChatIndex ? "active" : ""}`}
                  onClick={() => {
                    setActiveChatIndex(actualIndex);
                                setActiveProjectId(null);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedChats.includes(chat.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleChatCheckbox(chat.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="chat-checkbox"
                  />
                              <div className="chat-item-content">
                                <span className="chat-title">{truncateTitle(chat.title)}</span>
                                
                                {/* PDF List for this chat */}
                                {pdfsMap[chat.id] && pdfsMap[chat.id].length > 0 && (
                                  <div className="chat-pdfs-list">
                                    {pdfsMap[chat.id].map((pdf, pdfIndex) => (
                                      <div 
                                        key={pdf.id} 
                                        className="chat-pdf-item clickable"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePdfClick(pdf);
                                        }}
                                        title={`View ${pdf.filename}`}
                                      >
                                        <FontAwesomeIcon icon={faFilePdf} className="pdf-icon" />
                                        <span className="pdf-filename">{pdf.filename}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                  <button
                    className="chat-title-menu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenIndex(menuOpenIndex === actualIndex ? null : actualIndex);
                    }}
                    title="Chat options"
                  >
                    &#8943;
                  </button>
                
                {menuOpenIndex === actualIndex && (
                  <div className="chat-menu" ref={menuRef}>
                    <div
                      className="chat-menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRenameModal(true);
                        setRenameValue(chat.title);
                                      setRenameTargetIndex(actualIndex);
                        setMenuOpenIndex(null);
                      }}
                      style={{ color: 'black' }}
                    >
                      <span role="img" aria-label="Rename">✏️</span> Rename
                    </div>
                    <div
                      className="chat-menu-item delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteModal(true);
                                      setDeleteTargetIndex(actualIndex);
                        setMenuOpenIndex(null);
                      }}
                    >
                      <span role="img" aria-label="Delete">🗑️</span> Delete
                    </div>
                  </div>
                )}
              </div>
            );
            })
          )}
        </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
        <div className="dark-toggle-container">
          <label className="switch">
            <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">{darkMode ? "Light Mode" : "Dark Mode"}</span>
          <button className="settings-gear-btn" onClick={() => setShowSettings(true)} title="Settings">
            <FontAwesomeIcon icon={faGear} />
          </button>
        </div>
      </aside>

      <main className="chat-area">
        <header className="chat-header">
          {activeChat ? truncateTitle(activeChat.title) : "New Chat"}
        </header>

        <div className="chat-window">
          {Array.isArray(activeChat?.messages) && activeChat.messages.length > 0 ? (
            activeChat.messages.map((msg, i) => {
              if (msg.role === 'file') {
                return (
                  <div key={i} className="message file" style={{ 
                    border: 'none', 
                    background: 'transparent', 
                    boxShadow: 'none',
                    padding: '8px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FontAwesomeIcon 
                      icon={faPaperclip} 
                      className="file-icon" 
                      style={{ 
                        color: '#6b7280',
                        fontSize: '16px'
                      }}
                    />
                    <span className="file-name" style={{ 
                      color: '#374151',
                      fontSize: '14px'
                    }}>
                      {msg.content.name}
                    </span>
                    <span className="file-type" style={{ 
                      color: '#6b7280',
                      fontSize: '12px'
                    }}>
                      File Uploaded
                    </span>
                  </div>
                );
              }

              if (msg.role === 'infographic') {
                return (
                  <div key={i} className="message infographic">
                    <div className="infographic-bubble">
                      <div className="infographic-info">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span className="infographic-title">Generated Infographic</span>
                          <FontAwesomeIcon 
                            icon={faArrowDown} 
                            className="infographic-icon" 
                            onClick={() => handleDownloadInfographic(selectedInfographic === 'primary' ? msg.content.imageUrl : msg.content.alternativeImageUrl)}
                            title="Download infographic"
                            style={{ 
                              cursor: 'pointer', 
                              fontSize: '18px', 
                              color: '#6b7280',
                              padding: '8px',
                              borderRadius: '4px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                          />
                        </div>
                        
                        {msg.content.alternativeImageUrl && (
                          <div className="infographic-style-selector" style={{ marginBottom: '10px' }}>
                            <button
                              className={`style-btn ${selectedInfographic === 'primary' ? 'active' : ''}`}
                              onClick={() => setSelectedInfographic('primary')}
                              style={{
                                padding: '6px 12px',
                                marginRight: '8px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                background: selectedInfographic === 'primary' ? '#6b7280' : '#fff',
                                color: selectedInfographic === 'primary' ? '#fff' : '#333',
                                cursor: 'pointer'
                              }}
                            >
                              Style 1
                            </button>
                            <button
                              className={`style-btn ${selectedInfographic === 'alternative' ? 'active' : ''}`}
                              onClick={() => setSelectedInfographic('alternative')}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                background: selectedInfographic === 'alternative' ? '#6b7280' : '#fff',
                                color: selectedInfographic === 'alternative' ? '#fff' : '#333',
                                cursor: 'pointer'
                              }}
                            >
                              Style 2
                            </button>
                          </div>
                        )}
                        
                        <div className="infographic-image-container">
                          <img 
                            src={selectedInfographic === 'primary' ? msg.content.imageUrl : msg.content.alternativeImageUrl} 
                            alt="Generated Infographic" 
                            className="infographic-image"
                            style={{ width: '100%', maxWidth: '500px', height: 'auto', cursor: 'pointer' }}
                            onClick={() => window.open(selectedInfographic === 'primary' ? msg.content.imageUrl : msg.content.alternativeImageUrl, '_blank')}
                            title="Click to view full size"
                          />
                        </div>
                        <div className="infographic-summary">
                          <strong>Summary:</strong> {msg.content.summary}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }



              // Skip rendering followup-questions messages as text since they're displayed as buttons
              if (msg && msg.role === 'followup-questions') {
                return null;
              }
              
              // Skip null messages
              if (!msg) {
                return null;
              }
              
              return (
                <div key={i} className={`message ${msg.role}`}>
                  {msg.role === "user" && editingMessageIndex === i ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{ flex: 1, padding: '4px 8px' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleEditMessage(i);
                          } else if (e.key === 'Escape') {
                            setEditingMessageIndex(null);
                            setEditValue("");
                          }
                        }}
                        autoFocus
                      />
                      <button 
                        onClick={() => handleEditMessage(i)}
                        style={{ padding: '4px 8px' }}
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => {
                          setEditingMessageIndex(null);
                          setEditValue("");
                        }}
                        style={{ padding: '4px 8px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span style={{ position: 'relative' }}>
                      {msg.content}
                      {msg.role === "user" && (
                        <button
                          onClick={() => {
                            setEditingMessageIndex(i);
                            setEditValue(msg.content);
                          }}
                          style={{
                            marginLeft: '8px',
                            padding: '2px 6px',
                            fontSize: '1.2em',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: 'white',
                            opacity: 0.7
                          }}
                          title="Edit"
                        >
                          &#8942;
                        </button>
                      )}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="empty-chat-placeholder">
              {greetingMessage}
            </div>
          )}
          {activeChat && followupsByChat[activeChat.id] && followupsByChat[activeChat.id].length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {followupsByChat[activeChat.id].map((q, i) => (
                  <button
                    key={i}
                    style={{
                      background: "#6b7280",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 14px",
                      cursor: "pointer",
                      fontSize: "0.97em"
                    }}
                    onClick={() => handleSendFollowup(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="input-area">
          <div className="input-container">
            <label className="file-upload" title="Upload File">
              <FontAwesomeIcon icon={faPaperclip} />
              <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} hidden />
            </label>
            <input
              type="text"
              autoComplete="off"
              name="chat-question-unique-2024"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="text-input"
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button onClick={() => handleSend()} className="send-button">
              <FontAwesomeIcon icon={faArrowUp} />
            </button>
          </div>
          <button 
            className="infographic-button" 
            title="Generate High-Resolution Infographic"
            onClick={handleGenerateInfographic}
            disabled={generatingInfographic || !activeChat}
            style={{
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <FontAwesomeIcon icon={faImage} />
            {generatingInfographic ? (
              <span>
                <span style={{ animation: 'pulse 1.5s infinite' }}>🔄</span> Generating...
              </span>
            ) : (
              "Infographic"
            )}
          </button>
        </div>

        {uploadMessage && (
          <div 
            className="error-message" 
            style={{ 
              padding: "0.5rem 2rem", 
              color: uploadMessage.startsWith("❌") ? "#ef4444" : "#6b7280"
            }}
          >
            {uploadMessage}
          </div>
        )}
        {error && (
          <div className="error-message" style={{ padding: "0.5rem 2rem" }}>
            {error}
          </div>
        )}
      </main>

      
      {showRenameModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Rename Chat</h3>
                         <input
               type="text"
               value={renameValue}
               onChange={e => setRenameValue(e.target.value)}
               onKeyDown={e => {
                 if (e.key === 'Enter') {
                   handleRenameChat();
                 } else if (e.key === 'Escape') {
                   setShowRenameModal(false);
                 }
               }}
               style={{ width: "100%", marginBottom: 16, padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
               autoFocus
             />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowRenameModal(false)} style={{ padding: "8px 16px", border: "1px solid #ccc", borderRadius: 4, background: "#fff" }}>Cancel</button>
              <button onClick={handleRenameChat} style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4 }}>Rename</button>
            </div>
          </div>
        </div>
      )}
      
      {showDeleteModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-content" style={{ background: "#fff", padding: 24, borderRadius: 8, minWidth: 300 }}>
            <h3>Delete Chat</h3>
            <p>Are you sure you want to delete this chat?</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button onClick={() => { handleDeleteChat(deleteTargetIndex); }} style={{ background: "#d00", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {showSettings && (
        <div 
          style={{ 
            position: "absolute", 
            bottom: "4rem", 
            left: "1rem", 
            zIndex: 300,
            background: darkMode ? "var(--sidebar-dark)" : "white",
            border: `1px solid ${darkMode ? "var(--border-dark)" : "#e5e7eb"}`,
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
            padding: "1rem",
            minWidth: "280px",
            maxWidth: "350px"
          }}
        >
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem" }}>🔑 OpenAI API Key</h3>
          <div style={{ position: "relative", marginBottom: "1rem" }}>
            <input
              type={showApiKey ? "text" : "password"}
              autoComplete="off"
              name="openai-api-key-unique-2024"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="Enter your OpenAI API key"
              style={{ 
                width: "100%", 
                padding: "8px 40px 8px 8px", 
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px"
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6b7280",
                padding: "4px"
              }}
            >
              <FontAwesomeIcon icon={showApiKey ? faEyeSlash : faEye} />
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "1rem" }}>
            <button 
              onClick={() => setShowSettings(false)}
              style={{ 
                padding: "6px 12px", 
                border: "1px solid #d1d5db", 
                borderRadius: "4px", 
                background: "#fff",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setApiKeyStatus("");
                try {
                  const res = await fetch("http://localhost:5000/api/set-openai-key", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ apikey: apiKeyInput }),
                  });
                  if (!res.ok) {
                    let msg = "Failed to set API key";
                    try {
                      const err = await res.json();
                      if (err && err.error) msg = err.error;
                    } catch {}
                    throw new Error(msg);
                  }
                  setApiKeyStatus("✅ API key saved!");
                  setTimeout(() => setShowSettings(false), 1000);
                } catch (e) {
                  setApiKeyStatus("❌ " + (e.message || "Failed to save API key."));
                }
              }}
              style={{ 
                background: "#2563eb", 
                color: "#fff", 
                border: "none", 
                padding: "6px 12px", 
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Save
            </button>
          </div>
          {apiKeyStatus && (
            <div style={{ 
              marginTop: "8px", 
              color: apiKeyStatus.includes("❌") ? "#ef4444" : "#22c55e",
              fontSize: "12px",
              textAlign: "center"
            }}>
              {apiKeyStatus}
            </div>
          )}
          

        </div>
      )}
      
      {/* Project Modals */}
      {showNewProjectModal && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowNewProjectModal(false);
            setNewProjectName("");
          }
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Project</h3>
            <input
              type="text"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !isCreatingProject) {
                  handleNewProject();
                } else if (e.key === 'Escape') {
                  setShowNewProjectModal(false);
                  setNewProjectName("");
                }
              }}
              placeholder="Enter project name..."
              style={{ width: "100%", marginBottom: 16, padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => {
                setShowNewProjectModal(false);
                setNewProjectName("");
              }} style={{ padding: "8px 16px", border: "1px solid #ccc", borderRadius: 4, background: "#fff" }}>
                Cancel
              </button>
              <button 
                onClick={handleNewProject} 
                disabled={isCreatingProject}
                style={{ 
                  background: isCreatingProject ? "#9ca3af" : "#4f46e5", 
                  color: "#fff", 
                  border: "none", 
                  padding: "8px 16px", 
                  borderRadius: 4,
                  cursor: isCreatingProject ? "not-allowed" : "pointer"
                }}
              >
                {isCreatingProject ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showRenameProjectModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Rename Project</h3>
            <input
              type="text"
              value={renameProjectValue}
              onChange={e => setRenameProjectValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleRenameProject();
                } else if (e.key === 'Escape') {
                  setShowRenameProjectModal(false);
                  setRenameProjectValue("");
                }
              }}
              style={{ width: "100%", marginBottom: 16, padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => {
                setShowRenameProjectModal(false);
                setRenameProjectValue("");
              }} style={{ padding: "8px 16px", border: "1px solid #ccc", borderRadius: 4, background: "#fff" }}>
                Cancel
              </button>
              <button onClick={handleRenameProject} style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4 }}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showDeleteProjectModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Project</h3>
            <p>Are you sure you want to delete this project? This will also delete all chats and files within the project.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowDeleteProjectModal(false)}>
                Cancel
              </button>
              <button onClick={handleDeleteProject} style={{ background: "#d00", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* PDF Viewer Modal */}
      {selectedPdf && (
        <div className="modal-overlay" onClick={closePdfViewer}>
          <div className="modal-content pdf-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-viewer-header">
              <h3>{selectedPdf.filename}</h3>
              <button className="close-button" onClick={closePdfViewer}>×</button>
            </div>
            <div className="pdf-viewer-content">
              <iframe
                src={`http://localhost:5000/files/${selectedPdf.id}/view`}
                title={selectedPdf.filename}
                width="100%"
                height="600px"
                style={{ border: 'none', borderRadius: '8px' }}
              />
            </div>
            <div className="pdf-viewer-actions">
              <a 
                href={`http://localhost:5000/files/${selectedPdf.id}/download`}
                download={selectedPdf.filename}
                className="download-pdf-btn"
              >
                <FontAwesomeIcon icon={faArrowDown} />
                Download PDF
              </a>
            </div>
          </div>
        </div>
      )}


      
    </div>
  );
}

export default App;