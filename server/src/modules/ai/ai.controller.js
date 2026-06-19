const crypto = require("crypto");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const redisClient = require("../../config/redis");
const AiConversation = require("../../models/AiConversation");
const AiMessage = require("../../models/AiMessage");

const isCloudMode = !!process.env.GEMINI_API_KEY;

/* =========================================================
   REDIS UTILITIES WITH GRACEFUL FALLBACK
========================================================= */
const redisGet = async (key) => {
  try {
    if (redisClient && redisClient.isOpen) {
      return await redisClient.get(key);
    }
  } catch (err) {
    console.error("Redis Get Error:", err);
  }
  return null;
};

const redisSet = async (key, val, ttl) => {
  try {
    if (redisClient && redisClient.isOpen) {
      if (ttl) {
        await redisClient.set(key, val, { EX: ttl });
      } else {
        await redisClient.set(key, val);
      }
    }
  } catch (err) {
    console.error("Redis Set Error:", err);
  }
};

const redisDel = async (key) => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(key);
    }
  } catch (err) {
    console.error("Redis Del Error:", err);
  }
};

/* Helper to hash prompt for response cache key */
const getHash = (str) => {
  return crypto.createHash("sha256").update(str).digest("hex");
};

/* =========================================================
   CONVERSATION CONTROLLER METHODS
========================================================= */

// GET all conversations for current user
exports.getConversations = async (req, res) => {
  const userId = req.user.id || req.user._id;
  const cacheKey = `ai:conversations:${userId}`;

  try {
    // 1. Check Redis Cache
    const cached = await redisGet(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    // 2. Fetch from DB
    const conversations = await AiConversation.find({ user: userId }).sort({ updatedAt: -1 });

    // 3. Save to Redis (expire in 5 minutes)
    await redisSet(cacheKey, JSON.stringify(conversations), 300);

    return res.status(200).json(conversations);
  } catch (error) {
    console.error("Error fetching AI conversations:", error);
    return res.status(500).json({ message: "Failed to fetch conversations" });
  }
};

// POST Create new conversation
exports.createConversation = async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { title, model, temperature } = req.body;

  try {
    const defaultModel = "gemini-2.5-flash";
    const conversation = await AiConversation.create({
      user: userId,
      title: title || "New Chat",
      model: model || defaultModel,
      temperature: temperature !== undefined ? temperature : 0.7,
    });

    // Invalidate conversations cache
    await redisDel(`ai:conversations:${userId}`);

    return res.status(201).json(conversation);
  } catch (error) {
    console.error("Error creating AI conversation:", error);
    return res.status(500).json({ message: "Failed to create conversation" });
  }
};

// PUT Rename conversation
exports.renameConversation = async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { id } = req.params;
  const { title } = req.body;

  try {
    const conversation = await AiConversation.findOneAndUpdate(
      { _id: id, user: userId },
      { title },
      { returnDocument: 'after' }
    );

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Invalidate caches
    await redisDel(`ai:conversations:${userId}`);
    await redisDel(`ai:conversation:${id}`);

    return res.status(200).json(conversation);
  } catch (error) {
    console.error("Error renaming AI conversation:", error);
    return res.status(500).json({ message: "Failed to rename conversation" });
  }
};

// DELETE Conversation
exports.deleteConversation = async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { id } = req.params;

  try {
    const conversation = await AiConversation.findOneAndDelete({ _id: id, user: userId });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Delete associated messages
    await AiMessage.deleteMany({ conversation: id });

    // Invalidate caches
    await redisDel(`ai:conversations:${userId}`);
    await redisDel(`ai:conversation:${id}`);
    await redisDel(`ai:messages:${id}`);

    return res.status(200).json({ message: "Conversation deleted successfully" });
  } catch (error) {
    console.error("Error deleting AI conversation:", error);
    return res.status(500).json({ message: "Failed to delete conversation" });
  }
};

// GET messages in a conversation
exports.getMessages = async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { id } = req.params;
  const cacheKey = `ai:messages:${id}`;

  try {
    // Verify ownership
    const conversation = await AiConversation.findOne({ _id: id, user: userId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Check cache
    const cached = await redisGet(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    // Load from DB
    const messages = await AiMessage.find({ conversation: id }).sort({ createdAt: 1 });

    // Cache (expire in 1 day)
    await redisSet(cacheKey, JSON.stringify(messages), 86400);

    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching AI messages:", error);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
};

/* =========================================================
   GEMINI STREAMING AND CHAT CONTROLLER
========================================================= */

exports.sendMessage = async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { id } = req.params;
  const { content, attachments = [], regenerate = false } = req.body;

  // Verify that a Gemini API key is present (Cloud Mode)
  const userApiKey = req.headers["x-gemini-key"] || req.user?.customAiApiKey;
  const runCloudMode = isCloudMode || !!userApiKey;
  if (!runCloudMode) {
    return res.status(400).json({ message: "Gemini API Key is required to use the AI Assistant." });
  }

  try {
    // 1. Verify and retrieve conversation details
    const conversation = await AiConversation.findOne({ _id: id, user: userId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    let userMessage = null;

    if (!regenerate) {
      // 2. Save user message to DB (if not regenerating)
      userMessage = await AiMessage.create({
        conversation: id,
        role: "user",
        content,
        attachments,
      });

      // Auto-name conversation title if it is default
      if ((conversation.title === "New AI Chat" || conversation.title === "New Chat") && content) {
        const lines = content.split("\n");
        let titleLine = "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("```") && !trimmed.startsWith("`") && !trimmed.startsWith("[")) {
            titleLine = trimmed;
            break;
          }
        }
        if (!titleLine) {
          titleLine = content.trim().split("\n")[0].trim();
        }
        
        let autoTitle = titleLine.replace(/^[#\s*`_\-\[\]]+/g, "").trim();
        if (autoTitle.length > 35) {
          autoTitle = autoTitle.substring(0, 32) + "...";
        }
        if (autoTitle) {
          conversation.title = autoTitle;
        }
      }

      // Update conversation timestamp
      conversation.updatedAt = new Date();
      await conversation.save();
    }

    // Invalidate conversation-related caches
    await redisDel(`ai:messages:${id}`);
    await redisDel(`ai:conversations:${userId}`);

    // Set headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // 3. Build Chat History for Gemini
    const previousMessages = await AiMessage.find({ conversation: id }).sort({ createdAt: 1 });
    const messagesPayload = [];

    previousMessages.forEach((msg) => {
      // Prepend file contents to prompt if present
      if (msg.role === "user") {
        let msgContent = "";
        if (msg.attachments && msg.attachments.length > 0) {
          msg.attachments.forEach((att) => {
            msgContent += `[ATTACHED FILE: ${att.fileName}]\n${att.extractedText}\n[END OF FILE CONTENT]\n\n`;
          });
        }
        msgContent += msg.content;
        messagesPayload.push({ role: "user", content: msgContent });
      } else {
        messagesPayload.push({ role: "assistant", content: msg.content });
      }
    });

    // If history is empty and user message is created but not saved yet, append it.
    // (Wait, `previousMessages` already includes the user message we just saved if !regenerate)

    // Construct full system prompt or guidelines
    const systemPrompt = `You are a professional, helpful developer-focused AI Assistant inside "Vertex Connect", a premium chatting and collaborations application.
Current Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Format responses in clean GitHub Flavored Markdown (GFM). Use headers, bold text, lists, and tables where helpful.
For code snippets, ALWAYS specify the language (e.g. \`\`\`javascript) and provide complete, clean, optimized code. Include comments where necessary.
Keep explanations clear and structured.
CRITICAL SAFETY RULE: You must absolutely refuse to respond to any sensitive, unsafe, harmful, hateful, sexually explicit, harassing, or highly inappropriate language or content. If the user prompt is inappropriate or sensitive, reply politely but firmly stating that you cannot answer or participate in such topics.`;

    const fullPayload = {
      model: conversation.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messagesPayload,
      ],
      options: {
        temperature: conversation.temperature,
        num_predict: conversation.maxTokens,
      },
      stream: true,
    };

    // 4. Redis AI Response Cache Logic
    const historyString = JSON.stringify(messagesPayload);
    const cacheHash = getHash(`${historyString}:${conversation.model}:${conversation.temperature}`);
    const responseCacheKey = `ai:response:${cacheHash}`;

    const cachedResponse = await redisGet(responseCacheKey);
    if (cachedResponse) {
      console.log("Serving AI response from Redis Cache!");
      
      // Stream cached response token-by-token with simulated delays
      const tokens = cachedResponse.split(/(\s+)/); // split keeping spaces
      let index = 0;

      const streamCache = setInterval(async () => {
        if (index >= tokens.length) {
          clearInterval(streamCache);

          // Save assistant message to DB
          const savedAssistantMsg = await AiMessage.create({
            conversation: id,
            role: "assistant",
            content: cachedResponse,
          });

          // Invalidate cache to include new assistant message
          await redisDel(`ai:messages:${id}`);

          res.write(`data: ${JSON.stringify({ done: true, message: savedAssistantMsg })}\n\n`);
          res.end();
          return;
        }

        const token = tokens[index];
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
        index++;
      }, 15);

      req.on("close", () => {
        clearInterval(streamCache);
      });
      return;
    }

    // 5. Cloud mode routing (we already verified runCloudMode is true)
    console.log("Routing request to Gemini Cloud...");
    let apiKey = (userApiKey || process.env.GEMINI_API_KEY || "").trim();
    if ((apiKey.startsWith('"') && apiKey.endsWith('"')) || (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
      apiKey = apiKey.slice(1, -1).trim();
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    let modelName = conversation.model.includes("gemini") ? conversation.model : "gemini-2.5-flash";
    if (modelName.includes("gemini-1.5")) {
      modelName = modelName.replace("gemini-1.5", "gemini-2.5");
    }
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      tools: [{ googleSearch: {} }],
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
      ]
    });

    const contents = [];
    previousMessages.forEach((msg) => {
      if (msg.role === "user") {
        let msgContent = "";
        if (msg.attachments && msg.attachments.length > 0) {
          msg.attachments.forEach((att) => {
            msgContent += `[ATTACHED FILE: ${att.fileName}]\n${att.extractedText}\n[END OF FILE CONTENT]\n\n`;
          });
        }
        msgContent += msg.content;
        contents.push({ role: "user", parts: [{ text: msgContent }] });
      } else {
        contents.push({ role: "model", parts: [{ text: msg.content }] });
      }
    });

    try {
      const result = await model.generateContentStream({
        contents,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature: conversation.temperature,
          maxOutputTokens: conversation.maxTokens,
        },
      });

      let fullGeneratedContent = "";

      req.on("close", () => {
        console.log("Client closed connection. Stopping Gemini stream...");
      });

      for await (const chunk of result.stream) {
        if (res.writableEnded) break;

        const chunkText = chunk.text();
        fullGeneratedContent += chunkText;

        res.write(`data: ${JSON.stringify({ token: chunkText })}\n\n`);
      }

      if (!res.writableEnded) {
        const savedAssistantMsg = await AiMessage.create({
          conversation: id,
          role: "assistant",
          content: fullGeneratedContent,
        });

        await redisDel(`ai:messages:${id}`);
        await redisSet(responseCacheKey, fullGeneratedContent, 3600);

        res.write(`data: ${JSON.stringify({ done: true, message: savedAssistantMsg })}\n\n`);
        res.end();
      }
    } catch (streamErr) {
      console.error("Gemini stream error:", streamErr);
      try {
        const fs = require("fs");
        const path = require("path");
        fs.appendFileSync(path.join(__dirname, "../../../gemini_error.log"), `[${new Date().toISOString()}] ${streamErr.stack || streamErr.message || streamErr}\n`);
      } catch (e) {
        console.error("Failed to write to file log:", e);
      }
      if (!res.writableEnded) {
        let userFriendlyError = `⚠️ **Gemini API Error**: I couldn't generate a response.\n\n`;
        const errMsg = streamErr.message || "";
        
        if (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("key is invalid")) {
          userFriendlyError += `The API key provided is invalid. Please open the main **Settings** (gear icon in the bottom-left sidebar), go to **AI Assistant**, and double-check your custom API key.`;
        } else if (errMsg.includes("429") || errMsg.includes("Quota exceeded") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("limit")) {
          userFriendlyError += `The API key has exceeded its rate limit or quota. Please wait a minute before trying again, or go to the main **Settings** (gear icon in the bottom-left sidebar), select **AI Assistant**, and provide your own Gemini API key.`;
        } else {
          userFriendlyError += `Details: *${errMsg || "An unknown error occurred during generation."}*`;
        }

        res.write(`data: ${JSON.stringify({ token: userFriendlyError })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, error: true })}\n\n`);
        res.end();
      }
    }

  } catch (error) {
    console.error("Error in AI sendMessage:", error);
    try {
      const fs = require("fs");
      const path = require("path");
      fs.appendFileSync(path.join(__dirname, "../../../gemini_error.log"), `[${new Date().toISOString()}] MAIN CATCH: ${error.stack || error.message || error}\n`);
    } catch (e) {
      console.error("Failed to write main catch error to log file:", e);
    }
    try {
      res.write(`data: ${JSON.stringify({ error: "Internal server error" })}\n\n`);
      res.end();
    } catch (e) {
      // headers already sent
    }
  }
};

/* =========================================================
   GET AVAILABLE AI MODELS
========================================================= */
exports.getModels = async (req, res) => {
  return res.status(200).json({
    ollamaConnected: false,
    isCloud: true,
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
  });
};

/* =========================================================
   DOCUMENT PARSER (PDF, DOCX, TXT, MD)
========================================================= */
exports.parseFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const { originalname, size, mimetype, buffer } = req.file;

  try {
    let extractedText = "";

    if (mimetype === "application/pdf") {
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
      originalname.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (
      mimetype === "text/plain" || 
      mimetype === "text/markdown" || 
      originalname.endsWith(".txt") || 
      originalname.endsWith(".md")
    ) {
      extractedText = buffer.toString("utf-8");
    } else {
      return res.status(400).json({ message: "Unsupported file type. Use PDF, DOCX, TXT, or MD." });
    }

    // Limit extracted text to ~15,000 characters to prevent crashing local model context window
    const maxTextLength = 15000;
    let isTruncated = false;
    if (extractedText.length > maxTextLength) {
      extractedText = extractedText.substring(0, maxTextLength);
      isTruncated = true;
    }

    return res.status(200).json({
      fileName: originalname,
      fileSize: size,
      mimeType: mimetype,
      extractedText,
      isTruncated,
      charCount: extractedText.length,
    });
  } catch (error) {
    console.error("Error parsing file:", error);
    return res.status(500).json({ message: "Failed to parse document text content" });
  }
};
