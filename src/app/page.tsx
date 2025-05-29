'use client';

import { useState, useEffect } from 'react';
import { Download, FileText, Sparkles, AlertCircle, CheckCircle, Loader2, Languages, Copy, Check, Play, Pause } from 'lucide-react';

interface ProcessingStatus {
	step: number;
	message: string;
	isError?: boolean;
}

type Language = 'en' | 'fr';

export default function Home() {
	const [url, setUrl] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [status, setStatus] = useState<ProcessingStatus | null>(null);
	const [transcript, setTranscript] = useState('');
	const [summary, setSummary] = useState('');
	const [recapLanguage, setRecapLanguage] = useState<Language>('en');
	const [copiedTranscript, setCopiedTranscript] = useState(false);
	const [copiedSummary, setCopiedSummary] = useState(false);
	const [startTime, setStartTime] = useState<number | null>(null);
	const [elapsedTime, setElapsedTime] = useState<number>(0);
	const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

	// Update elapsed time every second while processing
	useEffect(() => {
		let interval: NodeJS.Timeout;
		if (startTime && isProcessing) {
			interval = setInterval(() => {
				setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
			}, 1000);
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	}, [startTime, isProcessing]);

	const formatElapsedTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!url.trim()) return;

		setIsProcessing(true);
		setStatus({ step: 1, message: 'Starting process...' });
		setTranscript('');
		setSummary('');
		setStartTime(Date.now());
		setElapsedTime(0);
		// Reset audio state
		if (audioElement) {
			audioElement.pause();
			setAudioElement(null);
		}
		if (audioUrl) {
			URL.revokeObjectURL(audioUrl);
			setAudioUrl(null);
		}
		setIsPlaying(false);
		setIsGeneratingAudio(false);

		try {
			const response = await fetch('/api/process-video', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					url,
					recapLanguage
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const reader = response.body?.getReader();
			if (!reader) throw new Error('No response body');

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = new TextDecoder().decode(value);
				const lines = chunk.split('\n').filter(line => line.trim());

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const data = JSON.parse(line.slice(6));

							if (data.status) {
								setStatus(data.status);
							}

							if (data.transcript) {
								setTranscript(data.transcript);
							}

							if (data.summary) {
								setSummary(data.summary);
							}

							if (data.error) {
								setStatus({ step: 0, message: data.error, isError: true });
							}
						} catch (e) {
							console.error('Error parsing SSE data:', e);
						}
					}
				}
			}
		} catch (error) {
			console.error('Error:', error);
			setStatus({
				step: 0,
				message: error instanceof Error ? error.message : 'An unexpected error occurred',
				isError: true
			});
		} finally {
			setIsProcessing(false);
			setStartTime(null);
		}
	};

	const isValidYouTubeUrl = (url: string) => {
		const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/;
		return youtubeRegex.test(url);
	};

	const copyToClipboard = async (text: string, type: 'transcript' | 'summary') => {
		try {
			await navigator.clipboard.writeText(text);
			if (type === 'transcript') {
				setCopiedTranscript(true);
				setTimeout(() => setCopiedTranscript(false), 2000);
			} else {
				setCopiedSummary(true);
				setTimeout(() => setCopiedSummary(false), 2000);
			}
		} catch (err) {
			console.error('Failed to copy text: ', err);
		}
	};

	const generateAndPlayAudio = async () => {
		if (!summary) return;

		setIsGeneratingAudio(true);
		try {
			const response = await fetch('/api/text-to-speech', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ text: summary }),
			});

			if (!response.ok) {
				throw new Error('Failed to generate audio');
			}

			const audioBlob = await response.blob();
			const url = URL.createObjectURL(audioBlob);
			setAudioUrl(url);

			// Create and setup audio element
			const audio = new Audio(url);
			audio.onended = () => setIsPlaying(false);
			audio.onpause = () => setIsPlaying(false);
			audio.onplay = () => setIsPlaying(true);

			setAudioElement(audio);

			// Start playing
			await audio.play();
			setIsPlaying(true);
		} catch (error) {
			console.error('Error generating audio:', error);
		} finally {
			setIsGeneratingAudio(false);
		}
	};

	const togglePlayback = async () => {
		if (!audioElement) {
			await generateAndPlayAudio();
			return;
		}

		if (isPlaying) {
			audioElement.pause();
		} else {
			await audioElement.play();
		}
	};

	// Cleanup audio URL when component unmounts or audio changes
	useEffect(() => {
		return () => {
			if (audioUrl) {
				URL.revokeObjectURL(audioUrl);
			}
		};
	}, [audioUrl]);

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto">
					{/* Header */}
					<div className="text-center mb-8">
						<h1 className="text-4xl font-bold text-gray-900 mb-4">
							Summarize any YouTube video in seconds.
						</h1>
						<p className="text-lg text-gray-600">
							Paste a link. Get a transcript, AI summary, and audio recap. No more wasted time.
						</p>
						<p className="text-sm text-gray-500 mt-2">
							✨ Supports large videos with automatic compression and chunking
						</p>
					</div>

					{/* Main Form */}
					<div className="bg-white rounded-xl shadow-lg p-6 mb-8">
						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
									YouTube Video URL
								</label>
								<input
									type="url"
									id="url"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									placeholder="https://www.youtube.com/watch?v=..."
									className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									disabled={isProcessing}
									required
								/>
								{url && !isValidYouTubeUrl(url) && (
									<p className="mt-1 text-sm text-red-600">
										Please enter a valid YouTube URL
									</p>
								)}
							</div>

							{/* Recap Language Selection */}
							<div>
								<label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
									<Languages className="w-4 h-4 inline mr-1" />
									Recap Language
								</label>
								<select
									id="language"
									value={recapLanguage}
									onChange={(e) => setRecapLanguage(e.target.value as Language)}
									className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									disabled={isProcessing}
								>
									<option value="en">English</option>
									<option value="fr">French</option>
								</select>
								<p className="mt-1 text-sm text-gray-500">
									Audio language will be automatically detected
								</p>
							</div>

							<button
								type="submit"
								disabled={isProcessing || !url || !isValidYouTubeUrl(url)}
								className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
							>
								{isProcessing ? (
									<>
										<Loader2 className="w-5 h-5 animate-spin" />
										<span>Processing...</span>
									</>
								) : (
									<>
										<Sparkles className="w-5 h-5" />
										<span>Get your first recap</span>
									</>
								)}
							</button>
						</form>
					</div>

					{/* Status */}
					{status && (
						<div className={`bg-white rounded-xl shadow-lg p-6 mb-8 border-l-4 ${status.isError ? 'border-red-500' : 'border-blue-500'
							}`}>
							<div className="flex items-center space-x-3">
								{status.isError ? (
									<AlertCircle className="w-6 h-6 text-red-500" />
								) : status.step === 5 ? (
									<CheckCircle className="w-6 h-6 text-green-500" />
								) : (
									<Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
								)}
								<div className="flex-1">
									<div className="flex items-center justify-between">
										<p className={`font-medium ${status.isError ? 'text-red-700' : 'text-gray-900'
											}`}>
											{status.isError ? 'Error' : `Step ${status.step}`}
										</p>
										{isProcessing && elapsedTime > 0 && (
											<span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
												{formatElapsedTime(elapsedTime)}
											</span>
										)}
									</div>
									<p className={`text-sm ${status.isError ? 'text-red-600' : 'text-gray-600'
										}`}>
										{status.message}
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Results */}
					<div className="grid md:grid-cols-2 gap-8">
						{/* Transcript */}
						{transcript && (
							<div className="bg-white rounded-xl shadow-lg p-6">
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center space-x-2">
										<FileText className="w-5 h-5 text-gray-600" />
										<h2 className="text-xl font-semibold text-gray-900">Transcript</h2>
									</div>
									<button
										onClick={() => copyToClipboard(transcript, 'transcript')}
										className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
									>
										{copiedTranscript ? (
											<>
												<Check className="w-4 h-4 text-green-600" />
												<span className="text-green-600">Copied!</span>
											</>
										) : (
											<>
												<Copy className="w-4 h-4" />
												<span>Copy</span>
											</>
										)}
									</button>
								</div>
								<div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
									<p className="text-sm text-gray-700 whitespace-pre-wrap">
										{transcript}
									</p>
								</div>
							</div>
						)}

						{/* Summary */}
						{summary && (
							<div className="bg-white rounded-xl shadow-lg p-6">
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center space-x-2">
										<Sparkles className="w-5 h-5 text-blue-600" />
										<h2 className="text-xl font-semibold text-gray-900">AI Summary</h2>
									</div>
									<div className="flex items-center space-x-2">
										<button
											onClick={togglePlayback}
											disabled={isGeneratingAudio}
											className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
										>
											{isGeneratingAudio ? (
												<>
													<Loader2 className="w-4 h-4 animate-spin" />
													<span>Generating...</span>
												</>
											) : isPlaying ? (
												<>
													<Pause className="w-4 h-4" />
													<span>Pause</span>
												</>
											) : (
												<>
													<Play className="w-4 h-4" />
													<span>Play</span>
												</>
											)}
										</button>
										<button
											onClick={() => copyToClipboard(summary, 'summary')}
											className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
										>
											{copiedSummary ? (
												<>
													<Check className="w-4 h-4 text-green-600" />
													<span className="text-green-600">Copied!</span>
												</>
											) : (
												<>
													<Copy className="w-4 h-4" />
													<span>Copy</span>
												</>
											)}
										</button>
									</div>
								</div>
								<div className="bg-blue-50 rounded-lg p-4">
									<p className="text-sm text-gray-700 whitespace-pre-wrap">
										{summary}
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Features */}
					<div className="mt-12 grid md:grid-cols-4 gap-6">
						<div className="text-center p-6">
							<Download className="w-8 h-8 text-blue-600 mx-auto mb-3" />
							<h3 className="font-semibold text-gray-900 mb-2">Smart Audio Processing</h3>
							<p className="text-sm text-gray-600">
								Handles videos of any length with automatic compression and chunking
							</p>
						</div>
						<div className="text-center p-6">
							<FileText className="w-8 h-8 text-blue-600 mx-auto mb-3" />
							<h3 className="font-semibold text-gray-900 mb-2">AI Transcription</h3>
							<p className="text-sm text-gray-600">
								Auto-detects language and converts speech to text with high accuracy
							</p>
						</div>
						<div className="text-center p-6">
							<Languages className="w-8 h-8 text-blue-600 mx-auto mb-3" />
							<h3 className="font-semibold text-gray-900 mb-2">Translation</h3>
							<p className="text-sm text-gray-600">
								Translate transcripts between English and French with AI precision
							</p>
						</div>
						<div className="text-center p-6">
							<Sparkles className="w-8 h-8 text-blue-600 mx-auto mb-3" />
							<h3 className="font-semibold text-gray-900 mb-2">Smart Summaries</h3>
							<p className="text-sm text-gray-600">
								Generates concise, structured summaries highlighting key insights
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
