import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(request: NextRequest) {
	// Check for OpenAI API key
	if (!process.env.OPENAI_API_KEY) {
		return NextResponse.json(
			{ error: 'OpenAI API key not configured.' },
			{ status: 500 }
		);
	}

	try {
		const { message, context, transcript } = await request.json();

		if (!message?.trim()) {
			return NextResponse.json(
				{ error: 'Message is required' },
				{ status: 400 }
			);
		}

		// Create a context-aware prompt
		const systemPrompt = `You are an AI assistant helping users understand a YouTube video. You have access to the video's transcript and summary.

CONTEXT:
Summary: ${context || 'No summary available'}

Transcript: ${transcript ? transcript.substring(0, 2000) + '...' : 'No transcript available'}

Please answer the user's question based on this video content. Be helpful, accurate, and reference specific parts of the content when relevant. Keep responses concise but informative.`;

		const completion = await openai.chat.completions.create({
			model: 'gpt-3.5-turbo',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: message }
			],
			temperature: 0.7,
			max_tokens: 500,
		});

		const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

		return NextResponse.json({ response });

	} catch (error) {
		console.error('Chat API error:', error);
		return NextResponse.json(
			{ error: 'Failed to process chat message' },
			{ status: 500 }
		);
	}
}