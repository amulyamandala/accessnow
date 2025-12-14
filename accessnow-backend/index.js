// backend entry 
// index.js - Backend for AccessNow using Google Gemini

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();
console.log('GEMINI_API_KEY from env:', process.env.GEMINI_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Simple health check
app.get('/', (req, res) => {
  res.send('AccessNow Gemini backend is running');
});

// Summarization endpoint
app.post('/summarize', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Limit the text length to avoid huge requests
    const trimmed = text.slice(0, 8000);

    const prompt = `
You are an accessibility assistant. Summarize the following web page content in 5 short bullet points. 
Use simple English, suitable for students, and avoid technical jargon.

TEXT:
${trimmed}
`;

const url =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
  GEMINI_API_KEY;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', errText);
      return res.status(500).json({ error: 'Gemini API error' });
    }

    const data = await response.json();
    const summary =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    res.json({ summary });
  } catch (err) {
    console.error('Summarize error:', err);
    res.status(500).json({ error: 'Summarization failed' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('AccessNow Gemini backend running on port', PORT);
});



