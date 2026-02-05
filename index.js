const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const summarizer = require("./src/services/summarizer");
const { cleanupOldFiles } = require('./cleanup.js');
require("dotenv").config();

const deepgram = require("@deepgram/sdk");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from React build (when you have it)
app.use(express.static(path.join(__dirname, "../summaro-frontend/build")));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    message: "Summaro Backend is Running!",
    timestamp: new Date().toISOString(),
  });
});

// // Start cleanup automatically
// const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
// setInterval(cleanupOldFiles, CLEANUP_INTERVAL);

// Also run once on startup
cleanupOldFiles();


// Add GET endpoint to list files
app.get("/api/files", async (req, res) => {
  try {
    console.log("📁 Attempting to read uploads directory...");

    // Check if directory exists
    const fs = require("fs");
    const uploadsPath = path.join(__dirname, "uploads");

    console.log("Looking for directory at:", uploadsPath);

    if (!fs.existsSync(uploadsPath)) {
      console.log("❌ Directory doesn't exist, creating it...");
      fs.mkdirSync(uploadsPath, { recursive: true });
    }

    // Now read the directory
    const files = await fs.promises.readdir(uploadsPath);
    console.log(`✅ Found ${files.length} files:`, files);

    const fileInfo = files.map((file) => {
      const filePath = path.join(uploadsPath, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        originalName: file.replace(/^audio-\d+-\d+/, "uploaded-file"),
        size: stats.size,
        uploaded: stats.birthtime,
        url: `/uploads/${file}`,
      };
    });

    res.json({
      success: true,
      count: fileInfo.length,
      files: fileInfo,
    });
  } catch (error) {
    console.error("❌ Error reading files:", error);
    console.error("Full error details:", error.stack);

    res.status(500).json({
      success: false,
      error: "Failed to read files",
      details: error.message,
      path: __dirname,
    });
  }
});

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// Configure where and how to store uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create 'uploads' folder if it doesn't exist
    const fs = require("fs");
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads");
    }
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    // Create unique filename to prevent overwrites
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

// SIMPLE VERSION - Just check file extension
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    // Only check the file extension (ignore MIME type for now)
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm"];

    if (allowed.includes(ext)) {
      console.log(`✅ Accepting ${file.originalname} with extension ${ext}`);
      return cb(null, true);
    } else {
      console.log(`❌ Rejecting ${file.originalname} - wrong extension`);
      cb(new Error(`Only ${allowed.join(", ")} files are allowed`));
    }
  },
});

// ✅ Enhanced Action Item Extraction Algorithm
// ✅ Minimal Action Item Extractor (Works for any audio)
function extractActionItems(transcript, deepgramItems = []) {
  let actionItems = [];
  
  // If Deepgram provides action items, use them with minimal cleaning
  if (deepgramItems && deepgramItems.length > 0) {
    deepgramItems.forEach(item => {
      if (item?.description) {
        let text = item.description.trim();
        
        // Basic cleanup
        text = text
          .replace(/^(Speaker\s*\d+:?\s*)/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Make it a complete sentence
        if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
          text += '.';
        }
        
        // Capitalize first letter
        text = text.charAt(0).toUpperCase() + text.slice(1);
        
        // Only add if it looks like a reasonable sentence
        if (text.length > 10 && text.length < 120) {
          actionItems.push(text);
        }
      }
    });
  }
  
  // Always return at least something
  if (actionItems.length === 0) {
    actionItems = ["No specific action items mentioned in the meeting."];
  }
  
  // Limit to 5 items max
  return actionItems.slice(0, 5);
}

// Extract action items directly from transcript
function extractFromTranscript(transcript) {
  const actionItems = [];
  
  // Common action item patterns
  const patterns = [
    /(?:need to|must|should|will|going to)\s+(\w+\s+\w+\s+\w+\s+\w+\s+\w+)/gi,
    /(?:please|can you|could you)\s+(\w+\s+\w+\s+\w+\s+\w+)/gi,
    /(?:action item|todo|task):?\s*(.+?)(?:\.|$)/gi,
    /(?:follow up|follow-up)\s+(?:on|with|about)\s+(.+?)(?:\.|$)/gi,
    /(?:remember to|don't forget to)\s+(.+?)(?:\.|$)/gi,
    /(?:deadline|due)\s+(?:is|on)\s+(.+?)(?:\.|$)/gi,
  ];
  
  patterns.forEach(pattern => {
    const matches = transcript.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        let item = match[1].trim();
        
        // Clean up the extracted item
        item = cleanActionItem(item);
        
        if (item && !item.toLowerCase().includes('thank you') && 
            !item.toLowerCase().includes('bye') &&
            item.length > 15 && item.length < 100) {
          actionItems.push(item);
        }
      }
    }
  });
  
  return actionItems;
}

// Clean individual action item
function cleanActionItem(text) {
  // Remove speaker labels
  text = text.replace(/^(Speaker\s*\d+:?\s*)/i, '');
  
  // Remove weak phrases
  const removePhrases = [
    'I think', 'maybe we', 'perhaps we', 'probably', 
    'just want to', 'really need to', 'actually'
  ];
  
  removePhrases.forEach(phrase => {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    text = text.replace(regex, '');
  });
  
  // Trim and format
  text = text.replace(/\s+/g, ' ').trim();
  text = text.charAt(0).toUpperCase() + text.slice(1);
  
  // Ensure it ends with proper punctuation
  if (!text.endsWith('.') && !text.endsWith('!')) {
    text += '.';
  }
  
  return text;
}

// Deduplicate similar action items
function deduplicateActionItems(items) {
  const uniqueItems = [];
  const seen = new Set();
  
  items.forEach(item => {
    // Create a simplified version for comparison
    const simplified = item.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Check if we've seen something similar
    let isDuplicate = false;
    for (const seenItem of seen) {
      const similarity = calculateSimilarity(simplified, seenItem);
      if (similarity > 0.7) { // 70% similarity threshold
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate && simplified.length > 5) {
      uniqueItems.push(item);
      seen.add(simplified);
    }
  });
  
  return uniqueItems;
}

// Simple similarity calculation
function calculateSimilarity(str1, str2) {
  const words1 = str1.split(' ');
  const words2 = str2.split(' ');
  const common = words1.filter(word => words2.includes(word)).length;
  return common / Math.max(words1.length, words2.length);
}

// ✅ Normalize speaker labels to be more natural
function normalizeSpeakers(text) {
  if (!text) return text;
  
  // Replace "Speaker 0", "Speaker 1", etc. with more natural labels
  const speakerMap = {
    'Speaker 0': 'Host',
    'Speaker 1': 'Guest',
    'Speaker 2': 'Participant',
    'Speaker 3': 'Attendee',
    'Speaker 4': 'Moderator',
    'Speaker 5': 'Presenter'
  };
  
  let normalizedText = text;
  
  // Replace numbered speakers
  Object.entries(speakerMap).forEach(([oldSpeaker, newSpeaker]) => {
    const regex = new RegExp(oldSpeaker.replace(/\s+/g, '\\s*'), 'gi');
    normalizedText = normalizedText.replace(regex, newSpeaker);
  });
  
  // Replace any remaining "Speaker X" patterns
  normalizedText = normalizedText.replace(/Speaker\s*\d+/gi, 'Speaker');
  
  // Clean up colon formatting
  normalizedText = normalizedText.replace(/(Host|Guest|Participant|Attendee|Moderator|Presenter|Speaker):\s*/g, '$1: ');
  
  return normalizedText;
}

// POST endpoint for audio upload
// POST endpoint for audio upload
app.post("/api/upload-audio", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: "No file uploaded" 
      });
    }

    console.log(`🎤 Processing: ${req.file.originalname}`);
    
    // Check if Deepgram API key exists
    if (!process.env.DEEPGRAM_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Deepgram API key not configured"
      });
    }

    const deepgramClient = deepgram.createClient({
      apiKey: process.env.DEEPGRAM_API_KEY,
    });

    console.log('🔍 Sending to Deepgram with summarization...');
    
    const { result, error } = await deepgramClient.listen.prerecorded.transcribeFile(
      fs.createReadStream(req.file.path),
      {
        model: "nova-3",
        smart_format: true,
        language: "en",
        summarize: "v2",
        utterances: true,
        paragraphs: true,
        detect_language: true,
        diarize: true,
      }
    );

    if (error) {
      console.error('❌ Deepgram error:', error);
      throw new Error(`Deepgram API error: ${error.message}`);
    }

    console.log('✅ Deepgram transcription & summarization successful!');
    
    // Extract transcript
    let transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || 
                    "No transcript generated";
    
    // Extract Deepgram's AI summary
    let deepgramSummary = result?.results?.channels?.[0]?.alternatives?.[0]?.summary || 
                         result?.results?.summary?.short || 
                         "No summary generated by AI";
    
    // ✅ NEW: Process summary into the required format
    const processedSummary = processSummaryIntoSentences(deepgramSummary);
    const actionItems = generateActionItemsForSentences(processedSummary.sentences);
    
    // Calculate confidence
    const confidence = result?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    
    // ✅ NEW: Format for frontend display
    const formattedOutput = formatForDisplay(processedSummary, actionItems);
    
    // Return response
    res.json({
      success: true,
      message: "Audio processed with Deepgram AI",
      file: {
        originalName: req.file.originalname,
        size: req.file.size,
        duration: result?.metadata?.duration || 0,
      },
      transcript,
      summary: formattedOutput.summary,
      actionItems: formattedOutput.actionItems,
      formattedOutput, // ✅ Include structured format
      deepgramResult: {
        model: result?.metadata?.model_info?.[Object.keys(result.metadata.model_info)[0]]?.name || "nova-3",
        duration: result?.metadata?.duration || 0,
        confidence: confidence,
        summaryType: "v2",
      },
      stats: {
        transcriptLength: transcript.length,
        summaryLength: deepgramSummary.length,
        compression: Math.round((1 - deepgramSummary.length / transcript.length) * 100) + '%',
        wordCount: transcript.split(' ').length,
        actionItemsCount: actionItems.length,
        confidence: Math.round(confidence * 100) + '%',
      },
      processing: {
        engine: "Deepgram Nova-3",
        features: ["Speech-to-Text", "AI Summarization", "Action Item Extraction"],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Processing error:', error);
    
    // Fallback
    try {
      console.log('⚠️  Deepgram failed, trying fallback...');
      
      const transcript = "Audio received but Deepgram processing failed.";
      const fallbackSentences = [
        "The audio file was uploaded successfully.",
        "However, Deepgram processing encountered an issue.",
        "Please check your API key configuration and try again."
      ];
      const fallbackActions = [
        "Verify Deepgram API key is properly configured",
        "Check internet connection",
        "Ensure audio format is supported"
      ];
      
      res.json({
        success: true,
        message: "Processed with fallback",
        file: {
          originalName: req.file?.originalname || "Unknown",
          size: req.file?.size || 0,
        },
        transcript,
        summary: fallbackSentences.join('\n'),
        actionItems: fallbackActions,
        formattedOutput: {
          summary: fallbackSentences.join('\n'),
          actionItems: fallbackActions.map((action, index) => `${index + 1}. ${action}`).join('\n')
        },
        note: "Deepgram API failed. Check API key and configuration.",
      });
      
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

// ✅ NEW: Helper functions for the required format

/**
 * Process summary into clean sentences
 */
function processSummaryIntoSentences(summary) {
  // Split into sentences
  const sentences = summary
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(cleanSentence);
  
  // Limit to reasonable number of sentences (3-5)
  const limitedSentences = sentences.slice(0, 5);
  
  return {
    sentences: limitedSentences,
    formatted: limitedSentences.join('\n')
  };
}

/**
 * Clean individual sentence
 */
function cleanSentence(sentence) {
  // Remove filler words
  const fillerWords = [
    'um', 'uh', 'like', 'you know', 'actually', 'basically',
    'literally', 'seriously', 'honestly', 'just', 'really'
  ];
  
  let cleaned = sentence;
  fillerWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  
  // Remove extra spaces and punctuation
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
  
  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  // Ensure ends with period
  if (cleaned.length > 0 && !cleaned.match(/[.!?]$/)) {
    cleaned += '.';
  }
  
  return cleaned;
}

/**
 * Generate action items for each sentence
 */
function generateActionItemsForSentences(sentences) {
  return sentences.map((sentence, index) => {
    const action = extractActionFromSentence(sentence);
    return {
      sentenceNumber: index + 1,
      sentence: sentence,
      action: action || "No specific action required"
    };
  });
}

/**
 * Extract action from a sentence
 */
function extractActionFromSentence(sentence) {
  const lowerSentence = sentence.toLowerCase();
  
  // Common action patterns
  if (lowerSentence.includes('need to') || lowerSentence.includes('must')) {
    return extractNeedAction(sentence);
  }
  
  if (lowerSentence.includes('will') || lowerSentence.includes('going to')) {
    return extractFutureAction(sentence);
  }
  
  if (lowerSentence.includes('should') || lowerSentence.includes('recommend')) {
    return extractRecommendation(sentence);
  }
  
  if (lowerSentence.includes('task') || lowerSentence.includes('assignment')) {
    return extractTask(sentence);
  }
  
  if (lowerSentence.includes('follow up') || lowerSentence.includes('check')) {
    return extractFollowUp(sentence);
  }
  
  if (lowerSentence.includes('schedule') || lowerSentence.includes('meeting')) {
    return extractScheduling(sentence);
  }
  
  // Default: no specific action
  return "No specific action required";
}

/**
 * Extract "need to" actions
 */
function extractNeedAction(sentence) {
  const match = sentence.match(/need to\s+(.+?)[.!?]/i);
  if (match) {
    return formatAction(match[1]);
  }
  return "Review requirements mentioned";
}

/**
 * Extract future actions
 */
function extractFutureAction(sentence) {
  const match = sentence.match(/(?:will|going to)\s+(.+?)[.!?]/i);
  if (match) {
    return formatAction(match[1]);
  }
  return "Plan for upcoming tasks";
}

/**
 * Format action to be clear and practical
 */
function formatAction(text) {
  // Remove unnecessary words
  let action = text
    .replace(/^(please|kindly|maybe|perhaps)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Capitalize first letter
  if (action.length > 0) {
    action = action.charAt(0).toUpperCase() + action.slice(1);
  }
  
  // Ensure it looks like an action item
  if (!action.endsWith('.')) {
    action += '.';
  }
  
  return action;
}

/**
 * Format output for display
 */
function formatForDisplay(processedSummary, actionItems) {
  const summaryText = processedSummary.formatted;
  
  const actionItemsText = actionItems
    .map(item => `${item.sentenceNumber}. ${item.action}`)
    .join('\n');
  
  return {
    summary: summaryText,
    actionItems: actionItemsText,
    structured: {
      sentences: processedSummary.sentences,
      actions: actionItems.map(item => item.action)
    }
  };
}

// Helper extraction functions (continued from above)
function extractRecommendation(sentence) {
  const match = sentence.match(/should\s+(.+?)[.!?]/i);
  if (match) {
    return `Consider: ${formatAction(match[1])}`;
  }
  return "Review recommendations";
}

function extractTask(sentence) {
  const match = sentence.match(/task\s+(?:is\s+)?to\s+(.+?)[.!?]/i);
  if (match) {
    return `Task: ${formatAction(match[1])}`;
  }
  return "Identify assigned tasks";
}

function extractFollowUp(sentence) {
  const match = sentence.match(/follow up\s+(?:on|with|about)\s+(.+?)[.!?]/i);
  if (match) {
    return `Follow up on: ${formatAction(match[1])}`;
  }
  return "Schedule follow-up";
}

function extractScheduling(sentence) {
  const match = sentence.match(/(?:schedule|meeting)\s+(?:for|about)\s+(.+?)[.!?]/i);
  if (match) {
    return `Schedule: ${formatAction(match[1])}`;
  }
  return "Arrange meeting if needed";
}

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File too large. Maximum size is 50MB",
      });
    }
    return res.status(400).json({
      success: false,
      error: "File upload error",
      details: err.message,
    });
  }

  // Other errors
  res.status(500).json({
    success: false,
    error: "Something went wrong",
    details: err.message,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Summaro backend running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  console.log(
    `🎤 Upload endpoint: POST http://localhost:${PORT}/api/upload-audio`,
  );
});