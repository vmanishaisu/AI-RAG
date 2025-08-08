import React, { useState, useEffect } from "react";
import "./App.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperclip, faTrash, faGear, faImage } from "@fortawesome/free-solid-svg-icons";

function App() {
  const [chats, setChats] = useState([]);
  const [activeChatIndex, setActiveChatIndex] = useState(null);
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
  const [pdfsByChat, setPdfsByChat] = useState({});
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [fileMenuOpenId, setFileMenuOpenId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState("");
  const [followups, setFollowups] = useState([]);
  const [generatingInfographic, setGeneratingInfographic] = useState(false);
  const [infographicUrl, setInfographicUrl] = useState(null);
  const [alternativeInfographicUrl, setAlternativeInfographicUrl] = useState(null);
  const [selectedInfographic, setSelectedInfographic] = useState('primary');

  const activeChat = activeChatIndex !== null ? chats[activeChatIndex] : null;

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

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (activeChatIndex !== null && (activeChatIndex < 0 || activeChatIndex >= chats.length)) {
      setActiveChatIndex(null);
    }
  }, [chats, activeChatIndex]);

  useEffect(() => {
    if (!activeChat || !Array.isArray(activeChat.messages) || activeChat.messages.length === 0) {
      setFollowups([]);
    }
  }, [activeChat]);

  const fetchChats = async () => {
    setChatsLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:5000/chats");
      if (!res.ok) throw new Error("Failed to load chats");
      const data = await res.json();
      setChats(data);

      // Download the list of PDFs for every chat and store them in state
      const pdfsMap = {};
      await Promise.all(
        data.map(async (chat) => {
          const resPdfs = await fetch(`http://localhost:5000/chats/${chat.id}/pdfs`);
          if (resPdfs.ok) {
            const pdfs = await resPdfs.json();
            pdfsMap[chat.id] = pdfs;
          } else {
            pdfsMap[chat.id] = [];
          }
        })
      );
      setPdfsByChat(pdfsMap);
    } catch (err) {
      setError("Failed to load chats");
    } finally {
      setChatsLoading(false);
    }
  };

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
        const res = await fetch("http://localhost:5000/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Untitled" }),
        });
        if (!res.ok) throw new Error("Failed to create chat");
        const newChat = await res.json();
        newChat.messages = [userMessage, assistantReply];
        setChats((prev) => {
          const newChats = [...prev, newChat];
          setActiveChatIndex(newChats.length - 1);
          return newChats;
        });
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
      setChats((prevChats) => {
        const chatsCopy = [...prevChats];
        const chatIdx = chatsCopy.findIndex((c) => c.id === chatId);
        if (chatIdx !== -1 && Array.isArray(chatsCopy[chatIdx].messages)) {
          chatsCopy[chatIdx].messages[assistantMsgIndex] = { role: "assistant", content: data.answer };
        }
        return chatsCopy;
      });
      setFollowups(data.followups || []);
      // Save the updated messages to the backend after getting a response
      setTimeout(() => {
        setChats((prevChats) => {
          const chat = prevChats.find((c) => c.id === chatId);
          if (chat) saveMessages(chatId, chat.messages);
          return prevChats;
        });
      }, 0);
    } catch (err) {
      setChats((prevChats) => {
        const chatsCopy = [...prevChats];
        const chatIdx = chatsCopy.findIndex((c) => c.id === chatId);
        if (chatIdx !== -1 && Array.isArray(chatsCopy[chatIdx].messages)) {
          chatsCopy[chatIdx].messages[assistantMsgIndex] = { role: "assistant", content: "Failed to get answer from OpenAI." };
        }
        return chatsCopy;
      });
      setFollowups([]);
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
    } catch (err) {
      setError("Failed to save messages");
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await fetch("http://localhost:5000/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled" }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const newChat = await res.json();
      setChats((prev) => {
        const newChats = [...prev, newChat];
        setActiveChatIndex(newChats.length - 1);
        return newChats;
      });
      setInput("");
      setFollowups([]);
    } catch (err) {
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

      //  Create a file message
      const fileMessage = {
        role: 'file',
        content: {
          name: uploadedFile.filename,
          type: file.type,
        }
      };

      // Add the new file message to the chat's messages without mutating state
      const updatedChats = chats.map((chat, index) => {
        if (index === activeChatIndex) {
          const updatedMessages = [...(chat.messages || []), fileMessage];
          return { ...chat, messages: updatedMessages };
        }
        return chat;
      });
      
      // Update the chat state and then save the new messages to the backend
      setChats(updatedChats);
      const updatedChat = updatedChats[activeChatIndex];
      if (updatedChat) {
        await saveMessages(updatedChat.id, updatedChat.messages);
      }

      // 5. Refresh sidebar PDF list
      const resPdfs = await fetch(`http://localhost:5000/chats/${activeChat.id}/pdfs`);
      if (resPdfs.ok) {
        const pdfs = await resPdfs.json();
        setPdfsByChat(prev => ({ ...prev, [activeChat.id]: pdfs }));
      }
    } catch (err) {
      console.error(err); 
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

  // Show the bulk delete confirmation modal
  const handleBulkDelete = async () => {
    setShowBulkDeleteModal(true);
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

  // Delete a file from a chat and update the sidebar
  const handleDeleteFile = async (fileId, chatId) => {
    await fetch(`http://localhost:5000/files/${fileId}`, { method: 'DELETE' });
    // Refresh the sidebar's PDF list after deleting a file
    const resPdfs = await fetch(`http://localhost:5000/chats/${chatId}/pdfs`);
    if (resPdfs.ok) {
      const pdfs = await resPdfs.json();
      setPdfsByChat(prev => ({ ...prev, [chatId]: pdfs }));
      // If there are no files left in the chat, delete the chat as well
      if (pdfs.length === 0) {
        await fetch(`http://localhost:5000/chats/${chatId}`, { method: 'DELETE' });
        setChats((prev) => prev.filter((chat) => chat.id !== chatId));
        setActiveChatIndex((prev) => {
          const idx = chats.findIndex((chat) => chat.id === chatId);
          if (prev === idx) return null;
          if (prev > idx) return prev - 1;
          return prev;
        });
      }
    }
    setFileMenuOpenId && setFileMenuOpenId(null);
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
      console.error('Infographic generation error:', err);
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
      console.error('Error downloading infographic:', error);
      setError('Failed to download infographic. Please try again.');
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>InsightGPT</h2>
        <button onClick={handleNewChat} className="new-chat-button">
          + New Chat
        </button>
        {chats.length > 0 && (
          <div className="bulk-actions">
            <div className="select-all-container">
              <input
                type="checkbox"
                checked={selectedChats.length === chats.length && chats.length > 0}
                onChange={() => {
                  if (selectedChats.length === chats.length) {
                    setSelectedChats([]);
                  } else {
                    setSelectedChats(chats.map(chat => chat.id));
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
        <div className="chat-list">
          {chatsLoading ? (
            <div style={{ textAlign: "center", margin: "1rem 0" }}>Loading chats...</div>
          ) : error ? (
            <div style={{ color: "red", textAlign: "center" }}>{error}</div>
          ) : (
            chats.map((chat, index) => (
              <div
                key={chat.id || index}
                className={`chat-history-item ${index === activeChatIndex ? "active" : ""}`}
                onClick={() => {
                  setActiveChatIndex(index);
                  setFollowups([]);
                }}
              >
                <div className="chat-item-header">
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
                  <span className="chat-title">{chat.title}</span>
                  <button
                    className="chat-title-menu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenIndex(menuOpenIndex === index ? null : index);
                    }}
                    title="Chat options"
                  >
                    &#8943;
                  </button>
                </div>
                <div style={{ height: '0.25rem' }} />
                
                {menuOpenIndex === index && (
                  <div className="chat-menu" ref={menuRef}>
                    <div
                      className="chat-menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRenameModal(true);
                        setRenameValue(chat.title);
                        setRenameTargetIndex(index);
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
                        setDeleteTargetIndex(index);
                        setMenuOpenIndex(null);
                      }}
                    >
                      <span role="img" aria-label="Delete">🗑️</span> Delete
                    </div>
                  </div>
                )}

                
                {pdfsByChat[chat.id] && pdfsByChat[chat.id].length > 0 && (
                  <ul className="sidebar-pdf-list">
                    {pdfsByChat[chat.id].map(pdf => (
                      <li key={pdf.id} className="sidebar-pdf-row" style={{ position: 'relative' }}>
                        <a
                          href={`http://localhost:5000/uploads/${encodeURIComponent(pdf.filepath.split(/[/\\]/).pop())}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sidebar-pdf-link"
                        >
                          {pdf.filename}
                        </a>
                        <button
                          className="file-trash-btn"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteFile(pdf.id, chat.id);
                          }}
                          title="Delete file"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
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
          {activeChat ? `InsightGPT - ${activeChat.title}` : "InsightGPT"}
        </header>

        <div className="chat-window">
          {Array.isArray(activeChat?.messages) && activeChat.messages.length > 0 ? (
            activeChat.messages.map((msg, i) => {
              if (msg.role === 'file') {
                return (
                  <div key={i} className="message file">
                    <div className="file-bubble">
                      <FontAwesomeIcon icon={faPaperclip} className="file-icon" />
                      <div className="file-info">
                        <span className="file-name">{msg.content.name}</span>
                        <span className="file-type">File Uploaded</span>
                      </div>
                    </div>
                  </div>
                );
              }
              if (msg.role === 'infographic') {
                return (
                  <div key={i} className="message infographic">
                    <div className="infographic-bubble">
                      <FontAwesomeIcon icon={faImage} className="infographic-icon" />
                      <div className="infographic-info">
                        <span className="infographic-title">Generated Infographic</span>
                        
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
                                background: selectedInfographic === 'primary' ? '#4f46e5' : '#fff',
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
                                background: selectedInfographic === 'alternative' ? '#4f46e5' : '#fff',
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
                          <button
                            className="download-infographic-btn"
                            onClick={() => handleDownloadInfographic(selectedInfographic === 'primary' ? msg.content.imageUrl : msg.content.alternativeImageUrl)}
                            title="Download infographic"
                            style={{
                              marginTop: '8px',
                              padding: '8px 16px',
                              background: '#4f46e5',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            📥 Download High-Resolution
                          </button>
                        </div>
                        <div className="infographic-summary">
                          <strong>Summary:</strong> {msg.content.summary}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className={`message ${msg.role}`}>
                  <strong>{msg.role === 'assistant' ? 'Assistant' : 'You'}:</strong>{" "}
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
            <div style={{ textAlign: "center", marginTop: "2rem" }}>
              No messages yet.
            </div>
          )}
          {followups.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>AI Follow-up Suggestions:</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {followups.map((q, i) => (
                  <button
                    key={i}
                    style={{
                      background: "#e0e7ff",
                      color: "#1e293b",
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
          <label className="file-upload" title="Upload File">
            <FontAwesomeIcon icon={faPaperclip} />
            <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} hidden />
          </label>
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
                <span style={{ animation: 'pulse 1.5s infinite' }}>🔄</span> Generating HD...
              </span>
            ) : (
              "HD Infographic"
            )}
          </button>
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
          <button onClick={() => handleSend()} className="send-button">Send</button>
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
        <div className="modal-overlay" style={{ zIndex: 300 }}>
          <div className="modal-content">
            <h3>OpenAI API Key</h3>
            <input
              type="password"
              autoComplete="off"
              name="openai-api-key-unique-2024"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="Enter your OpenAI API key"
              style={{ width: "100%", marginBottom: 16, padding: 8 }}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowSettings(false)}>Cancel</button>
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
                    setApiKeyStatus("API key saved!");
                    setShowSettings(false);
                  } catch (e) {
                    setApiKeyStatus(e.message || "Failed to save API key.");
                  }
                }}
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4 }}
              >
                Save
              </button>
            </div>
            {apiKeyStatus && <div style={{ marginTop: 12, color: apiKeyStatus.includes("Failed") ? "#ef4444" : "#22c55e" }}>{apiKeyStatus}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;