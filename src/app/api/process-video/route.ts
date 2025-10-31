import { NextRequest } from "next/server";
import ytdl from "@distube/ytdl-core";
import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { PROMPTS } from "./prompts";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

type Language = "en" | "fr";

// Validate YouTube URL
function isValidYouTubeUrl(url: string): boolean {
  try {
    return ytdl.validateURL(url);
  } catch {
    return false;
  }
}

interface StreamWriter {
  write: (data: {
    status?: { step: number; message: string };
    transcript?: string;
    summary?: string;
  }) => void;
  close: () => void;
  error: (error: Error) => void;
}

// Extract audio from YouTube video
async function extractAudio(
  url: string,
  writer: StreamWriter,
): Promise<Buffer> {
  writer.write({
    status: { step: 1, message: "Connecting to YouTube..." },
  });

  try {
    writer.write({
      status: { step: 1, message: "Fetching video information..." },
    });

    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title;
    const duration = info.videoDetails.lengthSeconds;
    const durationMin = Math.floor(parseInt(duration) / 60);

    writer.write({
      status: { step: 1, message: `Found: "${title}" (${durationMin} min)` },
    });

    writer.write({
      status: { step: 1, message: "Starting audio download..." },
    });

    // Get audio stream with additional options to bypass restrictions
    const audioStream = ytdl(url, {
      quality: "highestaudio",
      filter: "audioonly",
      // Add headers to appear more like a browser
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
    });

    let downloadedBytes = 0;
    const chunks: Buffer[] = [];

    audioStream.on("data", (chunk) => {
      downloadedBytes += chunk.length;
      const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
      writer.write({
        status: { step: 1, message: `Downloading audio... ${downloadedMB}MB` },
      });
      chunks.push(Buffer.from(chunk));
    });

    // Convert stream to buffer with progress
    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      audioStream.on("end", () => {
        const finalBuffer = Buffer.concat(chunks);
        const finalSizeMB = (finalBuffer.length / (1024 * 1024)).toFixed(1);
        writer.write({
          status: {
            step: 1,
            message: `Audio download completed (${finalSizeMB}MB)`,
          },
        });
        resolve(finalBuffer);
      });
      audioStream.on("error", (err) => reject(err));
    });

    return audioBuffer;
  } catch (error) {
    console.error("=== YOUTUBE DOWNLOAD ERROR ===");
    console.error(
      "Error type:",
      error instanceof Error ? error.constructor.name : typeof error,
    );
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    console.error("Video URL:", url);
    console.error("============================");

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Provide helpful error message for common YouTube issues
    if (errorMessage.includes("403")) {
      throw new Error(
        `YouTube blocked the request (403). This video may be restricted or age-gated. Try: 1) A different video, 2) Upload the MP4 file directly instead.`,
      );
    }

    throw new Error(`Failed to download audio: ${errorMessage}`);
  }
}

// Compress audio using FFmpeg to reduce file size
async function compressAudio(
  inputBuffer: Buffer,
  writer: StreamWriter,
): Promise<Buffer> {
  const originalSizeMB = (inputBuffer.length / (1024 * 1024)).toFixed(2);
  writer.write({
    status: {
      step: 2,
      message: `Compressing ${originalSizeMB}MB audio file...`,
    },
  });

  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
    const outputPath = path.join(tempDir, `output_${Date.now()}.ogg`);

    // Write input buffer to temporary file
    fs.writeFile(inputPath, inputBuffer)
      .then(() => {
        writer.write({
          status: { step: 2, message: "Running FFmpeg compression..." },
        });

        ffmpeg(inputPath)
          .audioCodec("libopus")
          .audioBitrate("12k")
          .audioChannels(1)
          .audioFrequency(16000)
          .format("ogg")
          .on("progress", (progress) => {
            if (progress.percent) {
              writer.write({
                status: {
                  step: 2,
                  message: `Compressing audio... ${Math.round(progress.percent)}%`,
                },
              });
            }
          })
          .on("end", async () => {
            try {
              const compressedBuffer = await fs.readFile(outputPath);

              // Clean up temporary files
              await fs.unlink(inputPath).catch(() => {});
              await fs.unlink(outputPath).catch(() => {});

              const compressedSizeMB = (
                compressedBuffer.length /
                (1024 * 1024)
              ).toFixed(2);

              writer.write({
                status: {
                  step: 2,
                  message: `Audio compressed: ${originalSizeMB}MB → ${compressedSizeMB}MB`,
                },
              });

              resolve(compressedBuffer);
            } catch (error) {
              reject(error);
            }
          })
          .on("error", async (error) => {
            // Clean up temporary files on error
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});
            reject(error);
          })
          .save(outputPath);
      })
      .catch(reject);
  });
}

// Stream audio transcription using FFmpeg to create proper audio chunks
async function streamTranscribeAudio(
  audioBuffer: Buffer,
  writer: StreamWriter,
): Promise<string> {
  const totalSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(1);

  writer.write({
    status: {
      step: 3,
      message: `🚀 STREAMING MODE: Processing ${totalSizeMB}MB audio with real-time transcription`,
    },
  });

  try {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `stream_input_${Date.now()}.mp3`);

    // Write the full audio to a temporary file
    await fs.writeFile(inputPath, audioBuffer);

    // Get audio duration using FFmpeg
    const duration = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration || 0);
      });
    });

    const chunkDurationSeconds = 30; // 30-second chunks
    const totalChunks = Math.ceil(duration / chunkDurationSeconds);

    writer.write({
      status: {
        step: 3,
        message: `⏱️ Audio duration: ${Math.floor(duration / 60)}m ${Math.round(duration % 60)}s. Creating ${totalChunks} streaming chunks...`,
      },
    });

    const transcriptResults: {
      index: number;
      text: string;
      startTime: number;
      endTime: number;
    }[] = [];
    let cumulativeTranscript = "";

    // Process chunks sequentially to maintain order and avoid race conditions
    for (let i = 0; i < totalChunks; i++) {
      const startTime = i * chunkDurationSeconds;
      const endTime = Math.min((i + 1) * chunkDurationSeconds, duration);
      const chunkPath = path.join(tempDir, `chunk_${i}_${Date.now()}.wav`);

      writer.write({
        status: {
          step: 3,
          message: `🎵 Creating chunk ${i + 1}/${totalChunks} (${startTime}s-${Math.round(endTime)}s)...`,
        },
      });

      try {
        // Create audio chunk using FFmpeg
        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .seekInput(startTime)
            .duration(chunkDurationSeconds)
            .audioCodec("pcm_s16le")
            .audioFrequency(16000)
            .audioChannels(1)
            .format("wav")
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .save(chunkPath);
        });

        writer.write({
          status: {
            step: 3,
            message: `📤 Transcribing chunk ${i + 1}/${totalChunks}...`,
          },
        });

        // Read the chunk and transcribe it
        const chunkBuffer = await fs.readFile(chunkPath);
        const audioFile = new File([chunkBuffer], `chunk_${i}.wav`, {
          type: "audio/wav",
        });

        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
        });

        const chunkWords = transcription.text.split(" ").length;
        const result = {
          index: i,
          text: transcription.text,
          startTime,
          endTime: Math.round(endTime),
        };

        transcriptResults.push(result);

        writer.write({
          status: {
            step: 3,
            message: `✅ Chunk ${i + 1}/${totalChunks} completed (${chunkWords} words) - "${transcription.text.substring(0, 50)}${transcription.text.length > 50 ? "..." : ""}"`,
          },
        });

        // Stream partial transcript immediately in correct order
        if (transcription.text.trim()) {
          cumulativeTranscript +=
            (cumulativeTranscript ? " " : "") + transcription.text;
          writer.write({ transcript: cumulativeTranscript });
        }

        // Clean up chunk file
        await fs.unlink(chunkPath).catch(() => {});
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
        // Clean up chunk file on error
        await fs.unlink(chunkPath).catch(() => {});

        // Continue with next chunk instead of failing completely
        transcriptResults.push({
          index: i,
          text: "",
          startTime,
          endTime: Math.round(endTime),
        });
      }
    }

    // Clean up input file
    await fs.unlink(inputPath).catch(() => {});

    // Combine all transcripts in order
    const fullTranscript = transcriptResults
      .sort((a, b) => a.index - b.index)
      .map((r) => r.text)
      .filter((t) => t.trim())
      .join(" ");

    const totalWords = fullTranscript.split(" ").length;

    writer.write({
      status: {
        step: 3,
        message: `🎉 Streaming transcription completed! Total: ${totalWords} words from ${totalChunks} chunks`,
      },
    });

    // Send final complete transcript
    writer.write({ transcript: fullTranscript });

    return fullTranscript;
  } catch (error) {
    throw new Error(
      `Failed to stream transcribe audio: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(
  audioBuffer: Buffer,
  writer: StreamWriter,
): Promise<string> {
  const audioSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(1);
  const maxSizeBytes = 25 * 1024 * 1024; // 25MB

  writer.write({
    status: {
      step: 3,
      message: `Starting transcription of ${audioSizeMB}MB audio file...`,
    },
  });

  // Determine processing strategy upfront - prefer streaming for faster results
  const estimatedDuration = Math.ceil(audioBuffer.length / (16000 * 2)); // Rough estimate

  if (estimatedDuration > 60) {
    // For videos longer than 1 minute, use streaming
    writer.write({
      status: {
        step: 3,
        message: `🚀 Video duration ~${Math.floor(estimatedDuration / 60)}m ${estimatedDuration % 60}s - using streaming transcription for faster results`,
      },
    });
    return await streamTranscribeAudio(audioBuffer, writer);
  } else if (audioBuffer.length <= maxSizeBytes) {
    writer.write({
      status: {
        step: 3,
        message: `✅ Short video (${audioSizeMB}MB) - using direct transcription`,
      },
    });
  } else {
    writer.write({
      status: {
        step: 3,
        message: `⚠️ Audio file (${audioSizeMB}MB) exceeds 25MB limit - will try compression first, then streaming if needed`,
      },
    });
  }

  try {
    let processedBuffer = audioBuffer;

    if (audioBuffer.length > maxSizeBytes) {
      writer.write({
        status: {
          step: 2,
          message: `🗜️ Attempting compression to avoid chunking...`,
        },
      });

      try {
        processedBuffer = await compressAudio(audioBuffer, writer);

        // Double-check the compressed size
        if (processedBuffer.length > maxSizeBytes) {
          const compressedSizeMB = (
            processedBuffer.length /
            (1024 * 1024)
          ).toFixed(1);
          writer.write({
            status: {
              step: 3,
              message: `❌ Compression insufficient (${compressedSizeMB}MB still > 25MB) - switching to streaming method`,
            },
          });
          return await streamTranscribeAudio(audioBuffer, writer);
        } else {
          const compressedSizeMB = (
            processedBuffer.length /
            (1024 * 1024)
          ).toFixed(1);
          writer.write({
            status: {
              step: 3,
              message: `✅ Compression successful (${compressedSizeMB}MB) - proceeding with direct transcription`,
            },
          });
        }
      } catch {
        writer.write({
          status: {
            step: 3,
            message: `❌ Audio compression failed - switching to streaming method`,
          },
        });
        return await streamTranscribeAudio(audioBuffer, writer);
      }
    }

    writer.write({
      status: {
        step: 3,
        message: "📤 Sending audio to OpenAI Whisper for transcription...",
      },
    });

    // Create a File-like object from the buffer
    const audioFile = new File([processedBuffer], "audio.mp3", {
      type: "audio/mp3",
    });

    writer.write({
      status: {
        step: 3,
        message:
          "🤖 Whisper is processing the audio (this may take a few minutes)...",
      },
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      // Remove language parameter to enable auto-detection
    });

    const transcriptLength = transcription.text.length;
    const wordCount = transcription.text.split(" ").length;

    writer.write({
      status: {
        step: 3,
        message: `✅ Direct transcription completed! Generated ${wordCount} words (${transcriptLength} characters)`,
      },
    });

    return transcription.text;
  } catch (error) {
    console.error("=== TRANSCRIPTION ERROR ===");
    console.error(
      "Error type:",
      error instanceof Error ? error.constructor.name : typeof error,
    );
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    console.error(
      "Audio buffer size:",
      audioBuffer.length,
      "bytes",
      `(${(audioBuffer.length / (1024 * 1024)).toFixed(2)}MB)`,
    );
    console.error("========================");

    // If all else fails, try streaming as last resort
    if (error instanceof Error && error.message.includes("413")) {
      writer.write({
        status: {
          step: 3,
          message:
            "❌ File still too large for Whisper API - switching to streaming method as fallback",
        },
      });
      return await streamTranscribeAudio(audioBuffer, writer);
    }
    throw new Error(
      `Failed to transcribe audio: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Translate text in chunks to handle long content
async function translateTextInChunks(
  text: string,
  targetLanguage: "en" | "fr",
  writer: StreamWriter,
): Promise<string> {
  const languageName = targetLanguage === "en" ? "English" : "French";

  // Split text into sentences for better chunking
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = "";
  const maxChunkLength = 3000; // Conservative limit for tokens

  writer.write({
    status: { step: 4, message: `Preparing translation to ${languageName}...` },
  });

  // Group sentences into chunks
  for (const sentence of sentences) {
    if (
      (currentChunk + sentence).length > maxChunkLength &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ". " : "") + sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  writer.write({
    status: {
      step: 4,
      message: `Translating ${chunks.length} text segments to ${languageName}...`,
    },
  });

  const translatedChunks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    writer.write({
      status: {
        step: 4,
        message: `Translating segment ${i + 1}/${chunks.length} to ${languageName}...`,
      },
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: PROMPTS.translation.system(languageName),
          },
          {
            role: "user",
            content: chunks[i],
          },
        ],
        max_tokens: 1500,
        temperature: 0.1,
      });

      const translation = response.choices[0]?.message?.content || chunks[i];
      translatedChunks.push(translation);
    } catch (error) {
      console.error(`Translation error for chunk ${i + 1}:`, error);
      // Fallback to original text if translation fails
      translatedChunks.push(chunks[i]);
    }
  }

  writer.write({
    status: { step: 4, message: `Translation to ${languageName} completed` },
  });

  return translatedChunks.join(". ");
}

// Translate text using OpenAI
async function translateText(
  text: string,
  targetLanguage: "en" | "fr",
  writer: StreamWriter,
): Promise<string> {
  // Check if text is too long for single request
  if (text.length > 3000) {
    return await translateTextInChunks(text, targetLanguage, writer);
  }

  const languageName = targetLanguage === "en" ? "English" : "French";
  writer.write({
    status: { step: 4, message: `Translating to ${languageName}...` },
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: PROMPTS.translation.system(languageName),
        },
        {
          role: "user",
          content: text,
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const translation =
      response.choices[0]?.message?.content || "Failed to translate";

    writer.write({
      status: { step: 4, message: `Translation to ${languageName} completed` },
    });

    return translation;
  } catch (error) {
    throw new Error(
      `Failed to translate text: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Summarize text in chunks for long content
async function summarizeTextInChunks(
  text: string,
  writer: StreamWriter,
  language: Language,
): Promise<string> {
  const languageName = language === "en" ? "English" : "French";

  // Split text into chunks
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = "";
  const maxChunkLength = 3000;

  writer.write({
    status: { step: 5, message: `Preparing ${languageName} summary...` },
  });

  // Group sentences into chunks
  for (const sentence of sentences) {
    if (
      (currentChunk + sentence).length > maxChunkLength &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ". " : "") + sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  writer.write({
    status: {
      step: 5,
      message: `Creating summaries for ${chunks.length} text segments...`,
    },
  });

  const summaries: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    writer.write({
      status: {
        step: 5,
        message: `Summarizing segment ${i + 1}/${chunks.length}...`,
      },
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: PROMPTS.chunkSummary.system[language],
          },
          {
            role: "user",
            content: PROMPTS.chunkSummary.user[language](chunks[i]),
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      const summary =
        response.choices[0]?.message?.content ||
        `Segment ${i + 1} summary unavailable`;
      summaries.push(summary);
    } catch (error) {
      console.error(`Summary error for chunk ${i + 1}:`, error);
      summaries.push(`Segment ${i + 1}: ${chunks[i].substring(0, 200)}...`);
    }
  }

  // Create final consolidated summary
  writer.write({
    status: { step: 5, message: `Creating final consolidated summary...` },
  });

  const consolidatedText = summaries.join("\n\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: PROMPTS.finalSummary.system[language],
        },
        {
          role: "user",
          content: PROMPTS.finalSummary.user[language](consolidatedText),
        },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const finalSummary =
      response.choices[0]?.message?.content || consolidatedText;

    writer.write({
      status: { step: 5, message: "Summary completed successfully!" },
    });

    return finalSummary;
  } catch (error) {
    console.error("Final summary error:", error);
    return consolidatedText;
  }
}

// Summarize text using OpenAI GPT
async function summarizeText(
  text: string,
  writer: StreamWriter,
  language: Language,
): Promise<string> {
  // Check if text is too long for single request
  if (text.length > 3000) {
    return await summarizeTextInChunks(text, writer, language);
  }

  const languageName = language === "en" ? "English" : "French";
  writer.write({
    status: { step: 5, message: `Generating AI summary in ${languageName}...` },
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: PROMPTS.summary.system[language],
        },
        {
          role: "user",
          content: PROMPTS.summary.user[language](text),
        },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const summary =
      response.choices[0]?.message?.content || "Failed to generate summary";

    writer.write({
      status: { step: 5, message: "Summary completed successfully!" },
    });

    return summary;
  } catch (error) {
    throw new Error(
      `Failed to generate summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Translate transcript to desired recap language if needed
async function translateIfNeeded(
  text: string,
  recapLanguage: Language,
  writer: StreamWriter,
): Promise<string> {
  const textLength = text.length;
  const wordCount = text.split(" ").length;

  writer.write({
    status: {
      step: 4,
      message: `Analyzing transcript language (${wordCount} words, ${textLength} characters)...`,
    },
  });

  // Simple language detection - check if text contains mostly non-ASCII characters for French
  // or use common French words as indicators
  const frenchIndicators =
    /\b(le|la|les|de|du|des|et|est|une|un|dans|pour|avec|sur|par|ce|cette|qui|que|mais|ou|où|donc|car|si|comme|tout|tous|toute|toutes|très|plus|moins|bien|encore|aussi|déjà|jamais|toujours|peut|peuvent|faire|avoir|être|aller|venir|voir|savoir|dire|prendre|donner|partir|sortir|entrer|monter|descendre)\b/gi;

  const frenchMatches = text.match(frenchIndicators);
  const isFrench = frenchMatches && frenchMatches.length > 10; // Threshold for French detection

  const detectedLanguage = isFrench ? "French" : "English";
  const targetLanguage = recapLanguage === "en" ? "English" : "French";

  writer.write({
    status: {
      step: 4,
      message: `Detected language: ${detectedLanguage}. Target recap language: ${targetLanguage}`,
    },
  });

  // If transcript appears to be in French and user wants English recap, translate
  if (isFrench && recapLanguage === "en") {
    writer.write({
      status: {
        step: 4,
        message:
          "Translation needed: French → English. Starting translation...",
      },
    });
    return await translateText(text, "en", writer);
  }

  // If transcript appears to be in English and user wants French recap, translate
  if (!isFrench && recapLanguage === "fr") {
    writer.write({
      status: {
        step: 4,
        message:
          "Translation needed: English → French. Starting translation...",
      },
    });
    return await translateText(text, "fr", writer);
  }

  // No translation needed
  writer.write({
    status: {
      step: 4,
      message: `No translation needed - transcript and recap are both in ${targetLanguage}`,
    },
  });

  return text;
}

// Extract audio from uploaded MP4 file
async function extractAudioFromFile(
  fileBuffer: Buffer,
  writer: StreamWriter,
): Promise<Buffer> {
  writer.write({
    status: { step: 1, message: "Processing uploaded video file..." },
  });

  try {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `upload_${Date.now()}.mp4`);
    const outputPath = path.join(tempDir, `audio_${Date.now()}.mp3`);

    // Write uploaded file to temp location
    await fs.writeFile(inputPath, fileBuffer);

    const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(1);
    writer.write({
      status: {
        step: 1,
        message: `Extracting audio from ${fileSizeMB}MB video file...`,
      },
    });

    // Extract audio using FFmpeg (using mp3 for better Whisper API compatibility)
    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      ffmpeg(inputPath)
        .audioCodec("libmp3lame")
        .audioBitrate("32k")
        .audioChannels(1)
        .audioFrequency(16000)
        .format("mp3")
        .on("progress", (progress) => {
          if (progress.percent) {
            writer.write({
              status: {
                step: 1,
                message: `Extracting audio... ${Math.round(progress.percent)}%`,
              },
            });
          }
        })
        .on("end", async () => {
          try {
            const extractedBuffer = await fs.readFile(outputPath);
            const extractedSizeMB = (
              extractedBuffer.length /
              (1024 * 1024)
            ).toFixed(1);

            writer.write({
              status: {
                step: 1,
                message: `Audio extraction completed (${extractedSizeMB}MB)`,
              },
            });

            // Clean up temp files
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});

            resolve(extractedBuffer);
          } catch (error) {
            reject(error);
          }
        })
        .on("error", async (error) => {
          // Clean up temp files on error
          await fs.unlink(inputPath).catch(() => {});
          await fs.unlink(outputPath).catch(() => {});
          reject(error);
        })
        .save(outputPath);
    });

    return audioBuffer;
  } catch (error) {
    throw new Error(
      `Failed to extract audio from file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function POST(request: NextRequest) {
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.",
      },
      { status: 500 },
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let url: string | null = null;
    let recapLanguage: Language = "en";
    let uploadedFile: Buffer | null = null;

    // Handle both JSON (YouTube URL) and FormData (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      recapLanguage = (formData.get("recapLanguage") as Language) || "en";

      if (!file) {
        return Response.json(
          { error: "Video file is required" },
          { status: 400 },
        );
      }

      if (!file.type.includes("mp4")) {
        return Response.json(
          { error: "Only MP4 files are supported" },
          { status: 400 },
        );
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      uploadedFile = Buffer.from(arrayBuffer);
    } else {
      const body = await request.json();
      url = body.url;
      recapLanguage = body.recapLanguage || "en";

      if (!url) {
        return Response.json(
          { error: "YouTube URL is required" },
          { status: 400 },
        );
      }

      if (!isValidYouTubeUrl(url)) {
        return Response.json({ error: "Invalid YouTube URL" }, { status: 400 });
      }
    }

    // Create streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const writer: StreamWriter = {
          write: (data: {
            status?: { step: number; message: string };
            transcript?: string;
            summary?: string;
          }) => {
            const chunk = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          },
          close: () => {
            controller.close();
          },
          error: (error: Error) => {
            const errorChunk = `data: ${JSON.stringify({ error: error.message })}\n\n`;
            controller.enqueue(encoder.encode(errorChunk));
            controller.close();
          },
        };

        try {
          // Step 1: Extract audio (from YouTube or uploaded file)
          let audioBuffer: Buffer;
          if (uploadedFile) {
            audioBuffer = await extractAudioFromFile(uploadedFile, writer);
          } else if (url) {
            audioBuffer = await extractAudio(url, writer);
          } else {
            throw new Error("No video source provided");
          }

          // Step 2-3: Transcribe audio (with auto language detection)
          let transcript = await transcribeAudio(audioBuffer, writer);

          // Step 4: Translate if needed based on recap language preference
          transcript = await translateIfNeeded(
            transcript,
            recapLanguage,
            writer,
          );

          writer.write({ transcript });

          writer.write({
            status: {
              step: 4,
              message: "✅ Transcript completed! Now generating summary...",
            },
          });

          // Step 5: Summarize transcript in the desired language
          const summary = await summarizeText(
            transcript,
            writer,
            recapLanguage,
          );
          writer.write({ summary });

          writer.close();
        } catch (error) {
          console.error("=== PROCESSING ERROR ===");
          console.error(
            "Error type:",
            error instanceof Error ? error.constructor.name : typeof error,
          );
          console.error(
            "Error message:",
            error instanceof Error ? error.message : String(error),
          );
          console.error(
            "Error stack:",
            error instanceof Error ? error.stack : "No stack trace",
          );
          console.error("Full error object:", JSON.stringify(error, null, 2));
          console.error("======================");

          writer.error(
            error instanceof Error
              ? error
              : new Error("Unknown error occurred"),
          );
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
