require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { OpenAI } = require('openai');
const pdf = require('pdf-parse');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

let dynamicOpenAIKey = process.env.OPENAI_API_KEY;

// Retrieve all chats from the database, ordered by most recent
app.get('/chats', (req, res) => {
  db.all(`SELECT * FROM chats ORDER BY id DESC`, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    // Parse the messages field for each chat, handling errors gracefully
    const parsedRows = rows.map(row => {
      let messages = [];
      try {
        messages = row.messages ? JSON.parse(row.messages) : [];
        if (!Array.isArray(messages)) messages = [];
      } catch {
        messages = [];
      }
      return { ...row, messages };
    });
    res.json(parsedRows);
  });
});

// Create a new chat with a title and empty messages
app.post('/chats', (req, res) => {
  const { title } = req.body;
  db.run(`INSERT INTO chats (title, messages) VALUES (?, ?)`, [title || 'Untitled', '[]'], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to create chat');
    }
    res.json({ id: this.lastID, title: title || 'Untitled', messages: [] });
  });
});

// Save the messages array for a specific chat
app.post('/chats/:chatId/messages', (req, res) => {
  const { chatId } = req.params;
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).send('Messages must be an array');
  }
  db.run(`UPDATE chats SET messages = ? WHERE id = ?`, [JSON.stringify(messages), chatId], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to save messages');
    }
    res.sendStatus(200);
  });
});

// Upload a PDF or image file to a specific chat
app.post('/upload/:chatId', upload.single('file'), (req, res) => {
  const chatId = req.params.chatId;
  const file = req.file;
  if (!file) return res.status(400).send('No file uploaded');
  // Make sure the chat exists before saving the file
  db.get('SELECT id FROM chats WHERE id = ?', [chatId], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!row) {
      return res.status(400).send('Chat does not exist');
    }
    db.run(
      `INSERT INTO pdfs (chat_id, filename, filepath, mimetype) VALUES (?, ?, ?, ?)`,
      [chatId, file.originalname, file.path, file.mimetype],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).send('Database error');
        }
        res.json({ id: this.lastID, filename: file.originalname });
      }
    );
  });
});

// Retrieve all PDFs for a specific chat
app.get('/chats/:chatId/pdfs', (req, res) => {
  const chatId = req.params.chatId;
  db.all(`SELECT * FROM pdfs WHERE chat_id = ? ORDER BY uploaded_at DESC`, [chatId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.json(rows);
  });
});

// Rename a chat with a new title
app.put('/chats/:chatId', (req, res) => {
  const { chatId } = req.params;
  const { title } = req.body;
  if (!title || typeof title !== 'string') {
    return res.status(400).send('Invalid title');
  }
  db.run('UPDATE chats SET title = ? WHERE id = ?', [title, chatId], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to rename chat');
    }
    res.sendStatus(200);
  });
});

// Delete a chat and all its associated PDFs
app.delete('/chats/:chatId', (req, res) => {
  const { chatId } = req.params;
  // First, remove all PDFs linked to the chat
  db.run('DELETE FROM pdfs WHERE chat_id = ?', [chatId], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to delete PDFs');
    }
    // Then, remove the chat itself
    db.run('DELETE FROM chats WHERE id = ?', [chatId], function (err2) {
      if (err2) {
        console.error(err2);
        return res.status(500).send('Failed to delete chat');
      }
      res.sendStatus(200);
    });
  });
});

// Set the OpenAI API key at runtime via an API endpoint
app.post('/api/set-openai-key', (req, res) => {
  dynamicOpenAIKey = req.body.apikey;
  if (!dynamicOpenAIKey) return res.status(400).json({ error: 'API key required' });
  res.json({ success: true });
});

// Handle Q&A requests using OpenAI, with support for PDF and image context
app.post('/api/ask', async (req, res) => {
  const { question, chatId } = req.body;
  if (!question) return res.status(400).json({ error: 'Question is required' });
  if (!dynamicOpenAIKey) return res.status(400).json({ error: 'OpenAI API key not set.' });

  const openai = new OpenAI({ apiKey: dynamicOpenAIKey });
  let messages = [];
  let useVisionModel = false;
  let context = '';

  // Load previous chat messages
  if (chatId) {
    try {
      const chatRow = await new Promise((resolve, reject) => {
        db.get('SELECT messages FROM chats WHERE id = ?', [chatId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (chatRow?.messages) {
        const previousMessages = JSON.parse(chatRow.messages);
        if (Array.isArray(previousMessages)) {
          messages = [...previousMessages];
        }
      }
    } catch (err) {
      // console.error("❌ Failed to load previous messages:", err);
    }
  }

  // Determine if the question is document-related
  const isPDFRelated = /summarize|explain|according to|in the pdf|based on the document|tools used|abstract|what does it say|methods used/i.test(question);

  // Try to get file context if needed
  if (chatId && isPDFRelated) {
    try {
      const fileRow = await new Promise((resolve, reject) => {
        db.get(
          'SELECT filepath, mimetype FROM pdfs WHERE chat_id = ? ORDER BY uploaded_at DESC LIMIT 1',
          [chatId],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      if (fileRow && fileRow.filepath && fs.existsSync(fileRow.filepath)) {
        const dataBuffer = fs.readFileSync(fileRow.filepath);

        if (fileRow.mimetype === 'application/pdf') {
          const pdfData = await pdf(dataBuffer);
          context = `The following document has been uploaded for reference:\n\n"""${pdfData.text.substring(0, 3000)}"""\n\n`;
        } else if (fileRow.mimetype.startsWith('image/')) {
          const base64Image = dataBuffer.toString('base64');
          messages.push({
            role: 'user',
            content: [
              { type: 'text', text: question },
              {
                type: 'image_url',
                image_url: { url: `data:${fileRow.mimetype};base64,${base64Image}` },
              },
            ],
          });
          useVisionModel = true;
        }
      }
    } catch (err) {
    }
  }

  // Inject system context and user message
  if (!useVisionModel) {
    if (context) {
      messages.unshift({ role: 'system', content: context });
    }
    messages.push({ role: 'user', content: question });
  }

  // Clean up the message list to make sure it's valid
  messages = messages.filter(
    (m) =>
      m &&
      typeof m === 'object' &&
      ['user', 'assistant', 'system'].includes(m.role) &&
      (typeof m.content === 'string' || Array.isArray(m.content))
  );

  // Send to OpenAI
  let answer = '';
  try {
    const completion = await openai.chat.completions.create({
      model: useVisionModel ? 'gpt-4-vision-preview' : 'gpt-3.5-turbo',
      messages,
      max_tokens: 512,
    });

    answer = completion.choices?.[0]?.message?.content || "OpenAI returned an empty response.";
    messages.push({ role: 'assistant', content: answer });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get answer from OpenAI.' });
  }

  // Save updated messages to database
  if (chatId) {
    db.run(
      `UPDATE chats SET messages = ? WHERE id = ?`,
      [JSON.stringify(messages), chatId],
      (err) => {
        if (err) console.error("❌ Failed to save messages:", err);
      }
    );
  }

  // Generate follow-up questions
  let followups = [];
  try {
    const followupPrompt = `Based on the previous answer, suggest 3 relevant follow-up questions a user might ask next. Respond with each question on a new line, no numbering or extra text.`;

    const followupCompletion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        ...messages,
        { role: 'user', content: followupPrompt }
      ],
      max_tokens: 100,
    });

    followups = followupCompletion.choices?.[0]?.message?.content
      ?.split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0) || [];
  } catch (err) {
    console.error("⚠️ Follow-up question generation failed:", err.response?.data || err.message || err);
  }

  res.json({ answer, followups });
});

// Delete a file from disk and database
app.delete('/files/:fileId', (req, res) => {
  const { fileId } = req.params;
  db.get('SELECT filepath FROM pdfs WHERE id = ?', [fileId], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (!row) return res.status(404).send('File not found');
    // Delete the file from disk
    try {
      if (fs.existsSync(row.filepath)) fs.unlinkSync(row.filepath);
    } catch (e) {
      console.error('Failed to delete file from disk:', e);
    }
    // Delete from database
    db.run('DELETE FROM pdfs WHERE id = ?', [fileId], function (err2) {
      if (err2) {
        console.error(err2);
        return res.status(500).send('Failed to delete file');
      }
      res.sendStatus(200);
    });
  });
});

// Generate infographic from PDF content
app.post('/api/generate-infographic', async (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ error: 'Chat ID is required' });
  if (!dynamicOpenAIKey) return res.status(400).json({ error: 'OpenAI API key not set.' });

  const openai = new OpenAI({ apiKey: dynamicOpenAIKey });
  let pdfText = '';
  let summary = '';

  try {
    // Get the most recent PDF from the chat
    const fileRow = await new Promise((resolve, reject) => {
      db.get(
        'SELECT filepath, mimetype FROM pdfs WHERE chat_id = ? ORDER BY uploaded_at DESC LIMIT 1',
        [chatId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (!fileRow || !fileRow.filepath || !fs.existsSync(fileRow.filepath)) {
      return res.status(400).json({ error: 'No PDF file found in this chat' });
    }

    if (fileRow.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported for infographic generation' });
    }

    // Extract text from PDF
    const dataBuffer = fs.readFileSync(fileRow.filepath);
    const pdfData = await pdf(dataBuffer);
    pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length === 0) {
      return res.status(400).json({ error: 'No text content found in the PDF' });
    }

    // Generate enhanced summary using GPT for better infographic content
    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating comprehensive, dynamic summaries for professional infographic generation. Analyze the document thoroughly and extract ALL key information including: main topic, statistics, data points, processes, methodologies, findings, conclusions, percentages, ratios, measurable outcomes, timelines, benefits, and impacts. Focus on creating a complete picture that captures the essence of the research or document.'
        },
        {
          role: 'user',
          content: `Create a comprehensive, dynamic summary of this document for infographic generation. Extract ALL relevant information:

REQUIRED ELEMENTS TO EXTRACT:
1. MAIN TOPIC: The central theme or research focus
2. KEY STATISTICS: All numbers, percentages, ratios, measurements, and data points
3. PROCESSES/METHODOLOGIES: All steps, procedures, techniques, and methods mentioned
4. FINDINGS/CONCLUSIONS: All main results, discoveries, and conclusions
5. TIMELINES/DATES: Any temporal information, milestones, or timeframes
6. BENEFITS/IMPACTS: All advantages, improvements, outcomes, and effects
7. TECHNICAL DETAILS: Any technical specifications, requirements, or parameters
8. COMPARISONS: Any comparative data, benchmarks, or relative measurements

IMPORTANT: 
- Extract EVERY number, statistic, and data point you find
- Include ALL processes and methodologies mentioned
- Capture ALL findings and conclusions
- Note any graphs, charts, or visual data mentioned
- Identify the document's theme and color scheme if mentioned
- Be comprehensive - don't miss any important information

Document content:
${pdfText.substring(0, 6000)}`
        }
      ],
      max_tokens: 1000,
    });

    summary = summaryResponse.choices?.[0]?.message?.content || 'Summary generation failed';

    // Generate structured content for infographic with clear, readable text
    const contentGenerationResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating dynamic, comprehensive infographic content. Analyze the summary thoroughly and extract the MOST IMPORTANT and IMPACTFUL information that would work best in a visual infographic. Focus on the most compelling data points, key processes, and significant findings that tell the complete story.'
        },
        {
          role: 'user',
          content: `Based on this comprehensive summary, create a COMPLETE infographic that captures the FULL picture of the research:

${summary}

PROFESSIONAL COMPREHENSIVE INFOGRAPHIC CONTENT REQUIREMENTS:

Generate a COMPLETE overview with EXACT formatting - include ALL significant information:

TITLE: [Compelling main topic - 6-10 words, descriptive and specific to the research]
STAT 1: [Important statistic with exact numbers/percentages]
STAT 2: [Second important statistic with exact numbers/percentages]
STAT 3: [Third important statistic with exact numbers/percentages]
STAT 4: [Fourth important statistic if available]
STAT 5: [Fifth important statistic if available]
PROCESS 1: [Important process/methodology - 4-8 words]
PROCESS 2: [Second important process/methodology - 4-8 words]
PROCESS 3: [Third important process if available - 4-8 words]
FINDING 1: [Important finding/conclusion - 5-8 words]
FINDING 2: [Second important finding/conclusion - 5-8 words]
FINDING 3: [Third important finding if available - 5-8 words]
IMPACT 1: [Important impact/benefit - 5-8 words]
IMPACT 2: [Second important impact/benefit - 5-8 words]
IMPACT 3: [Third important impact if available - 5-8 words]
TIMELINE: [Key timeline information if available - 4-8 words]
COMPARISON: [Key comparison data if available - 4-8 words]

CRITICAL PROFESSIONAL GUIDELINES:
- Extract EVERY significant piece of information from the summary
- Include ALL numbers, percentages, and data points found
- Use EXACT technical terms and measurements from the document
- Include ALL processes, methodologies, and techniques mentioned
- Capture ALL findings, conclusions, and results
- Include ALL impacts, benefits, and outcomes
- Use longer, more descriptive text (4-8 words per element)
- Fill the infographic with comprehensive information
- Don't skip any important data - be thorough
- Create a complete picture that tells the full story
- Include technical details and specifications
- Use specific terminology from the research
- Ensure the infographic provides a complete overview of the document`
        }
      ],
      max_tokens: 600,
    });

    const generatedContent = contentGenerationResponse.choices?.[0]?.message?.content || '';

    // Parse the generated content into structured sections
    const contentLines = generatedContent.split('\n').filter(line => line.trim());
    
         // Extract comprehensive elements from the generated content with dynamic fallbacks
     let title = contentLines.find(line => line.includes('TITLE:'))?.split(':')[1]?.trim() || '';
     
     // Ensure we have a good title - if empty or too generic, create a fallback
     if (!title || title.length < 3 || title.toLowerCase().includes('research') || title.toLowerCase().includes('study')) {
       // Extract key terms from the summary to create a better title
       const summaryWords = summary.split(' ').filter(word => 
         word.length > 3 && 
         !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'they', 'have', 'been', 'will', 'were'].includes(word.toLowerCase())
       );
       const keyTerms = summaryWords.slice(0, 8).join(' ').replace(/[^a-zA-Z0-9 ]/g, '');
       title = keyTerms.charAt(0).toUpperCase() + keyTerms.slice(1);
       if (!title || title.length < 3) {
         title = 'Research Overview';
       }
     }
     const stat1 = contentLines.find(line => line.includes('STAT 1:'))?.split(':')[1]?.trim() || '';
     const stat2 = contentLines.find(line => line.includes('STAT 2:'))?.split(':')[1]?.trim() || '';
     const stat3 = contentLines.find(line => line.includes('STAT 3:'))?.split(':')[1]?.trim() || '';
     const stat4 = contentLines.find(line => line.includes('STAT 4:'))?.split(':')[1]?.trim() || '';
     const stat5 = contentLines.find(line => line.includes('STAT 5:'))?.split(':')[1]?.trim() || '';
     const process1 = contentLines.find(line => line.includes('PROCESS 1:'))?.split(':')[1]?.trim() || '';
     const process2 = contentLines.find(line => line.includes('PROCESS 2:'))?.split(':')[1]?.trim() || '';
     const process3 = contentLines.find(line => line.includes('PROCESS 3:'))?.split(':')[1]?.trim() || '';
     const finding1 = contentLines.find(line => line.includes('FINDING 1:'))?.split(':')[1]?.trim() || '';
     const finding2 = contentLines.find(line => line.includes('FINDING 2:'))?.split(':')[1]?.trim() || '';
     const finding3 = contentLines.find(line => line.includes('FINDING 3:'))?.split(':')[1]?.trim() || '';
     const impact1 = contentLines.find(line => line.includes('IMPACT 1:'))?.split(':')[1]?.trim() || '';
     const impact2 = contentLines.find(line => line.includes('IMPACT 2:'))?.split(':')[1]?.trim() || '';
     const impact3 = contentLines.find(line => line.includes('IMPACT 3:'))?.split(':')[1]?.trim() || '';
     const timeline = contentLines.find(line => line.includes('TIMELINE:'))?.split(':')[1]?.trim() || '';
     const comparison = contentLines.find(line => line.includes('COMPARISON:'))?.split(':')[1]?.trim() || '';
        
     const enhancedPrompt = `Create a professional, information-rich infographic titled:

**${title}**

SECTION: KEY STATISTICS
- ${stat1}
- ${stat2}
- ${stat3}
${stat4 ? `- ${stat4}` : ''}
${stat5 ? `- ${stat5}` : ''}

SECTION: PROCESSES
Visualize this process as a left-to-right flowchart:
${process1} → ${process2}${process3 ? ` → ${process3}` : ''}

SECTION: FINDINGS
- ${finding1}
- ${finding2}
${finding3 ? `- ${finding3}` : ''}

SECTION: IMPACTS
- ${impact1}
- ${impact2}
${impact3 ? `- ${impact3}` : ''}

${timeline ? `SECTION: TIMELINE\n- ${timeline}` : ''}
${comparison ? `SECTION: COMPARISON\n- ${comparison}` : ''}

---

🎨 Visual Design Requirements:
- Title should be at the VERY TOP, centered, in bold title case, with excellent contrast
- Section headers: large, uppercase, clearly separated
- Use icons next to each bullet point (bar chart, gear, lightbulb, etc.)
- Use pie charts or bar graphs for statistics
- Use arrows and icons in the PROCESS section
- Align content into a 2x3 grid layout if space allows
- Clean, modern academic theme with light neutral background
- Use navy blue, teal, and gray tones for contrast
- Avoid large white gaps: keep layout tight and well-aligned
- Make sure all text is visible and not cut off
- Overall layout should match an academic research infographic or poster
- Output in 1024x1024 square layout
- BACKGROUND THEME COLOR: Suggest a subtle background color based on the overall theme of the document (e.g. green for crops, blue for oceans, beige for industry)
- 🧠 Add a 1–2 sentence overview at the top or bottom of the image to summarize the entire infographic at a glance

🚨 CRITICAL LAYOUT REQUIREMENTS:
- Avoid any content overflow - ensure all text and icons are fully visible
- Leave generous margins (at least 15% on all sides) to prevent clipping
- Use compact text layout to fit all content within safe margins
- Ensure NO text or icons are clipped at the bottom edges
- Use smaller, readable fonts if needed to prevent overflow
- Prioritize content visibility over density - better to have less content than clipped text
- Test layout to ensure all elements fit within the 1024x1024 frame`;

    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: enhancedPrompt,
      size: "1024x1024",
      quality: "high",
      n: 1,
    });

    // Handle both URL and base64 responses
    const imageData = imageResponse.data?.[0];
    let imageUrl;
    
    if (imageData?.url) {
      imageUrl = imageData.url;
    } else if (imageData?.b64_json) {
      // Convert base64 to data URL
      imageUrl = `data:image/png;base64,${imageData.b64_json}`;
    } else {
      return res.status(500).json({ error: 'Failed to generate infographic image' });
    }
         // Generate a second infographic with alternative style
     const alternativePrompt = `Create a professional, information-rich infographic titled:

**${title}**

SECTION: KEY STATISTICS
- ${stat1}
- ${stat2}
- ${stat3}
${stat4 ? `- ${stat4}` : ''}
${stat5 ? `- ${stat5}` : ''}

SECTION: PROCESSES
Visualize this process as a left-to-right flowchart:
${process1} → ${process2}${process3 ? ` → ${process3}` : ''}

SECTION: FINDINGS
- ${finding1}
- ${finding2}
${finding3 ? `- ${finding3}` : ''}

SECTION: IMPACTS
- ${impact1}
- ${impact2}
${impact3 ? `- ${impact3}` : ''}

${timeline ? `SECTION: TIMELINE\n- ${timeline}` : ''}
${comparison ? `SECTION: COMPARISON\n- ${comparison}` : ''}

---

🎨 Visual Design Requirements:
- Title should be at the VERY TOP, centered, in bold title case, with excellent contrast
- Section headers: large, uppercase, clearly separated
- Use icons next to each bullet point (bar chart, gear, lightbulb, etc.)
- Use pie charts or bar graphs for statistics
- Use arrows and icons in the PROCESS section
- Align content into a 2x3 grid layout if space allows
- Clean, modern academic theme with light neutral background
- Use navy blue, teal, and gray tones for contrast
- Avoid large white gaps: keep layout tight and well-aligned
- Make sure all text is visible and not cut off
- Overall layout should match an academic research infographic or poster
- Output in 1024x1024 square layout
- BACKGROUND THEME COLOR: Suggest a subtle background color based on the overall theme of the document (e.g. green for crops, blue for oceans, beige for industry)
- 🧠 Add a 1–2 sentence overview at the top or bottom of the image to summarize the entire infographic at a glance

🚨 CRITICAL LAYOUT REQUIREMENTS:
- Avoid any content overflow - ensure all text and icons are fully visible
- Leave generous margins (at least 15% on all sides) to prevent clipping
- Use compact text layout to fit all content within safe margins
- Ensure NO text or icons are clipped at the bottom edges
- Use smaller, readable fonts if needed to prevent overflow
- Prioritize content visibility over density - better to have less content than clipped text
- Test layout to ensure all elements fit within the 1024x1024 frame`;

    const alternativeImageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: alternativePrompt,
      size: "1024x1024",
      quality: "high",
      n: 1,
    });

    // Handle both URL and base64 responses for alternative image
    const alternativeImageData = alternativeImageResponse.data?.[0];
    let alternativeImageUrl;
    
    if (alternativeImageData?.url) {
      alternativeImageUrl = alternativeImageData.url;
    } else if (alternativeImageData?.b64_json) {
      // Convert base64 to data URL
      alternativeImageUrl = `data:image/png;base64,${alternativeImageData.b64_json}`;
    } else {
      return res.status(500).json({ error: 'Failed to generate alternative infographic image' });
    }

         // Generate a third infographic with modern dashboard style
     const dashboardPrompt = `Create a professional, information-rich infographic titled:

**${title}**

SECTION: KEY STATISTICS
- ${stat1}
- ${stat2}
- ${stat3}
${stat4 ? `- ${stat4}` : ''}
${stat5 ? `- ${stat5}` : ''}

SECTION: PROCESSES
Visualize this process as a left-to-right flowchart:
${process1} → ${process2}${process3 ? ` → ${process3}` : ''}

SECTION: FINDINGS
- ${finding1}
- ${finding2}
${finding3 ? `- ${finding3}` : ''}

SECTION: IMPACTS
- ${impact1}
- ${impact2}
${impact3 ? `- ${impact3}` : ''}

${timeline ? `SECTION: TIMELINE\n- ${timeline}` : ''}
${comparison ? `SECTION: COMPARISON\n- ${comparison}` : ''}

---

🎨 Visual Design Requirements:
- Title should be at the VERY TOP, centered, in bold title case, with excellent contrast
- Section headers: large, uppercase, clearly separated
- Use icons next to each bullet point (bar chart, gear, lightbulb, etc.)
- Use pie charts or bar graphs for statistics
- Use arrows and icons in the PROCESS section
- Align content into a 2x3 grid layout if space allows
- Clean, modern academic theme with light neutral background
- Use navy blue, teal, and gray tones for contrast
- Avoid large white gaps: keep layout tight and well-aligned
- Make sure all text is visible and not cut off
- Overall layout should match an academic research infographic or poster
- Output in 1024x1024 square layout
- BACKGROUND THEME COLOR: Suggest a subtle background color based on the overall theme of the document (e.g. green for crops, blue for oceans, beige for industry)
- 🧠 Add a 1–2 sentence overview at the top or bottom of the image to summarize the entire infographic at a glance

🚨 CRITICAL LAYOUT REQUIREMENTS:
- Avoid any content overflow - ensure all text and icons are fully visible
- Leave generous margins (at least 15% on all sides) to prevent clipping
- Use compact text layout to fit all content within safe margins
- Ensure NO text or icons are clipped at the bottom edges
- Use smaller, readable fonts if needed to prevent overflow
- Prioritize content visibility over density - better to have less content than clipped text
- Test layout to ensure all elements fit within the 1024x1024 frame`;

    const dashboardImageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: dashboardPrompt,
      size: "1024x1024",
      quality: "high",
      n: 1,
    });

    // Handle both URL and base64 responses for dashboard image
    const dashboardImageData = dashboardImageResponse.data?.[0];
    let dashboardImageUrl;
    
    if (dashboardImageData?.url) {
      dashboardImageUrl = dashboardImageData.url;
    } else if (dashboardImageData?.b64_json) {
      // Convert base64 to data URL
      dashboardImageUrl = `data:image/png;base64,${dashboardImageData.b64_json}`;
    } else {
      return res.status(500).json({ error: 'Failed to generate dashboard infographic image' });
    }

    res.json({ 
      imageUrl, 
      alternativeImageUrl,
      dashboardImageUrl,
      summary,
      success: true 
    });

  } catch (err) {
    console.error("❌ Infographic generation error:", err.response?.data || err.message || err);
    return res.status(500).json({ error: 'Failed to generate infographic. Please try again.' });
  }
});

app.listen(5000, () => console.log('Backend running on http://localhost:5000'));