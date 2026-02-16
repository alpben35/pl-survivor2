
// geminiService.ts

import { GoogleGenAI, Type } from "@google/genai";
import { Coupon, Team, PLData, LeagueTableEntry, Fixture, TeamStatus, TeamForm } from "./types";
import { PREMIER_LEAGUE_TEAMS } from "./constants";

// Helper function to extract potential JSON content from model text output
const extractJsonFromText = (text: string): any => {
  const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Extraction JSON Parse Error:", e);
      return null;
    }
  }
  return null;
};

/**
 * Exponential backoff utility for handling rate limits (429) and transient server errors (500/RPC)
 */
const callWithRetry = async (fn: () => Promise<any>, maxRetries = 5, initialDelay = 3000): Promise<any> => {
  let delay = initialDelay;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = error?.message || (typeof error === 'string' ? error : "");
      
      // Check for retryable errors: 429 (Rate Limit), 500 (Internal Error), RPC/XHR failures
      const isRetryable = 
        errorMsg.includes('429') || 
        errorMsg.includes('500') ||
        errorMsg.includes('RESOURCE_EXHAUSTED') || 
        errorMsg.includes('Rpc failed') ||
        errorMsg.includes('xhr error') ||
        error?.status === 429 || 
        error?.status === 500 ||
        error?.error?.code === 429 ||
        error?.error?.code === 500 ||
        error?.error?.code === 6; // Error code 6 is often associated with RPC/Proxy failures

      if (isRetryable && i < maxRetries - 1) {
        console.warn(`Gemini API error (retryable). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
};

export const getStandingsViaSearch = async (): Promise<{ table: LeagueTableEntry[], sources: { title: string, uri: string }[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = "Retrieve the current 2024/25 English Premier League standings. I need the full table: position, team name, played, won, drawn, lost, goal difference, and total points for all 20 teams. Please return the data as a raw JSON array of objects.";

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    }));

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title || "Source",
        uri: chunk.web.uri
      }));

    const text = response.text?.trim() || "";
    const table = extractJsonFromText(text) || [];
    
    return { table, sources };
  } catch (error) {
    console.error("Standings Search Error:", error);
    return { table: [], sources: [] };
  }
};

export const getFormViaSearch = async (): Promise<{ form: Partial<TeamForm>[], sources: { title: string, uri: string }[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Find the current form for all 20 Premier League teams in the 2024/25 season. 
    For each team, I need a JSON object with: 
    1. teamName (string)
    2. last5 (array of 'W', 'D', or 'L')
    3. goalsFor (number)
    4. goalsAgainst (number)
    Return the results as a raw JSON array.`;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    }));

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title || "Source",
        uri: chunk.web.uri
      }));

    const text = response.text?.trim() || "";
    const form = extractJsonFromText(text) || [];
    
    return { form, sources };
  } catch (error) {
    console.error("Form Search Error:", error);
    return { form: [], sources: [] };
  }
};

export const getScoutAdvice = async (
  currentWeek: number,
  coupon: Coupon,
  availableTeams: Team[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const usedTeams = coupon.picks.filter(p => p.week < currentWeek).map(p => {
    const t = PREMIER_LEAGUE_TEAMS.find(team => team.id === p.teamId);
    return t ? t.name : p.teamId;
  }).join(', ');
  const availableNames = availableTeams.map(t => t.name).join(', ');

  const prompt = `
    Context: Premier League Survivor Pool (Last Man Standing).
    User must pick 1 team to WIN each week. Cannot reuse teams.
    Current Week: ${currentWeek}
    Previously Used: ${usedTeams || 'None'}
    Options for this week: ${availableNames}

    Role: Expert Football Scout.
    Task: Provide a tactical pick for this week (Safe vs Value). Be concise (under 50 words).
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    }));
    return response.text || "Scouting report delayed...";
  } catch (error) {
    return "Trust your manager's intuition today.";
  }
};

export const analyzeSportsImage = async (base64Image: string): Promise<Partial<PLData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = "Extract Premier League table and results from this image.";

  try {
    const mimeType = base64Image.match(/data:(.*?);/)?.[1] || "image/jpeg";
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            table: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  position: { type: Type.NUMBER },
                  team: { type: Type.STRING },
                  played: { type: Type.NUMBER },
                  points: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    }));

    const jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("Analysis failed");
    const parsed = JSON.parse(jsonStr);

    return {
      table: (parsed.table || []),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    throw new Error("Image processing failed.");
  }
};
