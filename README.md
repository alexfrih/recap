# YouTube Video Recap

Transform any YouTube video into a concise, AI-powered summary using OpenAI's Whisper and GPT models.

## Features

- 🎥 **YouTube Audio Extraction**: Automatically downloads and processes audio from YouTube videos
- 🎙️ **AI Transcription**: Uses OpenAI's Whisper API to convert speech to text with high accuracy
- ✨ **Smart Summaries**: Generates concise, structured summaries highlighting key insights
- 🚀 **Real-time Processing**: Streaming updates show progress through each step
- 📱 **Modern UI**: Beautiful, responsive interface built with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, OpenAI API
- **Audio Processing**: ytdl-core for YouTube audio extraction
- **Deployment**: Optimized for Vercel

## Prerequisites

- Node.js 18+
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Setup

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd recap
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.example .env.local
   ```

   Edit `.env.local` and add your OpenAI API key:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. Paste a YouTube video URL into the input field
2. Click "Generate Recap" to start processing
3. Watch real-time progress updates as the system:
   - Downloads audio from the video
   - Transcribes the audio using OpenAI Whisper
   - Generates an AI summary using GPT-3.5-turbo
4. View both the full transcript and concise summary

## Deployment on Vercel

This application is optimized for Vercel deployment:

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**

   - Connect your GitHub repository to Vercel
   - Add your `OPENAI_API_KEY` environment variable in Vercel dashboard
   - Deploy!

3. **Environment Variables in Vercel**
   - Go to your project settings in Vercel
   - Add `OPENAI_API_KEY` with your OpenAI API key

## API Endpoints

### POST /api/process-video

Processes a YouTube video and returns streaming updates.

**Request Body:**

```json
{
	"url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:** Server-Sent Events (SSE) stream with:

- Status updates for each processing step
- Full transcript when transcription completes
- AI-generated summary when processing finishes

## Limitations

- **Video Length**: Longer videos may hit OpenAI API limits or timeout
- **Languages**: Currently optimized for English content
- **File Size**: Large audio files may exceed serverless function limits

## Cost Considerations

This application uses OpenAI's paid APIs:

- **Whisper API**: ~$0.006 per minute of audio
- **GPT-3.5-turbo**: ~$0.002 per 1K tokens

A typical 10-minute video costs approximately $0.06-0.10 to process.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

If you encounter issues:

1. Check that your OpenAI API key is valid and has sufficient credits
2. Ensure the YouTube URL is accessible and not restricted
3. Check the browser console for detailed error messages

For additional help, please open an issue on GitHub.
