"use client";

import { useState, useEffect } from "react";
import {
  Download,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Loader2,
  Languages,
  Copy,
  Check,
  Play,
  Pause,
  MessageSquare,
  Send,
  X,
  Maximize2,
  Minimize2,
  Video,
} from "lucide-react";

interface ProcessingStatus {
  step: number;
  message: string;
  isError?: boolean;
}

interface StepTracking {
  stepNumber: number;
  label: string;
  status: "pending" | "in-progress" | "completed" | "error";
  startTime?: number;
  endTime?: number;
  duration?: number;
}

type Language = "en" | "fr";

export default function Home() {
  const [url, setUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [recapLanguage, setRecapLanguage] = useState<Language>("en");
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [stepTracking, setStepTracking] = useState<StepTracking[]>([
    { stepNumber: 1, label: "Extract Audio", status: "pending" },
    { stepNumber: 2, label: "Compress Audio", status: "pending" },
    { stepNumber: 3, label: "Transcribe Audio", status: "pending" },
    { stepNumber: 4, label: "Translate Text", status: "pending" },
    { stepNumber: 5, label: "Generate Summary", status: "pending" },
  ]);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );

  // New UI state
  const [videoInfo, setVideoInfo] = useState<{
    title: string;
    thumbnail: string;
    duration: string;
  } | null>(null);
  const [currentPanel, setCurrentPanel] = useState<
    "input" | "processing" | "results"
  >("input");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Video upload state
  const [inputMode, setInputMode] = useState<"url" | "file">("url");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Update elapsed time every second while processing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (startTime && isProcessing) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));

        // Force re-render to update in-progress step durations
        setStepTracking((prev) => [...prev]);
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

  const fetchVideoInfo = async (videoUrl: string) => {
    try {
      // Extract video ID from URL
      const videoId = videoUrl.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      )?.[1];
      if (!videoId) return null;

      // Use YouTube oEmbed API to get basic info
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      );
      if (response.ok) {
        const data = await response.json();
        setVideoInfo({
          title: data.title || "Unknown Title",
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          duration: "Duration unknown",
        });
      }
    } catch (error) {
      console.error("Failed to fetch video info:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMode === "url" && !url.trim()) return;
    if (inputMode === "file" && !uploadedFile) return;

    // Switch to processing panel
    setCurrentPanel("processing");
    setIsProcessing(true);
    setStatus({ step: 1, message: "Starting process..." });
    setTranscript("");
    setSummary("");
    setShowTranscript(false);
    setStartTime(Date.now());
    setElapsedTime(0);
    // Reset step tracking
    setStepTracking([
      { stepNumber: 1, label: "Extract Audio", status: "pending" },
      { stepNumber: 2, label: "Compress Audio", status: "pending" },
      { stepNumber: 3, label: "Transcribe Audio", status: "pending" },
      { stepNumber: 4, label: "Translate Text", status: "pending" },
      { stepNumber: 5, label: "Generate Summary", status: "pending" },
    ]);
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
      let response;

      if (inputMode === "file" && uploadedFile) {
        // Upload file first
        const formData = new FormData();
        formData.append("file", uploadedFile);
        formData.append("recapLanguage", recapLanguage);

        response = await fetch("/api/process-video", {
          method: "POST",
          body: formData,
        });
      } else {
        // Use YouTube URL
        response = await fetch("/api/process-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            recapLanguage,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.status) {
                setStatus(data.status);

                // Update step tracking
                if (data.status.step) {
                  setStepTracking((prev) => {
                    const updated = [...prev];
                    const currentStepIndex = updated.findIndex(
                      (s) => s.stepNumber === data.status.step,
                    );

                    if (currentStepIndex !== -1) {
                      const currentStep = updated[currentStepIndex];
                      const now = Date.now();

                      // Mark previous steps as completed if not already
                      for (let i = 0; i < currentStepIndex; i++) {
                        if (
                          updated[i].status !== "completed" &&
                          updated[i].status !== "error"
                        ) {
                          if (!updated[i].endTime && updated[i].startTime) {
                            const startTime = updated[i].startTime!;
                            updated[i].endTime = now;
                            updated[i].duration = Math.floor(
                              (now - startTime) / 1000,
                            );
                          }
                          updated[i].status = "completed";
                        }
                      }

                      // Update current step
                      if (currentStep.status === "pending") {
                        currentStep.status = "in-progress";
                        currentStep.startTime = now;
                      }

                      // Check if step is completed
                      if (
                        data.status.message.includes("completed") ||
                        data.status.message.includes("✅") ||
                        data.status.message.includes("success")
                      ) {
                        currentStep.status = "completed";
                        if (!currentStep.endTime && currentStep.startTime) {
                          const startTime = currentStep.startTime!;
                          currentStep.endTime = now;
                          currentStep.duration = Math.floor(
                            (now - startTime) / 1000,
                          );
                        }
                      }

                      // Check for errors
                      if (data.status.isError) {
                        currentStep.status = "error";
                        if (!currentStep.endTime && currentStep.startTime) {
                          const startTime = currentStep.startTime!;
                          currentStep.endTime = now;
                          currentStep.duration = Math.floor(
                            (now - startTime) / 1000,
                          );
                        }
                      }
                    }

                    return updated;
                  });
                }

                // Show transcript section when we start transcription (step 3)
                if (data.status.step && data.status.step >= 3) {
                  setShowTranscript(true);
                }
                // Automatically switch to results when processing is done
                if (
                  data.status.step === 5 &&
                  data.status.message.includes("completed")
                ) {
                  setTimeout(() => {
                    setCurrentPanel("results");
                  }, 1500); // Small delay to show success message
                }
              }

              if (data.transcript) {
                setTranscript(data.transcript);
              }

              if (data.summary) {
                console.log("Received summary:", data.summary);
                setSummary(data.summary);
              }

              if (data.error) {
                setStatus({ step: 0, message: data.error, isError: true });
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setStatus({
        step: 0,
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        isError: true,
      });
    } finally {
      setIsProcessing(false);
      setStartTime(null);
    }
  };

  const isValidYouTubeUrl = (url: string) => {
    const youtubeRegex =
      /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/;
    return youtubeRegex.test(url);
  };

  const copyToClipboard = async (
    text: string,
    type: "transcript" | "summary",
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "transcript") {
        setCopiedTranscript(true);
        setTimeout(() => setCopiedTranscript(false), 2000);
      } else {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const generateAndPlayAudio = async () => {
    if (!summary) return;

    setIsGeneratingAudio(true);
    try {
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: summary }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate audio");
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
      console.error("Error generating audio:", error);
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

  // Fetch video info when URL changes
  useEffect(() => {
    if (url && isValidYouTubeUrl(url)) {
      fetchVideoInfo(url);
    } else {
      setVideoInfo(null);
    }
  }, [url]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !summary) return;

    const userMessage = { role: "user" as const, content: chatInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: chatInput,
          context: summary,
          transcript: transcript,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
      }
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Video className="w-8 h-8 text-blue-400" />
          <h1 className="text-xl font-bold">YouTube Recap</h1>
        </div>
        <div className="flex items-center space-x-4">
          {currentPanel === "results" && (
            <>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </button>
            </>
          )}
          <button
            onClick={() => {
              setCurrentPanel("input");
              setVideoInfo(null);
              setUrl("");
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            New Video
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 overflow-hidden ${isChatOpen ? "mr-96" : ""} transition-all duration-300`}
      >
        {/* Input Panel */}
        {currentPanel === "input" && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">
                  Analyze any YouTube video
                </h2>
                <p className="text-gray-400">
                  Get AI-powered transcripts, summaries, and insights
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Input Mode Toggle */}
                <div className="flex space-x-2 bg-gray-800 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("url");
                      setUploadedFile(null);
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      inputMode === "url"
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    YouTube URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("file");
                      setUrl("");
                      setVideoInfo(null);
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      inputMode === "file"
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Upload MP4
                  </button>
                </div>

                {/* YouTube URL Input */}
                {inputMode === "url" && (
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      YouTube URL
                    </label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                      disabled={isProcessing}
                      required={inputMode === "url"}
                    />
                    {url && !isValidYouTubeUrl(url) && (
                      <p className="mt-2 text-sm text-red-400">
                        Please enter a valid YouTube URL
                      </p>
                    )}
                  </div>
                )}

                {/* File Upload Input */}
                {inputMode === "file" && (
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Upload Video File
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="video/mp4"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUploadedFile(file);
                            setVideoInfo({
                              title: file.name,
                              thumbnail: "",
                              duration: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
                            });
                          }
                        }}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
                        disabled={isProcessing}
                        required={inputMode === "file"}
                      />
                    </div>
                    {uploadedFile && (
                      <p className="mt-2 text-sm text-gray-400">
                        Selected: {uploadedFile.name} (
                        {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                )}

                {/* Video Preview */}
                {videoInfo && (
                  <div className="bg-gray-800 rounded-lg p-4 flex space-x-4">
                    {videoInfo.thumbnail ? (
                      <img
                        src={videoInfo.thumbnail}
                        alt={videoInfo.title}
                        className="w-32 h-24 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-32 h-24 bg-gray-700 rounded-lg flex items-center justify-center">
                        <Video className="w-8 h-8 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-white mb-2 line-clamp-2">
                        {videoInfo.title}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {videoInfo.duration}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-3">
                    <Languages className="w-4 h-4 inline mr-1" />
                    Summary Language
                  </label>
                  <select
                    value={recapLanguage}
                    onChange={(e) =>
                      setRecapLanguage(e.target.value as Language)
                    }
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                    disabled={isProcessing}
                  >
                    <option value="en">English</option>
                    <option value="fr">French</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={
                    isProcessing ||
                    (inputMode === "url" &&
                      (!url || !isValidYouTubeUrl(url))) ||
                    (inputMode === "file" && !uploadedFile)
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-4 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Analyze Video</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Processing Panel */}
        {currentPanel === "processing" && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-2xl w-full text-center">
              {videoInfo && (
                <div className="mb-8">
                  {videoInfo.thumbnail ? (
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className="w-64 h-48 object-cover rounded-lg mx-auto mb-4"
                    />
                  ) : (
                    <div className="w-64 h-48 bg-gray-700 rounded-lg mx-auto mb-4 flex items-center justify-center">
                      <Video className="w-16 h-16 text-gray-500" />
                    </div>
                  )}
                  <h3 className="text-xl font-medium mb-2">
                    {videoInfo.title}
                  </h3>
                </div>
              )}

              {/* Step Tracking */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <div className="space-y-3">
                  {stepTracking.map((step) => (
                    <div
                      key={step.stepNumber}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        step.status === "in-progress"
                          ? "bg-blue-900/30 border border-blue-500/50"
                          : step.status === "completed"
                            ? "bg-green-900/20"
                            : step.status === "error"
                              ? "bg-red-900/20"
                              : "bg-gray-700/50"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {step.status === "completed" ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : step.status === "in-progress" ? (
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                          ) : step.status === "error" ? (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                          )}
                        </div>
                        <div className="text-left">
                          <div
                            className={`font-medium ${
                              step.status === "in-progress"
                                ? "text-blue-400"
                                : step.status === "completed"
                                  ? "text-green-400"
                                  : step.status === "error"
                                    ? "text-red-400"
                                    : "text-gray-400"
                            }`}
                          >
                            {step.label}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {step.duration !== undefined ? (
                          <span className="text-gray-400">
                            {step.duration}s
                          </span>
                        ) : step.status === "in-progress" && step.startTime ? (
                          <span className="text-blue-400">
                            {Math.floor((Date.now() - step.startTime) / 1000)}s
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {isProcessing && elapsedTime > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-400 text-center">
                    Total processing time: {formatElapsedTime(elapsedTime)}
                  </div>
                )}
              </div>

              {status && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">{status.message}</p>
                </div>
              )}

              {/* Show partial transcript during processing */}
              {showTranscript && transcript && (
                <div className="mt-6 bg-gray-800 rounded-lg p-6">
                  <h4 className="text-lg font-medium mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Transcript (Live)
                  </h4>
                  <div className="max-h-64 overflow-y-auto">
                    <p className="text-gray-300 text-sm text-left whitespace-pre-wrap">
                      {transcript}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results Panel */}
        {currentPanel === "results" && (
          <div
            className={`${isFullscreen ? "fixed inset-0 z-50 bg-gray-900" : "h-[calc(100vh-80px)]"}`}
          >
            <div className="h-full grid grid-cols-2 gap-6 p-6 overflow-hidden">
              {/* Transcript Panel */}
              <div className="bg-gray-800 rounded-lg overflow-hidden flex flex-col h-full">
                <div className="bg-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-medium">Full Transcript</h3>
                  </div>
                  <button
                    onClick={() => copyToClipboard(transcript, "transcript")}
                    className="flex items-center space-x-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                  >
                    {copiedTranscript ? (
                      <>
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span className="text-sm">Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {transcript || "No transcript available"}
                  </p>
                </div>
              </div>

              {/* Summary Panel */}
              <div className="bg-gray-800 rounded-lg overflow-hidden flex flex-col h-full">
                <div className="bg-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-medium">AI Summary</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={togglePlayback}
                      disabled={isGeneratingAudio || !summary}
                      className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {isGeneratingAudio ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Generating...</span>
                        </>
                      ) : isPlaying ? (
                        <>
                          <Pause className="w-4 h-4" />
                          <span className="text-sm">Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span className="text-sm">Play</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(summary, "summary")}
                      disabled={!summary}
                      className="flex items-center space-x-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {copiedSummary ? (
                        <>
                          <Check className="w-4 h-4 text-green-400" />
                          <span className="text-green-400 text-sm">
                            Copied!
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span className="text-sm">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {summary ? (
                      <>{summary}</>
                    ) : (
                      <div className="text-gray-500 italic">
                        No summary available. The AI recap will appear here once
                        processing is complete.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Chat Sidebar */}
      {isChatOpen && (
        <div className="fixed right-0 top-0 h-full w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="bg-gray-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-medium">Chat about this video</h3>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="p-1 hover:bg-gray-600 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-400 mt-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-sm mb-2">Ask questions about this video</p>
                <p className="text-xs text-gray-500">
                  I can help explain concepts, summarize sections, or answer
                  specific questions based on the transcript and summary.
                </p>
              </div>
            ) : (
              chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-200"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <div className="border-t border-gray-700 p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="Ask a question..."
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                disabled={!summary}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || !summary}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
