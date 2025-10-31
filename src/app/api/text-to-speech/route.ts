import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Initialize ElevenLabs client (lazy initialization to avoid build-time errors)
    const elevenlabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });

    // Parse request body
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const voices = await elevenlabs.voices.getAll();

    console.log(voices);
    // Call ElevenLabs API to generate audio
    // Using a verified voice ID and including output format
    // Joanne 97OoEiQZYqTZBKfi4spD
    // Daniel onwK4e9ZLuTAKqWW03F9
    const audio = await elevenlabs.textToSpeech.convert(
      "97OoEiQZYqTZBKfi4spD",
      {
        text: text,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
      },
    );

    // Stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of audio) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    // Return the audio as a response
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("Text-to-speech API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process speech";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
